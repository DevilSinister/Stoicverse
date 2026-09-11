-- Roles become the community's permission system.
--
-- Until now a role was a coloured badge with a seven-key grants-only jsonb,
-- and "who may do what" was answered by platform_role. This migration makes
-- roles the answer: a stacked hierarchy ordered by `position`, a 24-key
-- permission vocabulary held as a text[], and one resolver — public.
-- community_permissions — that every policy, RPC and page reads.
--
-- Provably a no-op on the data as it stands, verified live before applying:
-- one cosmetic role ("New Commers", priority 0, permission_config {}), zero
-- assignments, zero moderators, one influencer, two active memberships. Every
-- capability anyone holds today is reproduced by the seeded roles below, so
-- nobody gains or loses a permission on apply.
--
-- What this migration deliberately does NOT do: change a single policy on
-- `posts`. Members still cannot post, because `posts_staff_insert` is still
-- the only INSERT policy. Swapping it for a permission-driven one is phase 3,
-- on its own, where it can be verified in isolation.

-- ----------------------------------------------------------------- pre-flight

do $$
declare
  role_count integer;
  assignment_count integer;
  moderator_count integer;
begin
  select count(*) into role_count from public.cosmetic_roles;
  if role_count <> 1 then
    raise exception 'pre-flight: expected exactly one cosmetic role, found %. The position backfill below assumes it.', role_count;
  end if;

  select count(*) into assignment_count from public.cosmetic_role_assignments;
  if assignment_count <> 0 then
    raise exception 'pre-flight: expected no role assignments, found %. Manual assignments would survive as source=manual and were not reviewed.', assignment_count;
  end if;

  if exists (
    select 1
    from public.cosmetic_roles role, lateral jsonb_object_keys(role.permission_config) as entry(config_key)
    where entry.config_key not in (
      'post', 'pin', 'delete_others', 'manage_channels', 'mention_all', 'mention_tier', 'bypass_slow_mode'
    )
  ) then
    raise exception 'pre-flight: a role carries a permission key outside the legacy seven; the conversion map below would drop it silently';
  end if;

  select count(*) into moderator_count from public.profiles where platform_role = 'moderator';
  raise notice 'pre-flight: % moderator(s) will be seeded into the moderator system role', moderator_count;
end $$;

-- ------------------------------------------------------- permission vocabulary

-- The one list. `src/lib/community-settings/permissions.ts` mirrors it and a
-- contract test parses this literal and asserts the two are equal, element for
-- element, in order. A key in one and not the other is a grant that silently
-- never applies.
create or replace function public.community_permission_keys()
returns text[]
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select array[
    -- community-scoped — never overridable per channel
    'administrator',
    'manage_community',
    'manage_roles',
    'manage_emojis',
    'view_audit_log',
    'moderate_members',
    'ban_members',
    -- channel-scoped — overridable, also valid as a base grant
    'view_channel',
    'read_message_history',
    'send_messages',
    'send_messages_in_threads',
    'create_threads',
    'manage_threads',
    'manage_messages',
    'pin_messages',
    'manage_channels',
    'manage_events',
    'embed_links',
    'attach_files',
    'add_reactions',
    'use_custom_emojis',
    'mention_everyone',
    'mention_roles',
    'bypass_slowmode'
  ]::text[];
$$;

create or replace function public.community_channel_permission_keys()
returns text[]
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select array[
    'view_channel',
    'read_message_history',
    'send_messages',
    'send_messages_in_threads',
    'create_threads',
    'manage_threads',
    'manage_messages',
    'pin_messages',
    'manage_channels',
    'manage_events',
    'embed_links',
    'attach_files',
    'add_reactions',
    'use_custom_emojis',
    'mention_everyone',
    'mention_roles',
    'bypass_slowmode'
  ]::text[];
$$;

revoke execute on function public.community_permission_keys() from public, anon;
revoke execute on function public.community_channel_permission_keys() from public, anon;
grant execute on function public.community_permission_keys() to authenticated, service_role;
grant execute on function public.community_channel_permission_keys() to authenticated, service_role;

-- ------------------------------------------------------------------- rename

-- Guarded on relkind, not on existence: after the compat views below are
-- created, `cosmetic_roles` exists again as a view and a bare to_regclass
-- check would read as "already renamed" on a re-run and skip the rest.
do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'cosmetic_roles' and c.relkind = 'r'
  ) then
    alter table public.cosmetic_roles rename to community_roles;
    alter table public.cosmetic_role_assignments rename to community_role_members;

    alter index cosmetic_roles_name_unique_idx rename to community_roles_name_unique_idx;
    alter index cosmetic_roles_created_by_idx rename to community_roles_created_by_idx;
    alter index cosmetic_role_assignments_user_idx rename to community_role_members_user_idx;
    alter index cosmetic_role_assignments_assigned_by_idx rename to community_role_members_assigned_by_idx;
    alter trigger cosmetic_roles_set_updated_at on public.community_roles rename to community_roles_set_updated_at;
  end if;
end $$;

-- Ordering is by position now, and the old index is on a column about to go.
drop index if exists cosmetic_roles_priority_idx;

-- ------------------------------------------------------------------ columns

alter table public.community_roles
  add column if not exists "position" integer,
  add column if not exists hoist boolean not null default false,
  add column if not exists mentionable boolean not null default false,
  add column if not exists icon_emoji text,
  add column if not exists icon_path text,
  add column if not exists permissions text[] not null default '{}'::text[],
  add column if not exists system_key text,
  add column if not exists updated_by uuid references public.profiles(id);

-- System roles are created by the platform, not by a person. The column was
-- NOT NULL because every role used to be hand-made by the influencer.
alter table public.community_roles alter column created_by drop not null;

alter table public.community_role_members
  add column if not exists source text not null default 'manual';

-- A tier or moderator assignment is made by a trigger, which has no actor.
alter table public.community_role_members alter column assigned_by drop not null;

-- The legacy grants map onto the new vocabulary one-for-one. Runs before the
-- jsonb column is dropped; a no-op here today because no role carries a grant.
update public.community_roles
set permissions = array_remove(array[
    case when (permission_config ->> 'post') = 'true' then 'send_messages' end,
    case when (permission_config ->> 'pin') = 'true' then 'pin_messages' end,
    case when (permission_config ->> 'delete_others') = 'true' then 'manage_messages' end,
    case when (permission_config ->> 'manage_channels') = 'true' then 'manage_channels' end,
    case when (permission_config ->> 'mention_all') = 'true' then 'mention_everyone' end,
    case when (permission_config ->> 'mention_tier') = 'true' then 'mention_roles' end,
    case when (permission_config ->> 'bypass_slow_mode') = 'true' then 'bypass_slowmode' end
  ]::text[], null)
where permission_config is not null and permission_config <> '{}'::jsonb;

-- Positions 0-6 are reserved for the system roles seeded below, so every
-- hand-made role starts above them, highest priority first.
with ranked as (
  select id, 6 + row_number() over (order by priority desc, lower(name)) as slot
  from public.community_roles
  where system_key is null and "position" is null
)
update public.community_roles role
set "position" = ranked.slot
from ranked
where ranked.id = role.id;

alter table public.community_roles drop constraint if exists cosmetic_roles_permission_config_valid;
alter table public.community_roles drop column if exists permission_config;
alter table public.community_roles drop column if exists priority;
drop function if exists public.is_valid_permission_config(jsonb);

-- ------------------------------------------------------------- constraints

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'community_roles_permissions_known') then
    alter table public.community_roles
      add constraint community_roles_permissions_known
      check (permissions <@ public.community_permission_keys());
  end if;

  if not exists (select 1 from pg_constraint where conname = 'community_roles_system_key_known') then
    alter table public.community_roles
      add constraint community_roles_system_key_known
      check (system_key is null or system_key in (
        'everyone', 'tier_1', 'tier_2', 'tier_3', 'tier_4', 'tier_5', 'moderator'
      ));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'community_roles_system_key_unique') then
    alter table public.community_roles add constraint community_roles_system_key_unique unique (system_key);
  end if;

  -- One icon or the other, never both: two icons means the renderer picks, and
  -- which one it picks becomes an accident of column order.
  if not exists (select 1 from pg_constraint where conname = 'community_roles_single_icon') then
    alter table public.community_roles
      add constraint community_roles_single_icon
      check (icon_emoji is null or icon_path is null);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'community_roles_icon_emoji_shape') then
    alter table public.community_roles
      add constraint community_roles_icon_emoji_shape
      check (icon_emoji is null or char_length(icon_emoji) between 1 and 16);
  end if;

  -- Deferrable, because a reorder is one UPDATE that necessarily passes
  -- through states where two roles share a position.
  if not exists (select 1 from pg_constraint where conname = 'community_roles_position_unique') then
    alter table public.community_roles
      add constraint community_roles_position_unique unique ("position") deferrable initially deferred;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'community_role_members_source_known') then
    alter table public.community_role_members
      add constraint community_role_members_source_known check (source in ('manual', 'system'));
  end if;
end $$;

create index if not exists community_roles_position_idx on public.community_roles ("position" desc);
create index if not exists community_role_members_role_idx on public.community_role_members (role_id);
-- Every foreign key in this schema carries a covering index: without one,
-- deleting a profile sequentially scans this table to check the reference.
create index if not exists community_roles_updated_by_idx on public.community_roles (updated_by);

-- --------------------------------------------------------- normalisation

-- Dedupe and sort into catalog order, so two roles holding the same grants
-- compare equal as arrays and a diff in the audit log is readable.
create or replace function private.normalize_role_permissions()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  new.permissions := array(
    select catalog.key
    from unnest(public.community_permission_keys()) with ordinality as catalog(key, ord)
    where catalog.key = any(coalesce(new.permissions, '{}'::text[]))
    order by catalog.ord
  );

  -- @everyone with administrator is every member an owner. The tier roles are
  -- assigned by trigger from a member's paid tier, so the same applies there.
  if new.system_key in ('everyone', 'tier_1', 'tier_2', 'tier_3', 'tier_4', 'tier_5')
     and 'administrator' = any(new.permissions) then
    raise exception 'Administrator cannot be granted to % - it is assigned automatically.', new.name;
  end if;

  new.name := btrim(new.name);
  return new;
end;
$$;

drop trigger if exists community_roles_normalize on public.community_roles;
create trigger community_roles_normalize
before insert or update on public.community_roles
for each row execute function private.normalize_role_permissions();

-- ------------------------------------------------------------------- seeds

-- Idempotent. @everyone and the tier roles have their grants restated on every
-- run because those are the platform's to define, not the owner's to edit.
insert into public.community_roles (name, color, "position", hoist, mentionable, system_key, permissions)
values
  ('@everyone', '#94A3B8', 0, false, false, 'everyone',
   array['view_channel', 'read_message_history', 'add_reactions', 'use_custom_emojis']),
  ('Tier 1',    '#94A3B8', 1, false, true,  'tier_1', '{}'),
  ('Tier 2',    '#38BDF8', 2, false, true,  'tier_2', '{}'),
  ('Tier 3',    '#2DD4BF', 3, false, true,  'tier_3', '{}'),
  ('Tier 4',    '#A78BFA', 4, false, true,  'tier_4', '{}'),
  ('Master',    '#C8A24A', 5, true,  true,  'tier_5', '{}'),
  -- No mention_everyone, no manage_channels, no ban_members: @everyone reaches
  -- every member at once, channel management reshapes what everyone sees, and
  -- a ban ends someone's access to something they paid for. All three are the
  -- influencer's to grant explicitly.
  ('Moderator', '#FB923C', 6, true,  true,  'moderator',
   array['send_messages', 'send_messages_in_threads', 'create_threads', 'manage_threads',
         'manage_messages', 'pin_messages', 'moderate_members', 'view_audit_log',
         'mention_roles', 'bypass_slowmode', 'embed_links', 'attach_files', 'use_custom_emojis'])
on conflict (system_key) do update
set name = excluded.name,
    "position" = excluded."position",
    hoist = excluded.hoist,
    mentionable = excluded.mentionable,
    permissions = excluded.permissions;

alter table public.community_roles alter column "position" set not null;

-- --------------------------------------------------- automatic membership

-- A member's tier role follows their paid tier. Note this trigger cannot fire
-- on the passage of time: an expired membership keeps its tier role until the
-- row changes. That is harmless because community_permissions independently
-- requires an active, unexpired membership before any role is read.
create or replace function private.apply_tier_roles(target uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  wanted text;
begin
  select case when coalesce(tier.is_master, false) then 'tier_5' else 'tier_' || tier.current_tier end
  into wanted
  from public.member_tiers tier
  where tier.user_id = target;

  if not exists (
    select 1 from public.memberships membership
    where membership.user_id = target
      and membership.status = 'active'
      and (membership.expires_at is null or membership.expires_at > now())
  ) then
    wanted := null;
  end if;

  delete from public.community_role_members assignment
  using public.community_roles role
  where assignment.role_id = role.id
    and assignment.user_id = target
    and role.system_key in ('tier_1', 'tier_2', 'tier_3', 'tier_4', 'tier_5')
    and (wanted is null or role.system_key <> wanted);

  if wanted is not null then
    insert into public.community_role_members (role_id, user_id, assigned_by, source)
    select role.id, target, null, 'system'
    from public.community_roles role
    where role.system_key = wanted
    on conflict (role_id, user_id) do nothing;
  end if;
end;
$$;

create or replace function private.sync_tier_role_membership()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform private.apply_tier_roles(new.user_id);
  return new;
end;
$$;

create or replace function private.sync_moderator_role_membership()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.platform_role = 'moderator' and not new.is_suspended then
    insert into public.community_role_members (role_id, user_id, assigned_by, source)
    select role.id, new.id, null, 'system'
    from public.community_roles role
    where role.system_key = 'moderator'
    on conflict (role_id, user_id) do nothing;
  else
    delete from public.community_role_members assignment
    using public.community_roles role
    where assignment.role_id = role.id
      and assignment.user_id = new.id
      and role.system_key = 'moderator';
  end if;
  return new;
end;
$$;

drop trigger if exists member_tiers_sync_role on public.member_tiers;
create trigger member_tiers_sync_role
after insert or update of current_tier, is_master on public.member_tiers
for each row execute function private.sync_tier_role_membership();

drop trigger if exists memberships_sync_role on public.memberships;
create trigger memberships_sync_role
after insert or update of status, expires_at on public.memberships
for each row execute function private.sync_tier_role_membership();

drop trigger if exists profiles_sync_moderator_role on public.profiles;
create trigger profiles_sync_moderator_role
after insert or update of platform_role, is_suspended on public.profiles
for each row execute function private.sync_moderator_role_membership();

-- Backfill both, then assert the counts agree with the source of truth.
do $$
declare
  expected_tiers integer;
  actual_tiers integer;
  expected_moderators integer;
  actual_moderators integer;
begin
  perform private.apply_tier_roles(profile.id) from public.profiles profile;

  insert into public.community_role_members (role_id, user_id, assigned_by, source)
  select role.id, profile.id, null, 'system'
  from public.profiles profile
  cross join public.community_roles role
  where role.system_key = 'moderator'
    and profile.platform_role = 'moderator'
    and not profile.is_suspended
  on conflict (role_id, user_id) do nothing;

  select count(*) into expected_tiers
  from public.member_tiers tier
  join public.memberships membership on membership.user_id = tier.user_id
  where membership.status = 'active'
    and (membership.expires_at is null or membership.expires_at > now());

  select count(*) into actual_tiers
  from public.community_role_members assignment
  join public.community_roles role on role.id = assignment.role_id
  where role.system_key in ('tier_1', 'tier_2', 'tier_3', 'tier_4', 'tier_5');

  if expected_tiers <> actual_tiers then
    raise exception 'post-check: % members hold an active membership and a tier, but % tier role rows exist', expected_tiers, actual_tiers;
  end if;

  select count(*) into expected_moderators from public.profiles where platform_role = 'moderator' and not is_suspended;
  select count(*) into actual_moderators
  from public.community_role_members assignment
  join public.community_roles role on role.id = assignment.role_id
  where role.system_key = 'moderator';

  if expected_moderators <> actual_moderators then
    raise exception 'post-check: % active moderators, but % moderator role rows exist', expected_moderators, actual_moderators;
  end if;
end $$;

-- --------------------------------------------------------------- the gate

-- Phase 2 shape. Suspension is the only state that exists yet; `banned` and
-- `timeout` join it in phase 4, `rules`, `verification` and `lockdown` in
-- phase 7. community_permissions already branches on all of them, so those
-- phases add rows and states, not a second copy of this logic.
create or replace function private.community_gate(target uuid)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select case
    when exists (select 1 from public.profiles where id = target and is_suspended) then 'suspended'
  end;
$$;

-- ------------------------------------------------------------- the resolver

-- The single answer to "what may this person do, here". Every policy, RPC and
-- server page reads it; `src/lib/community-settings/permissions.ts` mirrors the
-- precedence for the settings interface, and a unit test pins the two together.
--
-- Not granted to `authenticated`: it takes an arbitrary subject, and a member
-- asking what a stranger may do would learn their membership state. The
-- authenticated surface is community_has and community_my_permissions, which
-- are definer functions and so may call this one.
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
  if channel_row.is_archived and not ('manage_channels' = any(base)) then
    return '{}'::text[];
  end if;

  -- Channel and category overrides are applied here in phase 3, between the
  -- base union and the view_channel test, in the order @everyone deny,
  -- @everyone allow, role denies, role allows.
  perms := base;

  if not ('view_channel' = any(perms)) then
    return '{}'::text[];
  end if;

  -- The rules channel type arrives with phase 3; this branch is unreachable
  -- until then and is written now so the SQL and the TypeScript resolver do
  -- not have to be changed together later.
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

create or replace function public.community_has(permission text, channel uuid default null)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(permission = any(public.community_permissions((select auth.uid()), channel)), false);
$$;

create or replace function public.community_my_permissions(channel uuid default null)
returns text[]
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select public.community_permissions((select auth.uid()), channel);
$$;

-- Hierarchy in one number. The influencer is above every role that can exist,
-- which is why this returns the integer ceiling rather than a role's position.
create or replace function public.community_highest_position(target uuid)
returns integer
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select case
    when exists (
      select 1 from public.profiles
      where id = target and platform_role in ('influencer', 'super_admin') and not is_suspended
    ) then 2147483647
    else coalesce((
      select max(role."position")
      from public.community_role_members assignment
      join public.community_roles role on role.id = assignment.role_id
      where assignment.user_id = target
    ), 0)
  end;
$$;

-- Prepared for phase 3, where it becomes the `posts_read` predicate. Nothing
-- reads it yet.
create or replace function public.community_visible_channel_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select channel.id
  from public.channels channel
  where 'view_channel' = any(public.community_permissions((select auth.uid()), channel.id));
$$;

create or replace function public.community_access_state()
returns table (state text, reason text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(private.community_gate((select auth.uid())), 'ok'), null::text;
$$;

-- The legacy seven, mapped onto the new vocabulary. Kept until phase 6 so
-- private.assert_post_content_allowed — the only caller — does not have to
-- change in the same migration that changes what it is asking about.
create or replace function public.community_grant(grant_key text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(public.community_has(case grant_key
    when 'post' then 'send_messages'
    when 'pin' then 'pin_messages'
    when 'delete_others' then 'manage_messages'
    when 'manage_channels' then 'manage_channels'
    when 'mention_all' then 'mention_everyone'
    when 'mention_tier' then 'mention_roles'
    when 'bypass_slow_mode' then 'bypass_slowmode'
  end), false);
$$;

-- Both PUBLIC and anon, every time. Revoking PUBLIC alone leaves the grant
-- Supabase's ALTER DEFAULT PRIVILEGES makes directly to anon on every new
-- function in `public`; revoking anon alone leaves the PUBLIC grant
-- PostgreSQL makes by default. The security advisor found all fourteen of
-- these callable by anon over /rest/v1/rpc when only PUBLIC was revoked.
revoke execute on function public.community_permissions(uuid, uuid) from public, anon;
-- The resolver takes an arbitrary subject: asking it about a stranger's uuid
-- reveals their membership state. community_has and community_my_permissions
-- are the signed-in surface and, being definer, reach it regardless.
revoke execute on function public.community_permissions(uuid, uuid) from authenticated;
revoke execute on function public.community_has(text, uuid) from public, anon;
revoke execute on function public.community_my_permissions(uuid) from public, anon;
revoke execute on function public.community_highest_position(uuid) from public, anon;
revoke execute on function public.community_visible_channel_ids() from public, anon;
revoke execute on function public.community_access_state() from public, anon;
revoke execute on function public.community_grant(text) from public, anon;
revoke execute on function private.normalize_role_permissions() from public, anon, authenticated;
revoke execute on function private.sync_tier_role_membership() from public, anon, authenticated;
revoke execute on function private.sync_moderator_role_membership() from public, anon, authenticated;
revoke execute on function private.community_gate(uuid) from public, anon, authenticated;
revoke execute on function private.apply_tier_roles(uuid) from public, anon, authenticated;

grant execute on function public.community_permissions(uuid, uuid) to service_role;
grant execute on function public.community_has(text, uuid) to authenticated, service_role;
grant execute on function public.community_my_permissions(uuid) to authenticated, service_role;
grant execute on function public.community_highest_position(uuid) to authenticated, service_role;
grant execute on function public.community_visible_channel_ids() to authenticated, service_role;
grant execute on function public.community_access_state() to authenticated, service_role;
grant execute on function public.community_grant(text) to authenticated, service_role;

-- ---------------------------------------------------------------- role RPCs

-- Every one of these is the only way to write the tables: there are no DML
-- policies, so a direct insert from the browser fails regardless of what the
-- server action believes. The messages are P0001, which is this project's
-- passthrough channel for text written for the person reading it.

create or replace function public.community_role_save(
  role_id uuid,
  role_name text,
  role_color text,
  role_hoist boolean default false,
  role_mentionable boolean default false,
  role_icon_emoji text default null,
  role_icon_path text default null,
  role_permissions text[] default '{}'::text[]
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
  wanted text[];
  existing public.community_roles%rowtype;
  clean_name text := btrim(coalesce(role_name, ''));
  next_position integer;
  saved uuid;
begin
  if actor is null then
    raise exception 'Sign in to manage roles.';
  end if;

  actor_perms := public.community_permissions(actor);
  if not ('manage_roles' = any(actor_perms) or 'administrator' = any(actor_perms)) then
    raise exception 'You do not have permission to manage roles.';
  end if;
  actor_ceiling := public.community_highest_position(actor);

  if char_length(clean_name) < 2 or char_length(clean_name) > 32 then
    raise exception 'A role name must be between 2 and 32 characters.';
  end if;
  if role_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'A role colour must be a six-digit hex value, such as #10B981.';
  end if;

  wanted := array(
    select catalog.key
    from unnest(public.community_permission_keys()) with ordinality as catalog(key, ord)
    where catalog.key = any(coalesce(role_permissions, '{}'::text[]))
    order by catalog.ord
  );

  -- You cannot grant what you do not hold. Without this, manage_roles is
  -- administrator with an extra step.
  if not ('administrator' = any(actor_perms)) and not (wanted <@ actor_perms) then
    raise exception 'You can only grant permissions you hold yourself.';
  end if;

  if role_id is null then
    select coalesce(max("position"), 0) + 1 into next_position from public.community_roles;
    if not ('administrator' = any(actor_perms)) and next_position >= actor_ceiling then
      raise exception 'A new role would sit at or above your own highest role.';
    end if;

    insert into public.community_roles (name, color, "position", hoist, mentionable, icon_emoji, icon_path, permissions, created_by, updated_by)
    values (clean_name, upper(role_color), next_position, coalesce(role_hoist, false), coalesce(role_mentionable, false),
            nullif(btrim(coalesce(role_icon_emoji, '')), ''), nullif(btrim(coalesce(role_icon_path, '')), ''), wanted, actor, actor)
    returning id into saved;
    return saved;
  end if;

  select * into existing from public.community_roles where id = role_id;
  if not found then
    raise exception 'That role no longer exists.';
  end if;
  if existing.system_key is not null and existing.system_key <> 'everyone' then
    raise exception '% is assigned automatically and cannot be edited here.', existing.name;
  end if;
  if existing.system_key is null and existing."position" >= actor_ceiling then
    raise exception 'You can only edit roles below your own highest role.';
  end if;

  update public.community_roles
  set name = case when existing.system_key = 'everyone' then existing.name else clean_name end,
      color = upper(role_color),
      hoist = case when existing.system_key = 'everyone' then false else coalesce(role_hoist, false) end,
      mentionable = case when existing.system_key = 'everyone' then false else coalesce(role_mentionable, false) end,
      icon_emoji = nullif(btrim(coalesce(role_icon_emoji, '')), ''),
      icon_path = nullif(btrim(coalesce(role_icon_path, '')), ''),
      permissions = wanted,
      updated_by = actor
  where id = role_id;

  return role_id;
end;
$$;

create or replace function public.community_role_delete(role_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  actor_perms text[];
  existing public.community_roles%rowtype;
begin
  actor_perms := public.community_permissions(actor);
  if not ('manage_roles' = any(actor_perms) or 'administrator' = any(actor_perms)) then
    raise exception 'You do not have permission to manage roles.';
  end if;

  select * into existing from public.community_roles where id = role_id;
  if not found then
    raise exception 'That role no longer exists.';
  end if;
  if existing.system_key is not null then
    raise exception '% is part of the platform and cannot be deleted.', existing.name;
  end if;
  if not ('administrator' = any(actor_perms)) and existing."position" >= public.community_highest_position(actor) then
    raise exception 'You can only delete roles below your own highest role.';
  end if;

  delete from public.community_roles where id = role_id;
end;
$$;

-- One UPDATE, not N. The unique constraint on position is deferred precisely
-- so the intermediate states inside this statement are allowed to collide.
create or replace function public.community_roles_reorder(ordered uuid[])
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  actor_perms text[];
  actor_ceiling integer;
begin
  actor_perms := public.community_permissions(actor);
  if not ('manage_roles' = any(actor_perms) or 'administrator' = any(actor_perms)) then
    raise exception 'You do not have permission to manage roles.';
  end if;
  actor_ceiling := public.community_highest_position(actor);

  if ordered is null or cardinality(ordered) = 0 then
    raise exception 'Nothing to reorder.';
  end if;
  if exists (
    select 1 from public.community_roles
    where system_key is distinct from 'everyone' and id <> all(ordered)
  ) then
    raise exception 'Reorder every role at once, or positions will collide.';
  end if;
  if exists (select 1 from public.community_roles where system_key = 'everyone' and id = any(ordered)) then
    raise exception '@everyone is always the lowest role.';
  end if;

  if not ('administrator' = any(actor_perms)) and exists (
    select 1 from public.community_roles where id = any(ordered) and "position" >= actor_ceiling
  ) then
    raise exception 'You can only reorder roles below your own highest role.';
  end if;

  -- Ordered lowest-first, so index 1 lands at position 1 and @everyone keeps 0.
  update public.community_roles role
  set "position" = target.slot, updated_by = actor
  from (select id, ordinality::integer as slot from unnest(ordered) with ordinality as t(id, ordinality)) as target
  where role.id = target.id and role."position" is distinct from target.slot;
end;
$$;

create or replace function public.community_role_assign(role_id uuid, member_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  actor_perms text[];
  existing public.community_roles%rowtype;
begin
  actor_perms := public.community_permissions(actor);
  if not ('manage_roles' = any(actor_perms) or 'administrator' = any(actor_perms)) then
    raise exception 'You do not have permission to manage roles.';
  end if;

  select * into existing from public.community_roles where id = role_id;
  if not found then
    raise exception 'That role no longer exists.';
  end if;
  if existing.system_key in ('everyone', 'tier_1', 'tier_2', 'tier_3', 'tier_4', 'tier_5') then
    raise exception '% follows a member''s tier and cannot be assigned by hand.', existing.name;
  end if;
  if existing.system_key = 'moderator' then
    -- The moderator role mirrors platform_role, which has its own audited RPC.
    -- Two ways to make a moderator is two ways for them to disagree.
    perform public.set_member_platform_role(member_id, 'moderator');
    return;
  end if;
  if not ('administrator' = any(actor_perms)) and existing."position" >= public.community_highest_position(actor) then
    raise exception 'You can only assign roles below your own highest role.';
  end if;

  insert into public.community_role_members (role_id, user_id, assigned_by, source)
  values (role_id, member_id, actor, 'manual')
  on conflict (role_id, user_id) do nothing;
end;
$$;

create or replace function public.community_role_unassign(role_id uuid, member_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  actor_perms text[];
  existing public.community_roles%rowtype;
begin
  actor_perms := public.community_permissions(actor);
  if not ('manage_roles' = any(actor_perms) or 'administrator' = any(actor_perms)) then
    raise exception 'You do not have permission to manage roles.';
  end if;

  select * into existing from public.community_roles where id = role_id;
  if not found then
    raise exception 'That role no longer exists.';
  end if;
  if existing.system_key in ('everyone', 'tier_1', 'tier_2', 'tier_3', 'tier_4', 'tier_5') then
    raise exception '% follows a member''s tier and cannot be removed by hand.', existing.name;
  end if;
  if existing.system_key = 'moderator' then
    perform public.set_member_platform_role(member_id, 'member');
    return;
  end if;
  if not ('administrator' = any(actor_perms)) and existing."position" >= public.community_highest_position(actor) then
    raise exception 'You can only remove roles below your own highest role.';
  end if;

  -- Aliased and fully qualified: a bare `role_id` here is both the column and
  -- this function's parameter, which plpgsql refuses as 42702 rather than
  -- guessing.
  delete from public.community_role_members as assignment
  where assignment.role_id = community_role_unassign.role_id
    and assignment.user_id = member_id;
end;
$$;

-- Keyset pagination on (name, id): the member list under a role only grows,
-- and an OFFSET walk re-reads every row it has already skipped.
create or replace function public.community_role_members_page(
  role_id uuid,
  after_name text default null,
  after_id uuid default null,
  page_size integer default 51
)
returns table (id uuid, full_name text, normalized_name text, avatar_url text, source text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select profile.id,
         profile.full_name,
         lower(btrim(coalesce(profile.full_name, ''))) as normalized_name,
         profile.avatar_url,
         assignment.source
  from public.community_role_members assignment
  join public.profiles profile on profile.id = assignment.user_id
  where assignment.role_id = community_role_members_page.role_id
    and public.community_has('manage_roles')
    and (
      after_name is null
      or (lower(btrim(coalesce(profile.full_name, ''))), profile.id) > (after_name, after_id)
    )
  -- Spelled out rather than by alias: `normalized_name` is also one of this
  -- function's RETURNS TABLE output names, and those are in scope here.
  order by lower(btrim(coalesce(profile.full_name, ''))), profile.id
  limit least(greatest(page_size, 1), 51);
$$;

-- Candidates for the Manage Members tab.
--
-- Deliberately not `search_creator_members`, which is gated on is_influencer():
-- a moderator holding manage_roles may assign roles, so a search they cannot
-- run would leave them a tab that only ever says "no results". Returns members
-- and moderators only, never the influencer or another admin.
create or replace function public.community_role_member_candidates(
  query text default null,
  page_size integer default 20
)
returns table (id uuid, full_name text, avatar_url text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select profile.id, profile.full_name, profile.avatar_url
  from public.profiles profile
  where public.community_has('manage_roles')
    and profile.platform_role in ('member', 'moderator')
    and not profile.is_suspended
    and (
      nullif(btrim(query), '') is null
      or profile.full_name ilike ('%' || replace(replace(btrim(query), '%', '\%'), '_', '\_') || '%') escape '\'
    )
  order by lower(btrim(profile.full_name)), profile.id
  limit least(greatest(page_size, 1), 20);
$$;

revoke execute on function public.community_role_save(uuid, text, text, boolean, boolean, text, text, text[]) from public, anon;
revoke execute on function public.community_role_delete(uuid) from public, anon;
revoke execute on function public.community_roles_reorder(uuid[]) from public, anon;
revoke execute on function public.community_role_assign(uuid, uuid) from public, anon;
revoke execute on function public.community_role_unassign(uuid, uuid) from public, anon;
revoke execute on function public.community_role_members_page(uuid, text, uuid, integer) from public, anon;
revoke execute on function public.community_role_member_candidates(text, integer) from public, anon;

grant execute on function public.community_role_save(uuid, text, text, boolean, boolean, text, text, text[]) to authenticated, service_role;
grant execute on function public.community_role_delete(uuid) to authenticated, service_role;
grant execute on function public.community_roles_reorder(uuid[]) to authenticated, service_role;
grant execute on function public.community_role_assign(uuid, uuid) to authenticated, service_role;
grant execute on function public.community_role_unassign(uuid, uuid) to authenticated, service_role;
grant execute on function public.community_role_members_page(uuid, text, uuid, integer) to authenticated, service_role;
grant execute on function public.community_role_member_candidates(text, integer) to authenticated, service_role;

-- ------------------------------------------------------------------- RLS

drop policy if exists cosmetic_roles_member_read on public.community_roles;
drop policy if exists cosmetic_roles_creator_insert on public.community_roles;
drop policy if exists cosmetic_roles_creator_update on public.community_roles;
drop policy if exists cosmetic_roles_creator_delete on public.community_roles;
drop policy if exists cosmetic_role_assignments_member_read on public.community_role_members;
drop policy if exists cosmetic_role_assignments_creator_insert on public.community_role_members;
drop policy if exists cosmetic_role_assignments_creator_delete on public.community_role_members;

alter table public.community_roles enable row level security;
alter table public.community_role_members enable row level security;

-- Roles are the community's public vocabulary: their names and colours appear
-- beside every message, so gating the read would only break rendering.
drop policy if exists community_roles_read on public.community_roles;
create policy community_roles_read
on public.community_roles
for select
to authenticated
using (true);

-- Who holds what is not public. Anyone who can see a channel can see it.
drop policy if exists community_role_members_read on public.community_role_members;
create policy community_role_members_read
on public.community_role_members
for select
to authenticated
using (public.community_has('view_channel'));

-- No DML policies at all: the RPCs above are the only writers. The explicit
-- revoke is required regardless, because Supabase's default privileges grant
-- DML on every public table and absence of a policy is not absence of a grant.
revoke insert, update, delete, truncate on public.community_roles from anon, authenticated;
revoke insert, update, delete, truncate on public.community_role_members from anon, authenticated;
grant select on public.community_roles, public.community_role_members to authenticated;
grant all on public.community_roles, public.community_role_members to service_role;

-- --------------------------------------------------------- compatibility

-- Read-only projections under the old names, so the member workspace, the
-- account settings page and the creator member list keep working unchanged.
-- Dropped in phase 9, once every reader has moved.
drop view if exists public.cosmetic_roles;
create view public.cosmetic_roles
with (security_invoker = true) as
select id, name, color, "position" as priority, created_by, created_at, updated_at
from public.community_roles;

drop view if exists public.cosmetic_role_assignments;
create view public.cosmetic_role_assignments
with (security_invoker = true) as
select role_id, user_id, assigned_by, assigned_at
from public.community_role_members;

revoke all on public.cosmetic_roles from anon, authenticated;
revoke all on public.cosmetic_role_assignments from anon, authenticated;
grant select on public.cosmetic_roles, public.cosmetic_role_assignments to authenticated;
grant select on public.cosmetic_roles, public.cosmetic_role_assignments to service_role;

-- Same signature and same returned column names, on the new tables. The
-- `priority` key inside the returned jsonb is the role's position; it keeps its
-- old name because the member directory reads it and that layer moves in phase 9.
create or replace function public.search_creator_members(
  search_text text default null,
  status_filter text default null,
  tier_filter integer default null,
  platform_role_filter text default null,
  cosmetic_role_filter uuid default null,
  after_name text default null,
  after_id uuid default null,
  page_size integer default 51
)
returns table (
  id uuid,
  full_name text,
  normalized_name text,
  platform_role text,
  is_suspended boolean,
  created_at timestamptz,
  membership_status text,
  joined_at timestamptz,
  expires_at timestamptz,
  current_tier integer,
  is_master boolean,
  cosmetic_roles jsonb,
  current_week_turnover numeric,
  all_time_turnover numeric
)
language sql
stable
set search_path to ''
as $$
  with candidates as (
    select
      profile.id,
      profile.full_name,
      profile.platform_role,
      profile.is_suspended,
      profile.created_at,
      membership.joined_at,
      membership.expires_at,
      coalesce(tier.current_tier, 1) as current_tier,
      coalesce(tier.is_master, false) as is_master,
      case
        when profile.is_suspended then 'suspended'
        when membership.status = 'active'
          and (membership.expires_at is null or membership.expires_at > now())
          and membership.access_source = 'gifted' then 'gifted'
        when membership.status = 'active'
          and (membership.expires_at is null or membership.expires_at > now()) then 'active'
        when membership.status in ('cancelled', 'refunded')
          or (membership.status = 'active' and membership.expires_at <= now()) then 'expired'
        else 'pending'
      end as membership_status,
      lower(btrim(coalesce(profile.full_name, ''))) as normalized_name
    from public.profiles profile
    left join public.memberships membership on membership.user_id = profile.id
    left join public.member_tiers tier on tier.user_id = profile.id
    where public.is_influencer()
      and profile.platform_role in ('member', 'moderator')
      and case
        when nullif(trim(search_text), '') is null then true
        when search_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then profile.id = search_text::uuid
        else profile.full_name ilike ('%' || replace(replace(trim(search_text), '%', '\%'), '_', '\_') || '%') escape '\'
      end
      and (tier_filter is null or coalesce(tier.current_tier, 1) = tier_filter)
      and (platform_role_filter is null or profile.platform_role = platform_role_filter)
      and (
        cosmetic_role_filter is null
        or exists (
          select 1 from public.community_role_members role_filter
          where role_filter.user_id = profile.id
            and role_filter.role_id = cosmetic_role_filter
        )
      )
  ), filtered as (
    select * from candidates
    where (status_filter is null or membership_status = status_filter)
      and (
        after_name is null
        or (normalized_name, id) > (after_name, after_id)
      )
  ), paged as (
    select * from filtered
    order by normalized_name, id
    limit least(greatest(page_size, 1), 51)
  )
  select
    paged.id,
    paged.full_name,
    paged.normalized_name,
    paged.platform_role,
    paged.is_suspended,
    paged.created_at,
    paged.membership_status,
    paged.joined_at,
    paged.expires_at,
    paged.current_tier,
    paged.is_master,
    coalesce(roles.items, '[]'::jsonb),
    coalesce(turnover.current_week, 0),
    coalesce(turnover.all_time, 0)
  from paged
  left join lateral (
    select jsonb_agg(
      jsonb_build_object('id', role.id, 'name', role.name, 'color', role.color, 'priority', role."position")
      order by role."position" desc, role.name
    ) as items
    from public.community_role_members assignment
    join public.community_roles role on role.id = assignment.role_id
    where assignment.user_id = paged.id
  ) roles on true
  left join lateral (
    select
      coalesce(sum(entry.amount_usd) filter (
        where entry.week_start = date_trunc('week', timezone('utc', now()))::date
      ), 0) as current_week,
      coalesce(sum(entry.amount_usd), 0) as all_time
    from public.member_weekly_turnover entry
    where entry.user_id = paged.id
  ) turnover on true
  order by paged.normalized_name, paged.id
$$;

-- ------------------------------------------------------------ role icons

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-role-icons', 'community-role-icons', true, 262144, array['image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists community_role_icons_read on storage.objects;
create policy community_role_icons_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'community-role-icons');

drop policy if exists community_role_icons_write on storage.objects;
create policy community_role_icons_write
on storage.objects
for insert
to authenticated
with check (bucket_id = 'community-role-icons' and public.community_has('manage_roles'));

drop policy if exists community_role_icons_replace on storage.objects;
create policy community_role_icons_replace
on storage.objects
for update
to authenticated
using (bucket_id = 'community-role-icons' and public.community_has('manage_roles'))
with check (bucket_id = 'community-role-icons' and public.community_has('manage_roles'));

drop policy if exists community_role_icons_delete on storage.objects;
create policy community_role_icons_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'community-role-icons' and public.community_has('manage_roles'));

-- --------------------------------------------------------- schema cache

-- PostgREST caches the schema, and a migration that adds columns or a table can
-- leave it serving the old shape: the column exists in PostgreSQL and the API
-- still answers "column does not exist". That is exactly what happened after
-- this migration was first applied — `/creator/settings` threw "Unable to load
-- channel structure." while the same query succeeded against the database.
notify pgrst, 'reload schema';
