-- Manually curated turnover figures shown on the member dashboard.

create table public.member_dashboard_turnover (
  id boolean primary key default true check (id),
  turnover_this_week numeric(14, 2) not null default 0 check (turnover_this_week >= 0),
  all_time_turnover numeric(14, 2) not null default 0 check (all_time_turnover >= 0),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.member_dashboard_turnover (id) values (true);

create trigger member_dashboard_turnover_set_updated_at
before update on public.member_dashboard_turnover
for each row execute function public.set_updated_at();

alter table public.member_dashboard_turnover enable row level security;

create policy member_dashboard_turnover_member_read
on public.member_dashboard_turnover
for select
to authenticated
using (public.has_active_membership() or public.is_staff());

create policy member_dashboard_turnover_editor_update
on public.member_dashboard_turnover
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.platform_role in ('influencer', 'moderator')
      and not profile.is_suspended
  )
)
with check (
  exists (
    select 1
    from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.platform_role in ('influencer', 'moderator')
      and not profile.is_suspended
  )
);

grant select, update on public.member_dashboard_turnover to authenticated;
grant all on public.member_dashboard_turnover to service_role;
