-- Scoped restrictions — keeping somebody out of a channel or a category
-- rather than out of the whole community.
--
-- `channel_permission_overrides` could only ever name a role. That is the
-- right primitive for "moderators may pin here", and the wrong one for "this
-- person, out of this channel": doing it with roles would mean inventing a
-- role per restricted member, and every one of them would then appear in the
-- role list, in the member sidebar's hoisting, and in the permissions UI.
--
-- So an override may now name a member instead. Exactly one subject, checked:
-- a row naming both a role and a member would apply twice at two different
-- precedences and nobody could predict which won.
--
-- **Precedence.** The member layer is applied last, after @everyone and after
-- roles, which is Discord's order and the only one that makes a restriction
-- mean anything: a member deny has to beat a role allow, or a moderator could
-- not restrict somebody holding a permissive role — which is most of the
-- reason to restrict anybody. `administrator` still short-circuits above all
-- of it, and a suspended or banned account still resolves to nothing long
-- before any override is read.

begin;

do $$
begin
  if not exists (select 1 from pg_class where relname = 'channel_permission_overrides' and relnamespace = 'public'::regnamespace) then
    raise exception 'public.channel_permission_overrides is missing: apply 20260912020000 first';
  end if;
  if not exists (select 1 from pg_proc where proname = 'community_permissions' and pronamespace = 'public'::regnamespace) then
    raise exception 'public.community_permissions is missing: apply 20260912020000 first';
  end if;
end
$$;

-- ------------------------------------------------------------- the subject

alter table public.channel_permission_overrides
  add column if not exists user_id uuid references public.profiles(id) on delete cascade;

alter table public.channel_permission_overrides
  alter column role_id drop not null;

alter table public.channel_permission_overrides
  drop constraint if exists channel_permission_overrides_one_subject;
alter table public.channel_permission_overrides
  add constraint channel_permission_overrides_one_subject check (num_nonnulls(role_id, user_id) = 1);

create unique index if not exists channel_permission_overrides_channel_user_idx
  on public.channel_permission_overrides (channel_id, user_id) where channel_id is not null and user_id is not null;
create unique index if not exists channel_permission_overrides_category_user_idx
  on public.channel_permission_overrides (category_id, user_id) where category_id is not null and user_id is not null;
create index if not exists channel_permission_overrides_user_idx
  on public.channel_permission_overrides (user_id) where user_id is not null;

-- A scoped restriction is its own kind of case. Reusing 'ban' would make the
-- case log read as though the person had been removed from the community.
alter table public.community_mod_cases drop constraint if exists community_mod_cases_kind_check;
alter table public.community_mod_cases add constraint community_mod_cases_kind_check
  check (kind = any (array['warn', 'timeout', 'untimeout', 'ban', 'unban', 'note', 'restrict', 'unrestrict']));

alter table public.community_mod_cases drop constraint if exists community_mod_cases_reason_required;
alter table public.community_mod_cases add constraint community_mod_cases_reason_required
  check (kind = any (array['note', 'untimeout', 'unban', 'unrestrict']) or reason is not null);

-- ----------------------------------------------------------- the resolver

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
  member_deny text[];
  member_allow text[];
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
  where override.role_id is not null
    and (case when channel_row.permissions_synced
              then override.category_id = channel_row.category_id
              else override.channel_id = channel_row.id end)
    and (
      role.system_key = 'everyone'
      or exists (
        select 1 from public.community_role_members assignment
        where assignment.role_id = override.role_id and assignment.user_id = target
      )
    );

  -- This member's own override.
  --
  -- Both scopes, unioned — deliberately *not* the channel-or-category rule the
  -- role layer follows. That rule is about configuration inheritance: a channel
  -- carrying its own permissions stops following its category. A member
  -- restriction is not configuration, it is a sanction, and both channels here
  -- are synced, so under the inheritance rule a channel-scoped restriction
  -- would silently do nothing at all.
  --
  -- Discord resolves this by un-syncing the channel when you give it its own
  -- override. That is a very large side effect to trigger from a moderation
  -- action: it would stop the channel inheriting every category rule, for
  -- everybody, because one person was restricted from it.
  select
    coalesce(array_agg(distinct entry.key) filter (where entry.kind = 'deny'), '{}'::text[]),
    coalesce(array_agg(distinct entry.key) filter (where entry.kind = 'allow'), '{}'::text[])
  into member_deny, member_allow
  from public.channel_permission_overrides override
  cross join lateral (
    select 'deny'::text as kind, key from unnest(override.deny) as key
    union all
    select 'allow'::text, key from unnest(override.allow) as key
  ) entry
  where override.user_id = target
    and (override.channel_id = channel_row.id or override.category_id = channel_row.category_id);

  perms := base;
  perms := array(select key from unnest(perms) as key where key <> all(everyone_deny));
  perms := array(select distinct key from unnest(perms || everyone_allow) as key);
  perms := array(select key from unnest(perms) as key where key <> all(role_deny));
  perms := array(select distinct key from unnest(perms || role_allow) as key);
  -- Last, so a restriction on one person beats a permission their role grants.
  perms := array(select key from unnest(perms) as key where key <> all(member_deny));
  perms := array(select distinct key from unnest(perms || member_allow) as key);

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

-- ------------------------------------------------------------ the actions

create or replace function public.community_restrict_member(
  target uuid,
  scope_kind text,
  scope_id uuid,
  reason text,
  keys text[] default array['view_channel']
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  clean text := nullif(btrim(coalesce(reason, '')), '');
  override_id uuid;
begin
  if actor is null then
    raise exception 'You are not signed in.' using errcode = '42501';
  end if;
  if not public.community_has('ban_members', null) then
    raise exception 'You do not have permission to restrict members.' using errcode = '42501';
  end if;
  if scope_kind not in ('channel', 'category') then
    raise exception 'A restriction is scoped to a channel or a category.';
  end if;
  if clean is null or char_length(clean) not between 3 and 500 then
    raise exception 'A reason must be between 3 and 500 characters.';
  end if;
  if target = actor then
    raise exception 'You cannot restrict yourself.';
  end if;
  -- The owner is not restrictable: `community_permissions` returns every key
  -- for an influencer before any override is read, so a row here would be a
  -- promise the resolver does not keep.
  if exists (select 1 from public.profiles where id = target and platform_role in ('influencer', 'super_admin')) then
    raise exception 'That member cannot be restricted.';
  end if;
  if not (keys <@ public.community_channel_permission_keys()) then
    raise exception 'That is not a channel permission.';
  end if;

  -- Replace rather than upsert. The unique indexes here are partial, so there
  -- is no single conflict target covering both scopes, and an override for one
  -- member on one scope is a single fact anyway.
  delete from public.channel_permission_overrides
  where user_id = target
    and (case when scope_kind = 'channel' then channel_id = scope_id else category_id = scope_id end);

  insert into public.channel_permission_overrides (channel_id, category_id, user_id, deny, allow, updated_by)
  values (
    case when scope_kind = 'channel' then scope_id end,
    case when scope_kind = 'category' then scope_id end,
    target, keys, '{}'::text[], actor
  )
  returning id into override_id;

  insert into public.community_mod_cases (subject_id, actor_id, kind, reason, channel_id, source)
  values (target, actor, 'restrict', clean,
          case when scope_kind = 'channel' then scope_id end, 'manual');

  return override_id;
end;
$$;

create or replace function public.community_unrestrict_member(
  target uuid,
  scope_kind text,
  scope_id uuid,
  reason text default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  removed integer;
begin
  if actor is null then
    raise exception 'You are not signed in.' using errcode = '42501';
  end if;
  if not public.community_has('ban_members', null) then
    raise exception 'You do not have permission to restrict members.' using errcode = '42501';
  end if;
  if scope_kind not in ('channel', 'category') then
    raise exception 'A restriction is scoped to a channel or a category.';
  end if;

  delete from public.channel_permission_overrides
  where user_id = target
    and (case when scope_kind = 'channel' then channel_id = scope_id else category_id = scope_id end);
  get diagnostics removed = row_count;

  if removed > 0 then
    insert into public.community_mod_cases (subject_id, actor_id, kind, reason, channel_id, source)
    values (target, actor, 'unrestrict', nullif(btrim(coalesce(reason, '')), ''),
            case when scope_kind = 'channel' then scope_id end, 'manual');
  end if;

  return removed > 0;
end;
$$;

revoke execute on function public.community_restrict_member(uuid, text, uuid, text, text[]) from public, anon;
grant execute on function public.community_restrict_member(uuid, text, uuid, text, text[]) to authenticated, service_role;
revoke execute on function public.community_unrestrict_member(uuid, text, uuid, text) from public, anon;
grant execute on function public.community_unrestrict_member(uuid, text, uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
