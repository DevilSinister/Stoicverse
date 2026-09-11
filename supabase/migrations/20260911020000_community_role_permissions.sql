-- Role permissions, and one definition of what a mention is.
--
-- Provably a no-op on apply, verified first: exactly one cosmetic role exists,
-- no role carries a permission_config, there are no role assignments, and there
-- are no moderators. Every grant below therefore starts false for everyone
-- except the influencer, who already held every capability.
--
-- Grants only, never denies. A union is monotone, so "why can this person do X"
-- always has a one-hop answer: some role grants it. Add denies and the question
-- becomes an ordering problem with no good answer.

-- --------------------------------------------------------- permission_config

-- The one jsonb in this feature, because the shape is sparse and open-ended.
-- Neutralised with a validating CHECK: without it a typo like `mention_All`
-- reads as NULL, the grant silently never applies, and nothing errors.
create or replace function public.is_valid_permission_config(config jsonb)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select config is null or (
    jsonb_typeof(config) = 'object'
    and not exists (
      select 1
      from jsonb_each(config) as entry(config_key, config_value)
      where entry.config_key not in (
              'post', 'pin', 'delete_others', 'manage_channels',
              'mention_all', 'mention_tier', 'bypass_slow_mode'
            )
         or jsonb_typeof(entry.config_value) <> 'boolean'
    )
  );
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cosmetic_roles_permission_config_valid') then
    alter table public.cosmetic_roles
      add constraint cosmetic_roles_permission_config_valid
      check (public.is_valid_permission_config(permission_config)) not valid;
    alter table public.cosmetic_roles validate constraint cosmetic_roles_permission_config_valid;
  end if;
end $$;

-- ------------------------------------------------------------------- grants

-- Identity-level: the platform role union every assigned cosmetic role.
--
-- The moderator baseline is post, pin, delete_others and mention_tier.
-- `mention_all` and `manage_channels` are deliberately NOT in it: @all reaches
-- every active member at once, and channel management reshapes what everyone
-- sees. Both require an explicit cosmetic-role grant.
create or replace function public.community_grant(grant_key text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select case
    when exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and platform_role in ('influencer', 'super_admin')
        and not is_suspended
    ) then true

    when grant_key in ('post', 'pin', 'delete_others', 'mention_tier') and exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and platform_role = 'moderator'
        and not is_suspended
    ) then true

    else exists (
      select 1
      from public.cosmetic_role_assignments assignment
      join public.cosmetic_roles role on role.id = assignment.role_id
      join public.profiles profile on profile.id = assignment.user_id
      where assignment.user_id = (select auth.uid())
        and not profile.is_suspended
        and (role.permission_config ->> grant_key) = 'true'
    )
  end;
$$;

revoke execute on function public.community_grant(text) from public;
revoke execute on function public.community_grant(text) from anon;
grant execute on function public.community_grant(text) to authenticated;

-- ------------------------------------------------------------------ mentions

-- One definition, shared by the enforcement trigger and the notifier. Two
-- copies and you get posts accepted that notify nobody, or refused that would
-- have notified everybody.
create or replace function public.community_mention_kind(body_text text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case
    when coalesce(body_text, '') ~* '(^|[^[:alnum:]_])@all([^[:alnum:]_]|$)' then 'all'
    when coalesce(body_text, '') ~* '(^|[^[:alnum:]_])@tier-[1-5]([^[:alnum:]_]|$)' then 'tier'
    else null
  end;
$$;

revoke execute on function public.community_mention_kind(text) from public;
revoke execute on function public.community_mention_kind(text) from anon;
grant execute on function public.community_mention_kind(text) to authenticated;

-- Same behaviour as before, with the regex no longer written out twice here.
create or replace function public.notify_community_mentions()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  body_text text := coalesce(new.body, '');
  kind text := public.community_mention_kind(body_text);
  action text := '/dashboard/community?channel=' || new.channel_id;
begin
  if kind is null then
    return new;
  end if;

  insert into public.notifications(user_id, type, title, body, action_url)
  select profile.id,
         'community_mention',
         case when kind = 'all'
              then 'You were mentioned in the community'
              else 'Your tier was mentioned in the community' end,
         left(body_text, 240),
         action
  from public.profiles profile
  join public.memberships membership on membership.user_id = profile.id and membership.status = 'active'
  join public.member_tiers tier on tier.user_id = profile.id
  where not profile.is_suspended
    and profile.id <> new.author_id
    and (
      kind = 'all'
      or body_text ~* ('(^|[^[:alnum:]_])@tier-' || case when tier.is_master then 5 else tier.current_tier end || '([^[:alnum:]_]|$)')
    );

  return new;
end;
$$;

-- ---------------------------------------------------- mention gating on write

-- Extends the phase 5 content trigger. Mentions are checked before the staff
-- exemption, because the whole point of the baseline is that a moderator does
-- not get @all for free.
create or replace function private.assert_post_content_allowed()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  rules public.community_settings%rowtype;
  author_is_staff boolean;
  mention text;
begin
  select * into rules from public.community_settings limit 1;
  if not found then
    return new;
  end if;

  if char_length(coalesce(new.body, '')) > rules.max_body_length then
    raise exception 'Messages are limited to % characters here.', rules.max_body_length;
  end if;

  -- Only when there is a session to attribute the write to. A service-role
  -- insert has no auth.uid(), and community_grant would read false for every
  -- key and block a legitimate administrative write.
  if (select auth.uid()) is not null then
    mention := public.community_mention_kind(new.body);
    if mention = 'all' and not public.community_grant('mention_all') then
      raise exception 'You do not have permission to mention everyone here.';
    end if;
    if mention = 'tier' and not public.community_grant('mention_tier') then
      raise exception 'You do not have permission to mention a tier here.';
    end if;
  end if;

  select exists (
    select 1 from public.profiles
    where id = new.author_id and platform_role in ('moderator','influencer','super_admin')
  ) into author_is_staff;

  if author_is_staff then
    return new;
  end if;

  if not rules.allow_links and coalesce(new.body, '') ~* '(https?://|www\.)' then
    raise exception 'Links are not allowed in this community.';
  end if;

  if not rules.allow_attachments and new.image_url is not null then
    raise exception 'Attachments are not allowed in this community.';
  end if;

  return new;
end;
$$;
