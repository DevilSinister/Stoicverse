-- Undo for 20260911020000_community_role_permissions.
--
-- Dropping the CHECK leaves any permission_config already written in place —
-- including one with an invalid key, which would then silently never grant.
-- Clear permission_config first if you intend to truly revert.
--
-- notify_community_mentions is restored to its inline regex so the notifier
-- keeps working after community_mention_kind is gone.

alter table public.cosmetic_roles drop constraint if exists cosmetic_roles_permission_config_valid;

create or replace function public.notify_community_mentions()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  body_text text := coalesce(new.body, '');
  action text := '/dashboard/community?channel=' || new.channel_id;
begin
  if body_text !~* '(^|[^[:alnum:]_])@(all|tier-[1-5])([^[:alnum:]_]|$)' then
    return new;
  end if;

  insert into public.notifications(user_id, type, title, body, action_url)
  select profile.id,
         'community_mention',
         case when body_text ~* '(^|[^[:alnum:]_])@all([^[:alnum:]_]|$)' then 'You were mentioned in the community' else 'Your tier was mentioned in the community' end,
         left(body_text, 240),
         action
  from public.profiles profile
  join public.memberships membership on membership.user_id = profile.id and membership.status = 'active'
  join public.member_tiers tier on tier.user_id = profile.id
  where not profile.is_suspended
    and profile.id <> new.author_id
    and (
      body_text ~* '(^|[^[:alnum:]_])@all([^[:alnum:]_]|$)'
      or body_text ~* ('(^|[^[:alnum:]_])@tier-' || case when tier.is_master then 5 else tier.current_tier end || '([^[:alnum:]_]|$)')
    );

  return new;
end;
$$;

drop function if exists public.community_grant(text);
drop function if exists public.community_mention_kind(text);
drop function if exists public.is_valid_permission_config(jsonb);
