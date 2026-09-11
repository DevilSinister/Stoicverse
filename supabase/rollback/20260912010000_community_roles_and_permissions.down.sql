-- Rollback for 20260912010000_community_roles_and_permissions.
--
-- DATA LOSS, stated plainly: this drops the six seeded system roles and every
-- assignment made through them, and it discards hoist, mentionable, the role
-- icons and the 24-key `permissions` array on every hand-made role. What it
-- restores is the legacy shape — name, colour, priority and the seven-key
-- `permission_config` — reconstructed from the new columns where a legacy
-- equivalent exists. Roles created after the migration keep their name, colour
-- and mapped grants; nothing else about them survives.
--
-- Run only while phase 3 has not been applied. Phase 3 builds channel
-- overrides and the posts policy switch on top of community_permissions, and
-- this script removes it.

do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'channel_permission_overrides'
  ) then
    raise exception 'refusing to roll back: phase 3 (channel_permission_overrides) is applied and depends on community_permissions';
  end if;
end $$;

-- ---------------------------------------------------------- storage policies

drop policy if exists community_role_icons_read on storage.objects;
drop policy if exists community_role_icons_write on storage.objects;
drop policy if exists community_role_icons_replace on storage.objects;
drop policy if exists community_role_icons_delete on storage.objects;
delete from storage.objects where bucket_id = 'community-role-icons';
delete from storage.buckets where id = 'community-role-icons';

-- ------------------------------------------------------------------- views

drop view if exists public.cosmetic_roles;
drop view if exists public.cosmetic_role_assignments;

-- --------------------------------------------------------------- functions

drop function if exists public.community_role_save(uuid, text, text, boolean, boolean, text, text, text[]);
drop function if exists public.community_role_delete(uuid);
drop function if exists public.community_roles_reorder(uuid[]);
drop function if exists public.community_role_assign(uuid, uuid);
drop function if exists public.community_role_unassign(uuid, uuid);
drop function if exists public.community_role_members_page(uuid, text, uuid, integer);
drop function if exists public.community_role_member_candidates(text, integer);
drop function if exists public.community_access_state();
drop function if exists public.community_visible_channel_ids();
drop function if exists public.community_highest_position(uuid);
drop function if exists public.community_my_permissions(uuid);
drop function if exists public.community_has(text, uuid);
drop function if exists public.community_permissions(uuid, uuid);
drop function if exists private.community_gate(uuid);

-- ---------------------------------------------------------------- triggers

drop trigger if exists member_tiers_sync_role on public.member_tiers;
drop trigger if exists memberships_sync_role on public.memberships;
drop trigger if exists profiles_sync_moderator_role on public.profiles;
drop trigger if exists community_roles_normalize on public.community_roles;
drop function if exists private.sync_tier_role_membership();
drop function if exists private.sync_moderator_role_membership();
drop function if exists private.apply_tier_roles(uuid);
drop function if exists private.normalize_role_permissions();

-- --------------------------------------------------------- shape restore

-- Every system role goes, along with the assignments the triggers made.
delete from public.community_role_members assignment
using public.community_roles role
where assignment.role_id = role.id and role.system_key is not null;
delete from public.community_roles where system_key is not null;

alter table public.community_roles
  add column if not exists priority integer not null default 0,
  add column if not exists permission_config jsonb not null default '{}'::jsonb;

update public.community_roles
set priority = least(greatest("position", 0), 1000),
    permission_config = (
      select coalesce(jsonb_object_agg(pair.legacy, true), '{}'::jsonb)
      from (values
        ('post', 'send_messages'),
        ('pin', 'pin_messages'),
        ('delete_others', 'manage_messages'),
        ('manage_channels', 'manage_channels'),
        ('mention_all', 'mention_everyone'),
        ('mention_tier', 'mention_roles'),
        ('bypass_slow_mode', 'bypass_slowmode')
      ) as pair(legacy, modern)
      where pair.modern = any(public.community_roles.permissions)
    );

alter table public.community_roles
  drop constraint if exists community_roles_permissions_known,
  drop constraint if exists community_roles_system_key_known,
  drop constraint if exists community_roles_system_key_unique,
  drop constraint if exists community_roles_single_icon,
  drop constraint if exists community_roles_icon_emoji_shape,
  drop constraint if exists community_roles_position_unique;

alter table public.community_role_members drop constraint if exists community_role_members_source_known;

drop index if exists community_roles_position_idx;
drop index if exists community_roles_updated_by_idx;
drop index if exists community_role_members_role_idx;

alter table public.community_roles
  drop column if exists "position",
  drop column if exists hoist,
  drop column if exists mentionable,
  drop column if exists icon_emoji,
  drop column if exists icon_path,
  drop column if exists permissions,
  drop column if exists system_key,
  drop column if exists updated_by;

alter table public.community_role_members drop column if exists source;

-- The legacy tables required an actor on every row; the triggers that inserted
-- actorless rows are gone, so the constraint can come back.
update public.community_roles set created_by = (
  select id from public.profiles where platform_role = 'influencer' and not is_suspended limit 1
) where created_by is null;
update public.community_role_members set assigned_by = (
  select id from public.profiles where platform_role = 'influencer' and not is_suspended limit 1
) where assigned_by is null;

alter table public.community_roles alter column created_by set not null;
alter table public.community_role_members alter column assigned_by set not null;

alter table public.community_roles rename to cosmetic_roles;
alter table public.community_role_members rename to cosmetic_role_assignments;

alter index community_roles_name_unique_idx rename to cosmetic_roles_name_unique_idx;
alter index community_roles_created_by_idx rename to cosmetic_roles_created_by_idx;
alter index community_role_members_user_idx rename to cosmetic_role_assignments_user_idx;
alter index community_role_members_assigned_by_idx rename to cosmetic_role_assignments_assigned_by_idx;
alter trigger community_roles_set_updated_at on public.cosmetic_roles rename to cosmetic_roles_set_updated_at;

create index if not exists cosmetic_roles_priority_idx on public.cosmetic_roles (priority desc, name);

-- ------------------------------------------------------- legacy validation

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

alter table public.cosmetic_roles
  add constraint cosmetic_roles_permission_config_valid
  check (public.is_valid_permission_config(permission_config)) not valid;
alter table public.cosmetic_roles validate constraint cosmetic_roles_permission_config_valid;

-- ------------------------------------------------------------- legacy RLS

drop policy if exists community_roles_read on public.cosmetic_roles;
drop policy if exists community_role_members_read on public.cosmetic_role_assignments;

create policy cosmetic_roles_member_read
on public.cosmetic_roles for select to authenticated
using (public.is_active_member() or public.is_staff());

create policy cosmetic_roles_creator_insert
on public.cosmetic_roles for insert to authenticated
with check (public.is_influencer() and created_by = (select auth.uid()));

create policy cosmetic_roles_creator_update
on public.cosmetic_roles for update to authenticated
using (public.is_influencer())
with check (public.is_influencer() and created_by = (select auth.uid()));

create policy cosmetic_roles_creator_delete
on public.cosmetic_roles for delete to authenticated
using (public.is_influencer());

create policy cosmetic_role_assignments_member_read
on public.cosmetic_role_assignments for select to authenticated
using (public.is_active_member() or public.is_staff());

create policy cosmetic_role_assignments_creator_insert
on public.cosmetic_role_assignments for insert to authenticated
with check (public.is_influencer() and assigned_by = (select auth.uid()));

create policy cosmetic_role_assignments_creator_delete
on public.cosmetic_role_assignments for delete to authenticated
using (public.is_influencer());

grant select, insert, update, delete on public.cosmetic_roles to authenticated;
grant select, insert, delete on public.cosmetic_role_assignments to authenticated;
grant all on public.cosmetic_roles, public.cosmetic_role_assignments to service_role;

-- --------------------------------------------------------- legacy grants

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
grant execute on function public.community_grant(text) to authenticated;

drop function if exists public.community_permission_keys();
drop function if exists public.community_channel_permission_keys();

-- ----------------------------------------------------- legacy member search

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
          select 1 from public.cosmetic_role_assignments role_filter
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
      jsonb_build_object('id', role.id, 'name', role.name, 'color', role.color, 'priority', role.priority)
      order by role.priority desc, role.name
    ) as items
    from public.cosmetic_role_assignments assignment
    join public.cosmetic_roles role on role.id = assignment.role_id
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
