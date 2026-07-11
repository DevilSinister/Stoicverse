-- Events can be scheduled before a meeting room is available. Attendees enroll
-- independently, so access and attendance are not inferred from a page visit.
alter table public.events
  alter column zoom_url drop not null,
  add column if not exists host_name text not null default 'Stoicverse Team';

create table if not exists public.event_enrollments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists event_enrollments_event_idx on public.event_enrollments (event_id, enrolled_at);
create index if not exists event_enrollments_user_idx on public.event_enrollments (user_id, enrolled_at desc);

alter table public.event_enrollments enable row level security;

create policy event_enrollments_own_read on public.event_enrollments
  for select to authenticated using (user_id = (select auth.uid()) or public.is_staff());

create policy event_enrollments_eligible_insert on public.event_enrollments
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and public.has_active_membership()
    and exists (
      select 1
      from public.events event
      join public.member_tiers tier on tier.user_id = (select auth.uid())
      where event.id = event_id
        and event.status in ('upcoming', 'live')
        and tier.current_tier >= event.min_tier
    )
  );

create policy event_enrollments_own_delete on public.event_enrollments
  for delete to authenticated using (user_id = (select auth.uid()) or public.is_staff());

drop policy if exists events_influencer_write on public.events;
create policy events_staff_write on public.events
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, insert, delete on public.event_enrollments to authenticated;
grant insert, update, delete on public.events to authenticated;
