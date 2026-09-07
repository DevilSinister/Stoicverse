-- Creator member operations: per-member turnover, audited moderation, gifted
-- subscriptions, and an indexed member directory. The legacy singleton
-- member_dashboard_turnover table is intentionally retained for history but is
-- no longer read by the application.

alter table public.payments
  add column source text not null default 'stripe',
  add column granted_by uuid references public.profiles(id) on delete restrict,
  add column duration_months smallint,
  alter column stripe_payment_intent drop not null,
  alter column stripe_event_id drop not null;

alter table public.memberships
  add column access_source text not null default 'stripe'
  check (access_source in ('stripe', 'gifted'));

alter table public.payments
  add constraint payments_source_check check (source in ('stripe', 'gifted')),
  add constraint payments_source_shape_check check (
    (
      source = 'stripe'
      and stripe_payment_intent is not null
      and stripe_event_id is not null
      and granted_by is null
      and duration_months is null
    )
    or
    (
      source = 'gifted'
      and product_type = 'membership'
      and amount = 0
      and status = 'succeeded'
      and paid_at is not null
      and stripe_payment_intent is null
      and stripe_event_id is null
      and granted_by is not null
      and duration_months in (1, 3, 6, 12)
    )
  );

create index payments_granted_by_idx on public.payments (granted_by)
where granted_by is not null;
create index payments_user_source_paid_idx on public.payments (user_id, source, paid_at desc);
create index payments_user_membership_paid_idx on public.payments (user_id, paid_at desc, created_at desc)
where product_type = 'membership' and status = 'succeeded';

create table public.member_weekly_turnover (
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  amount_usd numeric(14, 2) not null default 0 check (amount_usd >= 0),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start),
  constraint member_weekly_turnover_iso_week_check
    check (extract(isodow from week_start) = 1)
);

create index member_weekly_turnover_week_user_idx
  on public.member_weekly_turnover (week_start, user_id);
create index member_weekly_turnover_updated_by_idx
  on public.member_weekly_turnover (updated_by)
  where updated_by is not null;

create trigger member_weekly_turnover_set_updated_at
before update on public.member_weekly_turnover
for each row execute function public.set_updated_at();

create table public.member_moderation_events (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action text not null check (action in ('suspend', 'reinstate')),
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  created_at timestamptz not null default now()
);

create index member_moderation_events_member_created_idx
  on public.member_moderation_events (member_id, created_at desc);
create index member_moderation_events_actor_idx
  on public.member_moderation_events (actor_id);

alter table public.member_weekly_turnover enable row level security;
alter table public.member_moderation_events enable row level security;

create policy member_weekly_turnover_read
on public.member_weekly_turnover for select to authenticated
using (user_id = (select auth.uid()) or public.is_influencer());

create policy member_weekly_turnover_creator_insert
on public.member_weekly_turnover for insert to authenticated
with check (
  public.is_influencer()
  and updated_by = (select auth.uid())
  and user_id <> (select auth.uid())
  and week_start = date_trunc('week', timezone('utc', now()))::date
  and exists (
    select 1 from public.profiles target
    where target.id = user_id
      and target.platform_role in ('member', 'moderator')
  )
);

create policy member_weekly_turnover_creator_update
on public.member_weekly_turnover for update to authenticated
using (public.is_influencer())
with check (
  public.is_influencer()
  and updated_by = (select auth.uid())
  and user_id <> (select auth.uid())
  and week_start = date_trunc('week', timezone('utc', now()))::date
  and exists (
    select 1 from public.profiles target
    where target.id = user_id
      and target.platform_role in ('member', 'moderator')
  )
);

create policy member_moderation_events_creator_read
on public.member_moderation_events for select to authenticated
using (public.is_influencer());

create policy member_moderation_events_creator_insert
on public.member_moderation_events for insert to authenticated
with check (
  public.is_influencer()
  and actor_id = (select auth.uid())
  and member_id <> (select auth.uid())
  and exists (
    select 1 from public.profiles target
    where target.id = member_id
      and target.platform_role in ('member', 'moderator')
  )
);

create policy payments_creator_gift_insert
on public.payments for insert to authenticated
with check (
  public.is_influencer()
  and source = 'gifted'
  and granted_by = (select auth.uid())
  and user_id <> (select auth.uid())
  and exists (
    select 1 from public.profiles target
    where target.id = user_id
      and target.platform_role in ('member', 'moderator')
      and not target.is_suspended
  )
);

grant select, insert, update on public.member_weekly_turnover to authenticated;
grant select, insert on public.member_moderation_events to authenticated;
grant insert on public.payments to authenticated;
grant all on public.member_weekly_turnover, public.member_moderation_events to service_role;

create or replace function private.apply_gifted_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile public.profiles%rowtype;
  existing_membership public.memberships%rowtype;
  extension_base timestamptz;
begin
  if new.source <> 'gifted' then
    return new;
  end if;

  if (select auth.uid()) is null
     or new.granted_by <> (select auth.uid())
     or not public.is_influencer() then
    raise exception 'Influencer access is required' using errcode = '42501';
  end if;

  select * into target_profile
  from public.profiles
  where id = new.user_id
  for update;

  if not found
     or target_profile.id = (select auth.uid())
     or target_profile.platform_role not in ('member', 'moderator') then
    raise exception 'This account cannot receive gifted access' using errcode = '42501';
  end if;

  if target_profile.is_suspended then
    raise exception 'Reinstate this member before gifting access' using errcode = '23514';
  end if;

  select * into existing_membership
  from public.memberships
  where user_id = new.user_id
  for update;

  if found and existing_membership.status = 'active' and existing_membership.expires_at is null then
    raise exception 'Lifetime memberships cannot be extended' using errcode = '23514';
  end if;

  extension_base := greatest(now(), coalesce(existing_membership.expires_at, now()));

  insert into public.memberships (
    user_id, status, amount_paid, joined_at, expires_at, access_source
  ) values (
    new.user_id,
    'active',
    coalesce(existing_membership.amount_paid, 0),
    coalesce(existing_membership.joined_at, now()),
    extension_base + make_interval(months => new.duration_months),
    'gifted'
  )
  on conflict (user_id) do update set
    status = 'active',
    joined_at = coalesce(public.memberships.joined_at, excluded.joined_at),
    expires_at = excluded.expires_at,
    access_source = 'gifted',
    updated_at = now();

  return new;
end;
$$;

revoke all on function private.apply_gifted_membership() from public, anon, authenticated;

create trigger apply_gifted_membership
after insert on public.payments
for each row execute function private.apply_gifted_membership();

create or replace function private.apply_member_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role text;
  target_suspended boolean;
begin
  if (select auth.uid()) is null
     or new.actor_id <> (select auth.uid())
     or not public.is_influencer() then
    raise exception 'Influencer access is required' using errcode = '42501';
  end if;

  select platform_role, is_suspended into target_role, target_suspended
  from public.profiles
  where id = new.member_id
  for update;

  if not found
     or new.member_id = (select auth.uid())
     or target_role not in ('member', 'moderator') then
    raise exception 'This account cannot be moderated' using errcode = '42501';
  end if;

  if (new.action = 'suspend' and target_suspended)
     or (new.action = 'reinstate' and not target_suspended) then
    raise exception 'The member is already in that state' using errcode = '23514';
  end if;

  update public.profiles
  set is_suspended = (new.action = 'suspend'), updated_at = now()
  where id = new.member_id;

  return new;
end;
$$;

revoke all on function private.apply_member_moderation() from public, anon, authenticated;

create trigger apply_member_moderation
after insert on public.member_moderation_events
for each row execute function private.apply_member_moderation();

-- The old permissive assignment policies predated member mutation controls.
drop policy if exists cosmetic_role_assignments_creator_insert on public.cosmetic_role_assignments;
drop policy if exists cosmetic_role_assignments_creator_delete on public.cosmetic_role_assignments;

create policy cosmetic_role_assignments_creator_insert
on public.cosmetic_role_assignments for insert to authenticated
with check (
  public.is_influencer()
  and assigned_by = (select auth.uid())
  and user_id <> (select auth.uid())
  and exists (
    select 1 from public.profiles target
    where target.id = user_id
      and target.platform_role in ('member', 'moderator')
  )
);

create policy cosmetic_role_assignments_creator_delete
on public.cosmetic_role_assignments for delete to authenticated
using (
  public.is_influencer()
  and user_id <> (select auth.uid())
  and exists (
    select 1 from public.profiles target
    where target.id = user_id
      and target.platform_role in ('member', 'moderator')
  )
);

create or replace function public.set_member_platform_role(
  target_user_id uuid,
  desired_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role text;
begin
  if (select auth.uid()) is null or not public.is_influencer() then
    raise exception 'Influencer access is required' using errcode = '42501';
  end if;
  if target_user_id = (select auth.uid()) or desired_role not in ('member', 'moderator') then
    raise exception 'Invalid role change' using errcode = '22023';
  end if;

  select platform_role into current_role
  from public.profiles where id = target_user_id for update;

  if not found or current_role not in ('member', 'moderator') then
    raise exception 'This account cannot be changed' using errcode = '42501';
  end if;

  update public.profiles set platform_role = desired_role, updated_at = now()
  where id = target_user_id;
end;
$$;

revoke all on function public.set_member_platform_role(uuid, text) from public, anon;
grant execute on function public.set_member_platform_role(uuid, text) to authenticated, service_role;

create or replace function public.gift_member_subscription(
  target_user_id uuid,
  gift_duration_months smallint
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  payment_id uuid;
begin
  if gift_duration_months not in (1, 3, 6, 12) then
    raise exception 'Gift duration must be 1, 3, 6, or 12 months' using errcode = '22023';
  end if;

  insert into public.payments (
    user_id, product_type, amount, currency, status, source,
    granted_by, duration_months, paid_at
  ) values (
    target_user_id, 'membership', 0, 'usd', 'succeeded', 'gifted',
    (select auth.uid()), gift_duration_months, now()
  ) returning id into payment_id;

  return payment_id;
end;
$$;

revoke all on function public.gift_member_subscription(uuid, smallint) from public, anon;
grant execute on function public.gift_member_subscription(uuid, smallint) to authenticated, service_role;

create or replace function public.record_member_moderation(
  target_user_id uuid,
  moderation_action text,
  moderation_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  event_id uuid;
begin
  insert into public.member_moderation_events (member_id, actor_id, action, reason)
  values (target_user_id, (select auth.uid()), moderation_action, trim(moderation_reason))
  returning id into event_id;
  return event_id;
end;
$$;

revoke all on function public.record_member_moderation(uuid, text, text) from public, anon;
grant execute on function public.record_member_moderation(uuid, text, text) to authenticated, service_role;

create index profiles_member_directory_cursor_idx
on public.profiles ((lower(btrim(coalesce(full_name, '')))), id)
where platform_role in ('member', 'moderator');

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
security invoker
set search_path = ''
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

revoke all on function public.search_creator_members(text, text, integer, text, uuid, text, uuid, integer) from public, anon;
grant execute on function public.search_creator_members(text, text, integer, text, uuid, text, uuid, integer) to authenticated, service_role;

create or replace function public.get_creator_member_summary(target_user_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select to_jsonb(member_row)
  from public.search_creator_members(
    search_text => target_user_id::text,
    page_size => 1
  ) member_row
  where member_row.id = target_user_id
$$;

revoke all on function public.get_creator_member_summary(uuid) from public, anon;
grant execute on function public.get_creator_member_summary(uuid) to authenticated, service_role;

create or replace function public.creator_turnover_totals()
returns table (current_week_turnover numeric, all_time_turnover numeric, updated_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(amount_usd) filter (
      where week_start = date_trunc('week', timezone('utc', now()))::date
    ), 0),
    coalesce(sum(amount_usd), 0),
    max(updated_at)
  from public.member_weekly_turnover
  where public.is_influencer()
$$;

revoke all on function public.creator_turnover_totals() from public, anon;
grant execute on function public.creator_turnover_totals() to authenticated, service_role;

create or replace view public.member_turnover_summary
with (security_invoker = true)
as
select
  profile.id as user_id,
  date_trunc('week', timezone('utc', now()))::date as week_start,
  coalesce(sum(entry.amount_usd) filter (
    where entry.week_start = date_trunc('week', timezone('utc', now()))::date
  ), 0)::numeric(14, 2) as current_week_turnover,
  coalesce(sum(entry.amount_usd), 0)::numeric(14, 2) as all_time_turnover,
  max(entry.updated_at) as updated_at
from public.profiles profile
left join public.member_weekly_turnover entry on entry.user_id = profile.id
where profile.id = (select auth.uid()) or public.is_influencer()
group by profile.id;

revoke all on public.member_turnover_summary from public, anon;
grant select on public.member_turnover_summary to authenticated, service_role;

-- Keep the earlier direct-write guard authoritative while allowing this one
-- narrowly scoped RPC to perform member/moderator transitions. Authenticated
-- users still have no UPDATE grant on platform_role.
create or replace function private.guard_platform_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.platform_role is distinct from old.platform_role then
    if (select auth.uid()) is null or public.is_super_admin() then
      return new;
    end if;

    if public.is_influencer()
       and old.platform_role in ('member', 'moderator')
       and new.platform_role in ('member', 'moderator') then
      return new;
    end if;

    raise exception 'platform_role may not be changed by this account'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_platform_role_change() from public, anon, authenticated;
