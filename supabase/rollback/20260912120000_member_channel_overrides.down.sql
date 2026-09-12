-- Rollback for 20260912120000_member_channel_overrides.sql
--
-- **This one loses data, and there is no way for it not to.**
--
--   * Every member-subject override row is deleted. `role_id` goes back to
--     NOT NULL and those rows have no role, so they cannot be kept in any
--     form. Everybody currently restricted from a channel or a category is
--     unrestricted by running this.
--   * Every `restrict` and `unrestrict` case is deleted. The kind check is
--     narrowed back to the original six, and rows whose kind is no longer
--     permitted would stop that constraint being created. The moderation log
--     therefore loses the record of those actions having happened.
--
-- Role-subject overrides are untouched, and so is every other kind of case.
--
-- After this runs `community_permissions` no longer reads a member layer, so a
-- restriction could not take effect even if a row somehow survived.

begin;

-- Order matters: a constraint cannot be narrowed while rows violate it.
delete from public.community_mod_cases where kind in ('restrict', 'unrestrict');
delete from public.channel_permission_overrides where user_id is not null;

drop function if exists public.community_restrict_member(uuid, text, uuid, text, text[]);
drop function if exists public.community_unrestrict_member(uuid, text, uuid, text);

alter table public.community_mod_cases drop constraint if exists community_mod_cases_kind_check;
alter table public.community_mod_cases add constraint community_mod_cases_kind_check
  check (kind = any (array['warn', 'timeout', 'untimeout', 'ban', 'unban', 'note']));

alter table public.community_mod_cases drop constraint if exists community_mod_cases_reason_required;
alter table public.community_mod_cases add constraint community_mod_cases_reason_required
  check (kind = any (array['note', 'untimeout', 'unban']) or reason is not null);

drop index if exists public.channel_permission_overrides_channel_user_idx;
drop index if exists public.channel_permission_overrides_category_user_idx;
drop index if exists public.channel_permission_overrides_user_idx;

alter table public.channel_permission_overrides
  drop constraint if exists channel_permission_overrides_one_subject;
alter table public.channel_permission_overrides drop column if exists user_id;
alter table public.channel_permission_overrides alter column role_id set not null;

-- The resolver, without the member layer.
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

  select channel_row.is_archived
      or not channel_row.is_active
      or coalesce(category.is_archived, true)
  into channel_hidden
  from public.channel_categories category
  where category.id = channel_row.category_id;

  if coalesce(channel_hidden, true) and not ('manage_channels' = any(base)) then
    return '{}'::text[];
  end if;

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

notify pgrst, 'reload schema';

commit;
