-- Channel permissions, and the day members can post.
--
-- Phase 2 built the role hierarchy and the resolver but deliberately changed
-- no policy on `posts`. This migration is that change. `posts_staff_insert`
-- goes; `posts_member_insert` takes its place and asks the resolver rather than
-- `is_staff()`. Everything that used to gate on "is this person staff" now asks
-- what permission they hold, here, in this channel.
--
-- Three things land together because they cannot be separated: the overrides
-- table the resolver reads, the conversion of the legacy tier/role gates into
-- overrides, and the policy switch itself. Splitting them would leave a window
-- where channel access is described in two places at once.
--
-- Verified live before applying: two channels (`events`, `Announcements`), both
-- `min_tier = 1`, both `allowed_roles = {member,moderator,influencer}`, both
-- `visibility_mode = 'locked'`, neither of type `master`. The legacy conversion
-- below therefore produces **zero** override rows — every gate it knows how to
-- translate is already wide open. 15 posts exist, all in `events`.
--
-- What changes for a real person on apply:
--   influencer, super_admin   no change; they hold every permission
--   moderator                 no change; the seeded Moderator role carries
--                             send_messages, manage_messages and pin_messages
--   active member             reads and reacts exactly as before, and still
--                             CANNOT post: @everyone does not carry
--                             send_messages. Read-only is the default now, and
--                             opening the community up is an explicit grant on
--                             @everyone or a per-channel allow.
--   lapsed / suspended        no change; the resolver returns {} for them

-- ----------------------------------------------------------------- pre-flight

do $$
declare
  system_role_count integer;
  post_count integer;
  orphan_channels integer;
begin
  select count(*) into system_role_count from public.community_roles where system_key is not null;
  if system_role_count <> 7 then
    raise exception 'pre-flight: expected the 7 phase-2 system roles, found %. Apply 20260912010000 first.', system_role_count;
  end if;

  if not exists (
    select 1 from public.community_roles
    where system_key = 'everyone' and 'view_channel' = any(permissions)
  ) then
    raise exception 'pre-flight: @everyone does not carry view_channel, so this migration would hide every channel from every member';
  end if;

  if (select count(*) from public.profiles where platform_role = 'moderator' and not is_suspended)
     <> (select count(*) from public.community_role_members assignment
         join public.community_roles role on role.id = assignment.role_id
         where role.system_key = 'moderator') then
    raise exception 'pre-flight: the moderator role membership has drifted from profiles.platform_role';
  end if;

  select count(*) into orphan_channels from public.channels where category_id is null;
  if orphan_channels > 0 then
    raise exception 'pre-flight: % channel(s) have no category, so category-level overrides could not apply to them', orphan_channels;
  end if;

  select count(*) into post_count from public.posts;
  raise notice 'pre-flight: % post(s) exist; the posts policy switch must leave every one of them readable', post_count;
end $$;

-- ------------------------------------------------------------ channel columns

alter table public.channels
  add column if not exists permissions_synced boolean not null default true,
  add column if not exists slow_mode_seconds integer not null default 0,
  -- Kept for phase 9's cleanup and for the "this channel was a tier gate"
  -- note the interface shows beside a converted channel.
  add column if not exists legacy_type text;

update public.channels set legacy_type = type where legacy_type is null;

-- Slow mode was community-wide. It becomes a per-channel field seeded from the
-- single value that was in force, so nobody's pacing changes on apply.
update public.channels
set slow_mode_seconds = coalesce((select slow_mode_seconds from public.community_settings limit 1), 0)
where slow_mode_seconds = 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'channels_slow_mode_seconds_check') then
    alter table public.channels
      add constraint channels_slow_mode_seconds_check
      check (slow_mode_seconds between 0 and 21600);
  end if;
end $$;

-- `master` was a type doing an access-control job. Tier 5 access is an override
-- now, so the type says only what kind of channel it is.
update public.channels set type = 'text' where type = 'master';

alter table public.channels drop constraint if exists channels_type_check;
alter table public.channels
  add constraint channels_type_check
  check (type in ('text', 'announcements', 'events', 'rules'));

alter table public.community_settings drop column if exists slow_mode_seconds;

-- ---------------------------------------------------------------- overrides

create table if not exists public.channel_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade,
  category_id uuid references public.channel_categories(id) on delete cascade,
  role_id uuid not null references public.community_roles(id) on delete cascade,
  allow text[] not null default '{}'::text[],
  deny text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  -- Exactly one target. A row pointing at both would apply twice under
  -- different precedence depending on whether the channel is synced.
  constraint channel_permission_overrides_one_target check (num_nonnulls(channel_id, category_id) = 1),
  -- Community-scoped permissions are deliberately not overridable: nobody
  -- should be able to grant `ban_members` in one channel and not another.
  constraint channel_permission_overrides_allow_known check (allow <@ public.community_channel_permission_keys()),
  constraint channel_permission_overrides_deny_known check (deny <@ public.community_channel_permission_keys()),
  -- Allowing and denying the same key is a question with no answer.
  constraint channel_permission_overrides_disjoint check (not (allow && deny))
);

create unique index if not exists channel_permission_overrides_channel_role_idx
  on public.channel_permission_overrides (channel_id, role_id) where channel_id is not null;
create unique index if not exists channel_permission_overrides_category_role_idx
  on public.channel_permission_overrides (category_id, role_id) where category_id is not null;
create index if not exists channel_permission_overrides_role_idx
  on public.channel_permission_overrides (role_id);
create index if not exists channel_permission_overrides_updated_by_idx
  on public.channel_permission_overrides (updated_by);

drop trigger if exists channel_permission_overrides_set_updated_at on public.channel_permission_overrides;
create trigger channel_permission_overrides_set_updated_at
before update on public.channel_permission_overrides
for each row execute function public.set_updated_at();

-- ------------------------------------------------------- legacy conversion

-- Every gate the old columns could express, restated as overrides. A no-op on
-- the data as it stands — both channels are open to every role at tier 1 — and
-- written in full because it is the only description of what those columns
-- meant, and phase 9 deletes them.
do $$
declare
  everyone_id uuid;
  converted integer := 0;
begin
  select id into everyone_id from public.community_roles where system_key = 'everyone';

  -- A `master` channel was tier 5 only, and only staff could write in it. Deny
  -- @everyone outright, allow Master to see and speak.
  insert into public.channel_permission_overrides (channel_id, role_id, allow, deny)
  select channel.id, everyone_id, '{}'::text[], array['view_channel']
  from public.channels channel
  where channel.legacy_type = 'master'
  on conflict do nothing;

  insert into public.channel_permission_overrides (channel_id, role_id, allow, deny)
  select channel.id, role.id, array['view_channel', 'send_messages'], '{}'::text[]
  from public.channels channel
  cross join public.community_roles role
  where channel.legacy_type = 'master' and role.system_key = 'tier_5'
  on conflict do nothing;

  -- `min_tier > 1` was "tier N and above". Deny @everyone, allow each tier from
  -- N upward — the tier roles stack by position but do not inherit one another,
  -- so every qualifying tier needs its own allow.
  insert into public.channel_permission_overrides (channel_id, role_id, allow, deny)
  select channel.id, everyone_id, '{}'::text[], array['view_channel']
  from public.channels channel
  where channel.min_tier > 1 and channel.legacy_type <> 'master'
  on conflict do nothing;

  insert into public.channel_permission_overrides (channel_id, role_id, allow, deny)
  select channel.id, role.id, array['view_channel'], '{}'::text[]
  from public.channels channel
  join public.community_roles role
    on role.system_key in ('tier_1', 'tier_2', 'tier_3', 'tier_4', 'tier_5')
   and substring(role.system_key from 6)::integer >= channel.min_tier
  where channel.min_tier > 1 and channel.legacy_type <> 'master'
  on conflict do nothing;

  -- A channel that excluded plain members was staff-only. Deny @everyone and
  -- allow Moderator; the influencer needs no override, holding everything.
  insert into public.channel_permission_overrides (channel_id, role_id, allow, deny)
  select channel.id, everyone_id, '{}'::text[], array['view_channel']
  from public.channels channel
  where not ('member' = any(channel.allowed_roles))
  on conflict do nothing;

  insert into public.channel_permission_overrides (channel_id, role_id, allow, deny)
  select channel.id, role.id, array['view_channel'], '{}'::text[]
  from public.channels channel
  cross join public.community_roles role
  where not ('member' = any(channel.allowed_roles)) and role.system_key = 'moderator'
  on conflict do nothing;

  -- A converted channel carries its own overrides, so it must stop following
  -- its category or the conversion would be ignored.
  update public.channels channel
  set permissions_synced = false
  where exists (
    select 1 from public.channel_permission_overrides o where o.channel_id = channel.id
  );

  select count(*) into converted from public.channel_permission_overrides;
  raise notice 'legacy conversion: % override row(s) written', converted;
end $$;

-- --------------------------------------------------------- the resolver

-- Phase 2 left a marked gap between the base union and the view_channel test.
-- This is what fills it. The precedence is Discord's and is mirrored exactly by
-- `resolveChannelPermissions` in src/lib/community-settings/permissions.ts,
-- which a unit test pins in both directions:
--
--   base → @everyone deny → @everyone allow → role denies → role allows
--
-- Denies before allows at each level, and the role level after @everyone, so a
-- role can always re-grant what the baseline took away.
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
  channel_hidden boolean;
  everyone_deny text[];
  everyone_allow text[];
  role_deny text[];
  role_allow text[];
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

  -- A moderator keeps their seat without a paid membership; nobody else does.
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

  -- Archived, deactivated, or sitting in an archived category. All three were
  -- part of the old can_view_channel and none of them is a permission
  -- question — the channel is simply not in service.
  select channel_row.is_archived
      or not channel_row.is_active
      or coalesce(category.is_archived, true)
  into channel_hidden
  from public.channel_categories category
  where category.id = channel_row.category_id;

  if coalesce(channel_hidden, true) and not ('manage_channels' = any(base)) then
    return '{}'::text[];
  end if;

  -- The channel's own overrides once it has been unsynced, its category's while
  -- it still follows along. Never both: a channel that carries its own rules
  -- stops inheriting, exactly as Discord does it.
  select
    coalesce(array_agg(distinct entry.key) filter (where entry.kind = 'deny'  and role.system_key = 'everyone'), '{}'::text[]),
    coalesce(array_agg(distinct entry.key) filter (where entry.kind = 'allow' and role.system_key = 'everyone'), '{}'::text[]),
    coalesce(array_agg(distinct entry.key) filter (where entry.kind = 'deny'  and role.system_key is distinct from 'everyone'), '{}'::text[]),
    coalesce(array_agg(distinct entry.key) filter (where entry.kind = 'allow' and role.system_key is distinct from 'everyone'), '{}'::text[])
  into everyone_deny, everyone_allow, role_deny, role_allow
  from public.channel_permission_overrides override
  join public.community_roles role on role.id = override.role_id
  cross join lateral (
    select 'deny'::text as kind, key from unnest(override.deny) as key
    union all
    select 'allow'::text, key from unnest(override.allow) as key
  ) entry
  where (case when channel_row.permissions_synced
              then override.category_id = channel_row.category_id
              else override.channel_id = channel_row.id end)
    and (
      role.system_key = 'everyone'
      or exists (
        select 1 from public.community_role_members assignment
        where assignment.role_id = override.role_id and assignment.user_id = target
      )
    );

  perms := base;
  perms := array(select key from unnest(perms) as key where key <> all(everyone_deny));
  perms := array(select distinct key from unnest(perms || everyone_allow) as key);
  perms := array(select key from unnest(perms) as key where key <> all(role_deny));
  perms := array(select distinct key from unnest(perms || role_allow) as key);

  if not ('view_channel' = any(perms)) then
    return '{}'::text[];
  end if;

  -- The rules channel is where the rules are posted, not discussed.
  if channel_row.type = 'rules' and not ('manage_channels' = any(perms)) then
    perms := array(
      select key from unnest(perms) as key
      where key not in ('send_messages', 'send_messages_in_threads', 'create_threads')
    );
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

-- ------------------------------------------------------ channel visibility

-- One line, and with it every policy that already read this function — posts,
-- reactions, storage, the channel list — starts asking the resolver instead of
-- re-deriving tier and role access for itself. The four copies of that logic
-- this replaces are the reason channel access could drift between surfaces.
create or replace function public.can_view_channel(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select public.community_has('view_channel', target_channel_id);
$$;

revoke execute on function public.can_view_channel(uuid) from public, anon;
grant execute on function public.can_view_channel(uuid) to authenticated, service_role;

-- The member's channel list. Keeps every column it had — the dashboard search
-- route reads `min_tier` and `is_locked` — and adds what the composer and the
-- channel header need. `has_unread` and `mention_count` are placeholders until
-- phase 8 builds read state; they are constants, not a guess.
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
  is_locked boolean,
  can_send boolean,
  slow_mode_seconds integer,
  permissions_synced boolean,
  unlock_tier integer,
  has_unread boolean,
  mention_count integer
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with visible as (
    select category.id as cat_id,
           category.name as cat_name,
           category.description as cat_description,
           category.sort_order as cat_sort_order,
           channel.id as ch_id,
           channel.name as ch_name,
           channel.type as ch_type,
           channel.description as ch_description,
           channel.sort_order as ch_sort_order,
           channel.min_tier as ch_min_tier,
           channel.slow_mode_seconds as ch_slow_mode,
           channel.permissions_synced as ch_synced,
           channel.visibility_mode as ch_visibility,
           public.community_permissions((select auth.uid()), channel.id) as perms,
           -- The lowest tier role an override lets in. Null when the channel is
           -- not tier-gated, which is what makes a locked teaser meaningful.
           (
             select min(substring(role.system_key from 6)::integer)
             from public.channel_permission_overrides override
             join public.community_roles role on role.id = override.role_id
             where role.system_key in ('tier_1', 'tier_2', 'tier_3', 'tier_4', 'tier_5')
               and 'view_channel' = any(override.allow)
               and (case when channel.permissions_synced
                         then override.category_id = channel.category_id
                         else override.channel_id = channel.id end)
           ) as ch_unlock_tier
    from public.channel_categories category
    join public.channels channel on channel.category_id = category.id
    where not category.is_archived and not channel.is_archived and channel.is_active
  )
  select cat_id, cat_name, cat_description, cat_sort_order,
         ch_id, ch_name, ch_type,
         case when 'view_channel' = any(perms) then ch_description else null end,
         ch_sort_order, ch_min_tier,
         not ('view_channel' = any(perms)),
         'send_messages' = any(perms),
         ch_slow_mode, ch_synced, ch_unlock_tier,
         false,
         0
  from visible
  -- A locked teaser is shown only where the channel says it wants to be seen
  -- and there is a tier that unlocks it. Everything else a member cannot view
  -- stays invisible rather than advertising itself.
  where 'view_channel' = any(perms)
     or (ch_visibility = 'locked' and ch_unlock_tier is not null)
  order by cat_sort_order, ch_sort_order;
$$;

revoke execute on function public.community_channel_directory() from public, anon;
grant execute on function public.community_channel_directory() to authenticated, service_role;

-- --------------------------------------------------------- the policy switch

-- Names are the contract: a test asserts `posts` carries exactly one INSERT
-- policy and that it is called `posts_member_insert`.

drop policy if exists posts_read on public.posts;
create policy posts_read
on public.posts
for select
to authenticated
using (not is_deleted and channel_id in (select public.community_visible_channel_ids()));

-- The change this whole phase exists for.
drop policy if exists posts_staff_insert on public.posts;
drop policy if exists posts_member_insert on public.posts;
create policy posts_member_insert
on public.posts
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and public.community_has('send_messages', channel_id)
);

drop policy if exists posts_author_or_staff_update on public.posts;
drop policy if exists posts_author_or_manager_update on public.posts;
create policy posts_author_or_manager_update
on public.posts
for update
to authenticated
using (
  public.community_has('view_channel', channel_id)
  and (
    author_id = (select auth.uid())
    or public.community_has('manage_messages', channel_id)
    or public.community_has('pin_messages', channel_id)
  )
)
-- A deleted row no longer has to be visible: hiding a message is the last write
-- anyone makes to it.
with check (is_deleted or public.community_has('view_channel', channel_id));

-- Which columns each of those may actually change stays with the trigger below;
-- row-level security cannot express "may flip the pin flag but not the body".
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

  -- Content belongs to its author. A moderator may hide or pin a message but
  -- never rewrite one, and `manage_messages` does not change that.
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
    if not public.community_has('pin_messages', old.channel_id) then
      raise exception 'You do not have permission to pin messages here.';
    end if;
    insert into public.community_moderation_events
      (post_id, channel_id, actor_id, subject_id, action)
    values (old.id, old.channel_id, actor, old.author_id,
            case when new.is_pinned then 'pin' else 'unpin' end);
  end if;

  if new.is_deleted and not old.is_deleted then
    if old.author_id is distinct from actor
       and not public.community_has('manage_messages', old.channel_id) then
      raise exception 'You do not have permission to delete this message.';
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
      and public.community_has('view_channel', post.channel_id)
      and (post.author_id = (select auth.uid()) or public.community_has('manage_messages', post.channel_id))
  ) then
    raise exception 'You do not have permission to delete this message.';
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

-- Channels and categories follow `manage_channels`. The two overlapping ALL
-- policies each table carried are collapsed into one: the advisor flagged them
-- as multiple permissive policies, and two policies that must agree are two
-- policies that can disagree.
drop policy if exists channels_read on public.channels;
drop policy if exists channels_influencer_write on public.channels;
drop policy if exists influencer_channels_manage on public.channels;
drop policy if exists channels_manager_write on public.channels;
drop policy if exists channels_manager_insert on public.channels;
drop policy if exists channels_manager_update on public.channels;
drop policy if exists channels_manager_delete on public.channels;

create policy channels_read
on public.channels
for select
to authenticated
using (public.community_has('view_channel', id) or public.community_has('manage_channels'));

-- Written out per command rather than `for all`: `for all` covers SELECT too,
-- so a write policy and a read policy become two permissive SELECT policies on
-- the same table and PostgreSQL evaluates both on every read. The advisor flags
-- it, and the pre-phase-3 policies had the same shape.
create policy channels_manager_insert
on public.channels for insert to authenticated
with check (public.community_has('manage_channels'));
create policy channels_manager_update
on public.channels for update to authenticated
using (public.community_has('manage_channels'))
with check (public.community_has('manage_channels'));
create policy channels_manager_delete
on public.channels for delete to authenticated
using (public.community_has('manage_channels'));

drop policy if exists channel_categories_read on public.channel_categories;
drop policy if exists channel_categories_influencer_write on public.channel_categories;
drop policy if exists channel_categories_manager_write on public.channel_categories;
drop policy if exists channel_categories_manager_insert on public.channel_categories;
drop policy if exists channel_categories_manager_update on public.channel_categories;
drop policy if exists channel_categories_manager_delete on public.channel_categories;

-- A category is a heading. Its name is already visible to anyone who can see
-- one channel inside it, so gating the read would only break the sidebar.
create policy channel_categories_read
on public.channel_categories
for select
to authenticated
using (true);

create policy channel_categories_manager_insert
on public.channel_categories for insert to authenticated
with check (public.community_has('manage_channels'));
create policy channel_categories_manager_update
on public.channel_categories for update to authenticated
using (public.community_has('manage_channels'))
with check (public.community_has('manage_channels'));
create policy channel_categories_manager_delete
on public.channel_categories for delete to authenticated
using (public.community_has('manage_channels'));

-- The audit log and the blocked word list stop being "staff" surfaces.
drop policy if exists community_moderation_events_staff_read on public.community_moderation_events;
drop policy if exists community_moderation_events_auditor_read on public.community_moderation_events;
create policy community_moderation_events_auditor_read
on public.community_moderation_events
for select
to authenticated
using (public.community_has('view_audit_log'));

drop policy if exists community_blocked_words_staff_read on public.community_blocked_words;
drop policy if exists community_blocked_words_influencer_write on public.community_blocked_words;
drop policy if exists community_blocked_words_manager_read on public.community_blocked_words;
drop policy if exists community_blocked_words_manager_write on public.community_blocked_words;
drop policy if exists community_blocked_words_manager_insert on public.community_blocked_words;
drop policy if exists community_blocked_words_manager_update on public.community_blocked_words;
drop policy if exists community_blocked_words_manager_delete on public.community_blocked_words;
create policy community_blocked_words_manager_read
on public.community_blocked_words
for select
to authenticated
using (public.community_has('manage_community'));

create policy community_blocked_words_manager_insert
on public.community_blocked_words for insert to authenticated
with check (public.community_has('manage_community'));
create policy community_blocked_words_manager_update
on public.community_blocked_words for update to authenticated
using (public.community_has('manage_community'))
with check (public.community_has('manage_community'));
create policy community_blocked_words_manager_delete
on public.community_blocked_words for delete to authenticated
using (public.community_has('manage_community'));

-- Attachments follow `attach_files` on the channel the file is destined for,
-- which is why the path carries the channel: `{uid}/{channel_id}/{file}`.
drop policy if exists community_posts_staff_upload on storage.objects;
drop policy if exists community_posts_member_upload on storage.objects;
create policy community_posts_member_upload
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'community-posts'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.community_has('attach_files', nullif((storage.foldername(name))[2], '')::uuid)
);

drop policy if exists community_posts_staff_delete on storage.objects;
drop policy if exists community_posts_owner_or_manager_delete on storage.objects;
create policy community_posts_owner_or_manager_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'community-posts'
  and (
    owner_id = (select auth.uid())::text
    or public.community_has('manage_messages', nullif((storage.foldername(name))[2], '')::uuid)
  )
);

-- ------------------------------------------------------- content enforcement

-- Slow mode reads the channel now, and the staff exemption becomes an explicit
-- permission. `bypass_slowmode` is the grant; holding a platform role is not.
create or replace function private.assert_post_content_allowed()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  rules public.community_settings%rowtype;
  author_is_owner boolean;
  mention text;
  last_post timestamptz;
  matched text;
  channel_slow_mode integer;
begin
  select * into rules from public.community_settings limit 1;
  if not found then
    return new;
  end if;

  if char_length(coalesce(new.body, '')) > 10000 then
    raise exception 'Messages are limited to 10,000 characters here.';
  end if;

  -- Only when there is a session to attribute the write to. A service-role
  -- insert has no auth.uid() and would read false for every permission.
  if (select auth.uid()) is not null then
    mention := public.community_mention_kind(new.body);
    if mention = 'all' and not public.community_has('mention_everyone', new.channel_id) then
      raise exception 'You do not have permission to mention everyone here.';
    end if;
    if mention = 'tier' and not public.community_has('mention_roles', new.channel_id) then
      raise exception 'You do not have permission to mention a tier here.';
    end if;
  end if;

  -- The blocked-word and edit-window exemptions are the owner's alone now. A
  -- moderator is a member with permissions, not a person the rules skip.
  select exists (
    select 1 from public.profiles
    where id = new.author_id and platform_role in ('influencer', 'super_admin')
  ) into author_is_owner;

  if coalesce(new.body, '') <> '' and not author_is_owner then
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

  select slow_mode_seconds into channel_slow_mode from public.channels where id = new.channel_id;

  if tg_op = 'INSERT'
     and coalesce(channel_slow_mode, 0) > 0
     and new.author_id is not null
     and not public.community_has('bypass_slowmode', new.channel_id) then
    perform pg_advisory_xact_lock(hashtext(new.channel_id::text || ':' || new.author_id::text));

    select max(created_at) into last_post
    from public.posts
    where channel_id = new.channel_id and author_id = new.author_id and not is_deleted;

    if last_post is not null and now() < last_post + make_interval(secs => channel_slow_mode) then
      raise exception 'Slow mode is on here. You can post again in % seconds.',
        ceil(extract(epoch from (last_post + make_interval(secs => channel_slow_mode)) - now()));
    end if;
  end if;

  if tg_op = 'UPDATE'
     and rules.edit_window_minutes > 0
     and not author_is_owner
     and new.body is distinct from old.body
     and old.created_at < now() - make_interval(mins => rules.edit_window_minutes) then
    raise exception 'Messages can only be edited within % minutes of posting.', rules.edit_window_minutes;
  end if;

  return new;
end;
$$;

-- Every definer function this migration recreates, restated. `create or replace`
-- keeps the existing ACL, so these are already closed on this database — but a
-- migration that recreates a function and does not say who may execute it is a
-- migration that opens one the day it is replayed onto a fresh project.
revoke execute on function public.guard_post_update() from public, anon, authenticated;
revoke execute on function private.assert_post_content_allowed() from public, anon, authenticated;
revoke execute on function public.soft_delete_post(uuid, text) from public, anon;
grant execute on function public.soft_delete_post(uuid, text) to authenticated, service_role;

-- ------------------------------------------------------------ override RPCs

create or replace function public.community_override_set(
  target_kind text,
  target_id uuid,
  role_id uuid,
  allow_keys text[] default '{}'::text[],
  deny_keys text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  actor_perms text[];
  actor_ceiling integer;
  subject public.community_roles%rowtype;
  clean_allow text[];
  clean_deny text[];
  saved uuid;
begin
  actor_perms := public.community_permissions(actor);
  if not ('manage_channels' = any(actor_perms) or 'administrator' = any(actor_perms)) then
    raise exception 'You do not have permission to change channel permissions.';
  end if;
  if target_kind not in ('channel', 'category') then
    raise exception 'An override applies to a channel or a category.';
  end if;

  select * into subject from public.community_roles where id = community_override_set.role_id;
  if not found then
    raise exception 'That role no longer exists.';
  end if;

  actor_ceiling := public.community_highest_position(actor);
  if not ('administrator' = any(actor_perms))
     and subject.system_key is distinct from 'everyone'
     and subject."position" >= actor_ceiling then
    raise exception 'You can only change permissions for roles below your own highest role.';
  end if;

  clean_allow := array(
    select catalog.key
    from unnest(public.community_channel_permission_keys()) with ordinality as catalog(key, ord)
    where catalog.key = any(coalesce(allow_keys, '{}'::text[]))
    order by catalog.ord
  );
  clean_deny := array(
    select catalog.key
    from unnest(public.community_channel_permission_keys()) with ordinality as catalog(key, ord)
    where catalog.key = any(coalesce(deny_keys, '{}'::text[]))
      and not (catalog.key = any(clean_allow))
    order by catalog.ord
  );

  -- Allowing a permission you do not hold would let `manage_channels` mint any
  -- grant it liked, one channel at a time.
  if not ('administrator' = any(actor_perms)) and not (clean_allow <@ actor_perms) then
    raise exception 'You can only allow permissions you hold yourself.';
  end if;

  -- An all-Neutral row is the absence of an override, not a row full of empty
  -- arrays: leaving it behind would make "does this channel override anything"
  -- unanswerable from the table.
  if cardinality(clean_allow) = 0 and cardinality(clean_deny) = 0 then
    delete from public.channel_permission_overrides
    where role_id = community_override_set.role_id
      and (case when target_kind = 'channel' then channel_id = target_id else category_id = target_id end);
    return null;
  end if;

  if target_kind = 'channel' then
    insert into public.channel_permission_overrides (channel_id, role_id, allow, deny, updated_by)
    values (target_id, community_override_set.role_id, clean_allow, clean_deny, actor)
    on conflict (channel_id, role_id) where channel_id is not null
    do update set allow = excluded.allow, deny = excluded.deny, updated_by = excluded.updated_by
    returning id into saved;

    -- Writing a channel's own override is what unsyncs it from its category.
    update public.channels set permissions_synced = false where id = target_id;
  else
    insert into public.channel_permission_overrides (category_id, role_id, allow, deny, updated_by)
    values (target_id, community_override_set.role_id, clean_allow, clean_deny, actor)
    on conflict (category_id, role_id) where category_id is not null
    do update set allow = excluded.allow, deny = excluded.deny, updated_by = excluded.updated_by
    returning id into saved;
  end if;

  return saved;
end;
$$;

create or replace function public.community_override_delete(override_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.community_has('manage_channels') then
    raise exception 'You do not have permission to change channel permissions.';
  end if;
  delete from public.channel_permission_overrides where id = override_id;
end;
$$;

create or replace function public.community_channel_sync_permissions(channel_id uuid, synced boolean)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.community_has('manage_channels') then
    raise exception 'You do not have permission to change channel permissions.';
  end if;

  -- Re-syncing discards the channel's own rules. Leaving them behind would mean
  -- a channel that reads as "follows the category" while carrying overrides
  -- that come back the moment it is unsynced again.
  if synced then
    delete from public.channel_permission_overrides override
    where override.channel_id = community_channel_sync_permissions.channel_id;
  end if;

  update public.channels
  set permissions_synced = synced
  where id = community_channel_sync_permissions.channel_id;
end;
$$;

create or replace function public.community_channel_set_slow_mode(channel_id uuid, seconds integer)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.community_has('manage_channels') then
    raise exception 'You do not have permission to change this channel.';
  end if;
  if seconds is null or seconds < 0 or seconds > 21600 then
    raise exception 'Slow mode must be between 0 seconds (off) and 6 hours.';
  end if;

  update public.channels
  set slow_mode_seconds = seconds
  where id = community_channel_set_slow_mode.channel_id;
end;
$$;

revoke execute on function public.community_override_set(text, uuid, uuid, text[], text[]) from public, anon;
revoke execute on function public.community_override_delete(uuid) from public, anon;
revoke execute on function public.community_channel_sync_permissions(uuid, boolean) from public, anon;
revoke execute on function public.community_channel_set_slow_mode(uuid, integer) from public, anon;

grant execute on function public.community_override_set(text, uuid, uuid, text[], text[]) to authenticated, service_role;
grant execute on function public.community_override_delete(uuid) to authenticated, service_role;
grant execute on function public.community_channel_sync_permissions(uuid, boolean) to authenticated, service_role;
grant execute on function public.community_channel_set_slow_mode(uuid, integer) to authenticated, service_role;

-- ------------------------------------------------------------------- RLS

alter table public.channel_permission_overrides enable row level security;

-- Read-only, and only to someone who manages channels. The four RPCs above are
-- the only writers.
drop policy if exists channel_permission_overrides_read on public.channel_permission_overrides;
create policy channel_permission_overrides_read
on public.channel_permission_overrides
for select
to authenticated
using (public.community_has('manage_channels'));

revoke insert, update, delete, truncate on public.channel_permission_overrides from anon, authenticated;
grant select on public.channel_permission_overrides to authenticated;
grant all on public.channel_permission_overrides to service_role;

-- --------------------------------------------------------- schema cache

-- PostgREST caches the schema, and a migration that adds columns or a table can
-- leave it serving the old shape: the column exists in PostgreSQL and the API
-- still answers "column does not exist". That is exactly what happened after
-- this migration was first applied — `/creator/settings` threw "Unable to load
-- channel structure." while the same query succeeded against the database.
notify pgrst, 'reload schema';
