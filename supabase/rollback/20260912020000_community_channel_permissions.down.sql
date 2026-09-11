-- Rollback for 20260912020000_community_channel_permissions.
--
-- Restores the pre-phase-3 database verbatim: `posts_staff_insert` comes back,
-- `can_view_channel` goes back to deriving tier and role access itself, the
-- resolver loses its override block, and slow mode returns to being one
-- community-wide setting.
--
-- DATA LOSS, stated plainly: every `channel_permission_overrides` row is
-- dropped, along with per-channel slow mode. `legacy_type` is what makes the
-- `master` channel type recoverable — that is the only reason it exists. Any
-- channel created as type `rules` after phase 3 becomes `text`, because the old
-- CHECK has no such value.
--
-- Run only while phase 4 has not been applied.

do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'community_mod_cases'
  ) then
    raise exception 'refusing to roll back: phase 4 (community_mod_cases) is applied and depends on this phase';
  end if;
end $$;

-- --------------------------------------------------------- the policy switch

drop policy if exists posts_read on public.posts;
create policy posts_read
on public.posts
for select
to authenticated
using (not is_deleted and public.can_view_channel(channel_id));

drop policy if exists posts_member_insert on public.posts;
create policy posts_staff_insert
on public.posts
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and public.is_staff()
  and public.can_view_channel(channel_id)
);

drop policy if exists posts_author_or_manager_update on public.posts;
create policy posts_author_or_staff_update
on public.posts
for update
to authenticated
using (public.can_view_channel(channel_id) and (author_id = (select auth.uid()) or public.is_staff()))
with check (is_deleted or public.can_view_channel(channel_id));

drop policy if exists channels_read on public.channels;
drop policy if exists channels_manager_write on public.channels;
drop policy if exists channels_manager_insert on public.channels;
drop policy if exists channels_manager_update on public.channels;
drop policy if exists channels_manager_delete on public.channels;
create policy channels_read
on public.channels
for select
to authenticated
using (public.is_influencer() or public.is_super_admin() or public.can_view_channel(id));

create policy channels_influencer_write
on public.channels
for all
to authenticated
using (public.is_influencer() or public.is_super_admin())
with check (public.is_influencer() or public.is_super_admin());

create policy influencer_channels_manage
on public.channels
for all
to authenticated
using (public.is_influencer())
with check (public.is_influencer());

drop policy if exists channel_categories_read on public.channel_categories;
drop policy if exists channel_categories_manager_write on public.channel_categories;
drop policy if exists channel_categories_manager_insert on public.channel_categories;
drop policy if exists channel_categories_manager_update on public.channel_categories;
drop policy if exists channel_categories_manager_delete on public.channel_categories;
create policy channel_categories_read
on public.channel_categories
for select
to authenticated
using (public.is_influencer() or public.is_super_admin());

create policy channel_categories_influencer_write
on public.channel_categories
for all
to authenticated
using (public.is_influencer() or public.is_super_admin())
with check (public.is_influencer() or public.is_super_admin());

drop policy if exists community_moderation_events_auditor_read on public.community_moderation_events;
create policy community_moderation_events_staff_read
on public.community_moderation_events
for select
to authenticated
using (public.is_staff());

drop policy if exists community_blocked_words_manager_read on public.community_blocked_words;
drop policy if exists community_blocked_words_manager_write on public.community_blocked_words;
drop policy if exists community_blocked_words_manager_insert on public.community_blocked_words;
drop policy if exists community_blocked_words_manager_update on public.community_blocked_words;
drop policy if exists community_blocked_words_manager_delete on public.community_blocked_words;
create policy community_blocked_words_staff_read
on public.community_blocked_words
for select
to authenticated
using (public.is_staff());

create policy community_blocked_words_influencer_write
on public.community_blocked_words
for all
to authenticated
using (public.is_influencer() or public.is_super_admin())
with check (public.is_influencer() or public.is_super_admin());

drop policy if exists community_posts_member_upload on storage.objects;
create policy community_posts_staff_upload
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'community-posts'
  and public.is_staff()
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists community_posts_owner_or_manager_delete on storage.objects;
create policy community_posts_staff_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'community-posts'
  and public.is_staff()
  and owner_id = (select auth.uid())::text
);

-- ------------------------------------------------------ channel visibility

create or replace function public.can_view_channel(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from public.channels channel
    join public.channel_categories category on category.id = channel.category_id
    left join public.profiles profile on profile.id = (select auth.uid())
    left join public.member_tiers tier on tier.user_id = profile.id
    where channel.id = target_channel_id
      and not channel.is_archived and channel.is_active and not category.is_archived
      and (
        profile.platform_role = 'super_admin'
        or (
          profile.platform_role in ('moderator','influencer')
          and profile.platform_role = any(channel.allowed_roles)
        )
        or (
          profile.platform_role = 'member'
          and 'member' = any(channel.allowed_roles)
          and public.is_active_member()
          and coalesce(case when tier.is_master then 5 else tier.current_tier end, 0) >= channel.min_tier
        )
      )
  );
$$;

drop function if exists public.community_channel_directory();
create or replace function public.community_channel_directory()
returns table (
  category_id uuid,
  category_name text,
  category_description text,
  category_sort_order integer,
  channel_id uuid,
  channel_name text,
  channel_type text,
  channel_description text,
  channel_sort_order integer,
  min_tier integer,
  is_locked boolean
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select category.id, category.name, category.description, category.sort_order,
    channel.id, channel.name, channel.type,
    case when public.can_view_channel(channel.id) then channel.description else null end,
    channel.sort_order, channel.min_tier, not public.can_view_channel(channel.id)
  from public.channel_categories category
  join public.channels channel on channel.category_id = category.id
  join public.profiles profile on profile.id = (select auth.uid())
  left join public.member_tiers tier on tier.user_id = profile.id
  where not category.is_archived and not channel.is_archived and channel.is_active
    and (
      public.can_view_channel(channel.id)
      or (
        profile.platform_role = 'member'
        and 'member' = any(channel.allowed_roles)
        and channel.visibility_mode = 'locked'
        and public.is_active_member()
        and coalesce(case when tier.is_master then 5 else tier.current_tier end, 0) < channel.min_tier
      )
    )
  order by category.sort_order, channel.sort_order;
$$;

revoke execute on function public.community_channel_directory() from public, anon;
grant execute on function public.community_channel_directory() to authenticated, service_role;

-- --------------------------------------------------------- content triggers

create or replace function public.guard_post_update()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    return new;
  end if;

  if new.body          is distinct from old.body
  or new.image_url     is distinct from old.image_url
  or new.video_file_id is distinct from old.video_file_id then
    if old.author_id is distinct from actor then
      raise exception 'Only the author can edit this message';
    end if;
    insert into public.community_moderation_events
      (post_id, channel_id, actor_id, subject_id, action, previous_body)
    values (old.id, old.channel_id, actor, old.author_id, 'edit', old.body);
  end if;

  if new.is_pinned is distinct from old.is_pinned then
    if not public.is_staff() then
      raise exception 'You do not have permission to pin messages';
    end if;
    insert into public.community_moderation_events
      (post_id, channel_id, actor_id, subject_id, action)
    values (old.id, old.channel_id, actor, old.author_id,
            case when new.is_pinned then 'pin' else 'unpin' end);
  end if;

  if new.is_deleted and not old.is_deleted then
    if old.author_id is distinct from actor and not public.is_staff() then
      raise exception 'You do not have permission to delete this message';
    end if;
    insert into public.community_moderation_events
      (post_id, channel_id, actor_id, subject_id, action, reason, previous_body)
    values (old.id, old.channel_id, actor, old.author_id, 'delete',
            nullif(btrim(coalesce(current_setting('app.moderation_reason', true), '')), ''),
            old.body);
  end if;

  return new;
end;
$$;

create or replace function public.soft_delete_post(target_post_id uuid, delete_reason text default null)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  clean_reason text := nullif(btrim(coalesce(delete_reason, '')), '');
begin
  if not exists (
    select 1
    from public.posts post
    where post.id = target_post_id
      and not post.is_deleted
      and public.can_view_channel(post.channel_id)
      and (post.author_id = (select auth.uid()) or public.is_staff())
  ) then
    raise exception 'You do not have permission to delete this message';
  end if;

  if clean_reason is not null and char_length(clean_reason) not between 3 and 500 then
    raise exception 'A deletion reason must be between 3 and 500 characters';
  end if;

  perform set_config('app.moderation_reason', coalesce(clean_reason, ''), true);

  update public.posts
  set is_deleted = true, updated_at = now()
  where id = target_post_id and not is_deleted;

  return found;
end;
$$;

-- ------------------------------------------------------------- columns back

-- Slow mode returns to a single community-wide setting, seeded from the
-- highest per-channel value so nobody's pacing silently loosens.
alter table public.community_settings
  add column if not exists slow_mode_seconds integer not null default 0;

update public.community_settings
set slow_mode_seconds = least(coalesce((select max(slow_mode_seconds) from public.channels), 0), 21600);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'community_settings_slow_mode_seconds_check') then
    alter table public.community_settings
      add constraint community_settings_slow_mode_seconds_check
      check (slow_mode_seconds between 0 and 21600);
  end if;
end $$;

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
  last_post timestamptz;
  matched text;
begin
  select * into rules from public.community_settings limit 1;
  if not found then
    return new;
  end if;

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

  if coalesce(new.body, '') <> '' then
    select phrase into matched
    from public.community_blocked_words
    where case
            when rules.blocked_word_match = 'substring'
              then position(lower(btrim(phrase)) in lower(new.body)) > 0
            else new.body ~* ('(^|[^[:alnum:]_])' ||
                              regexp_replace(btrim(phrase), '([\^$.|?*+()\[\]{}\\])', '\\\1', 'g') ||
                              '([^[:alnum:]_]|$)')
          end
    limit 1;

    if matched is not null then
      if rules.blocked_word_mode = 'block' then
        raise exception 'That message contains a word this community does not allow.';
      elsif new.author_id is not null then
        insert into public.community_moderation_events (post_id, channel_id, actor_id, action, reason, previous_body)
        values (new.id, new.channel_id, new.author_id, 'flag', 'matched blocked phrase', left(new.body, 2000));
      end if;
    end if;
  end if;

  if tg_op = 'INSERT'
     and rules.slow_mode_seconds > 0
     and new.author_id is not null
     and not author_is_staff
     and not public.community_grant('bypass_slow_mode') then
    perform pg_advisory_xact_lock(hashtext(new.channel_id::text || ':' || new.author_id::text));

    select max(created_at) into last_post
    from public.posts
    where channel_id = new.channel_id and author_id = new.author_id and not is_deleted;

    if last_post is not null and now() < last_post + make_interval(secs => rules.slow_mode_seconds) then
      raise exception 'Slow mode is on here. You can post again in % seconds.',
        ceil(extract(epoch from (last_post + make_interval(secs => rules.slow_mode_seconds)) - now()));
    end if;
  end if;

  if tg_op = 'UPDATE'
     and rules.edit_window_minutes > 0
     and not author_is_staff
     and new.body is distinct from old.body
     and old.created_at < now() - make_interval(mins => rules.edit_window_minutes) then
    raise exception 'Messages can only be edited within % minutes of posting.', rules.edit_window_minutes;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------- overrides out

drop function if exists public.community_override_set(text, uuid, uuid, text[], text[]);
drop function if exists public.community_override_delete(uuid);
drop function if exists public.community_channel_sync_permissions(uuid, boolean);
drop function if exists public.community_channel_set_slow_mode(uuid, integer);
drop table if exists public.channel_permission_overrides;

-- `rules` has no place in the old CHECK, and `master` comes back from the
-- column kept for exactly this.
update public.channels set type = 'text' where type = 'rules';
update public.channels set type = 'master' where legacy_type = 'master';

alter table public.channels drop constraint if exists channels_type_check;
alter table public.channels
  add constraint channels_type_check
  check (type in ('text', 'announcements', 'events', 'master'));

alter table public.channels drop constraint if exists channels_slow_mode_seconds_check;
alter table public.channels
  drop column if exists permissions_synced,
  drop column if exists slow_mode_seconds,
  drop column if exists legacy_type;

-- ---------------------------------------------------- the phase-2 resolver

create or replace function public.community_permissions(target uuid, channel uuid default null)
returns text[]
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  gate text;
  platform text;
  base text[];
  perms text[];
  channel_row public.channels%rowtype;
begin
  if target is null then
    return '{}'::text[];
  end if;

  gate := private.community_gate(target);
  if gate = 'suspended' then
    return '{}'::text[];
  end if;

  select platform_role into platform from public.profiles where id = target;
  if platform is null then
    return '{}'::text[];
  end if;
  if platform in ('influencer', 'super_admin') then
    return public.community_permission_keys();
  end if;
  if gate = 'banned' then
    return '{}'::text[];
  end if;

  if platform <> 'moderator' and not exists (
    select 1 from public.memberships membership
    where membership.user_id = target
      and membership.status = 'active'
      and (membership.expires_at is null or membership.expires_at > now())
  ) then
    return '{}'::text[];
  end if;

  select coalesce(array_agg(distinct granted), '{}'::text[])
  into base
  from public.community_roles role
  cross join lateral unnest(role.permissions) as granted
  where role.system_key = 'everyone'
     or exists (
       select 1 from public.community_role_members assignment
       where assignment.role_id = role.id and assignment.user_id = target
     );

  if 'administrator' = any(base) then
    return public.community_permission_keys();
  end if;
  if channel is null then
    return base;
  end if;

  select * into channel_row from public.channels where id = channel;
  if not found then
    return '{}'::text[];
  end if;
  if channel_row.is_archived and not ('manage_channels' = any(base)) then
    return '{}'::text[];
  end if;

  perms := base;

  if not ('view_channel' = any(perms)) then
    return '{}'::text[];
  end if;

  if gate in ('timeout', 'rules', 'verification', 'lockdown') then
    perms := array(
      select key from unnest(perms) as key
      where key not in (
        'send_messages', 'send_messages_in_threads', 'create_threads', 'add_reactions',
        'attach_files', 'embed_links', 'mention_everyone', 'mention_roles'
      )
    );
  end if;

  return array(
    select catalog.key
    from unnest(public.community_permission_keys()) with ordinality as catalog(key, ord)
    where catalog.key = any(perms)
    order by catalog.ord
  );
end;
$$;

revoke execute on function public.community_permissions(uuid, uuid) from public, anon;
revoke execute on function public.community_permissions(uuid, uuid) from authenticated;
grant execute on function public.community_permissions(uuid, uuid) to service_role;
