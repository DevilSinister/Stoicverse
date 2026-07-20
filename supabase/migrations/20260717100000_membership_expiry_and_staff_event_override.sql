-- Membership access expires at the database boundary. Progress rows are never
-- changed here, so a paid renewal resumes the member's existing tier and work.
update public.memberships
set expires_at = now() + interval '30 days'
where status = 'active' and expires_at is null;

create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles profile
    join public.memberships membership on membership.user_id = profile.id
    where profile.id = (select auth.uid())
      and not profile.is_suspended
      and membership.status = 'active'
      and (membership.expires_at is null or membership.expires_at > now())
  );
$$;

create or replace function public.has_active_membership()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.is_active_member(); $$;

-- Staff may enroll to make attendance explicit, but do not need a membership
-- row or a qualifying tier. Plain members retain the normal active/tier gate.
drop policy if exists event_enrollments_eligible_insert on public.event_enrollments;
create policy event_enrollments_eligible_insert on public.event_enrollments
for insert to authenticated with check (
  user_id = (select auth.uid())
  and (
    public.is_staff()
    or (
      public.is_active_member()
      and exists (
        select 1 from public.events event
        where event.id = event_id
          and event.status in ('upcoming', 'live')
          and public.has_tier_access(event.min_tier)
      )
    )
  )
);

revoke all on function public.is_active_member() from public, anon;
revoke all on function public.has_active_membership() from public, anon;
grant execute on function public.is_active_member(), public.has_active_membership() to authenticated, service_role;
