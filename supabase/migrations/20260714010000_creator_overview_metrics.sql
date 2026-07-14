-- Creator overview data is intentionally aggregate-only. Payment rows remain
-- restricted to super administrators by the existing payments_read policy.
create or replace function public.get_creator_overview_metrics(
  period_days integer default 30,
  creator_timezone text default 'UTC'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  period_start timestamptz;
  previous_period_start timestamptz;
  local_day_start timestamptz;
  local_day_end timestamptz;
  active_member_count integer;
  new_member_count integer;
  previous_new_member_count integer;
  revenue numeric(12, 2);
  previous_revenue numeric(12, 2);
  today_event_count integer;
  missing_room_link_count integer;
  pending_review_count integer;
  draft_lesson_count integer;
  schedule jsonb;
begin
  if not (public.is_influencer() or public.is_super_admin()) then
    raise exception 'Creator overview access is required' using errcode = '42501';
  end if;
  if period_days not in (7, 30, 90) then
    raise exception 'Unsupported dashboard period' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_timezone_names where name = creator_timezone) then
    raise exception 'Unsupported timezone' using errcode = '22023';
  end if;

  period_start := now() - make_interval(days => period_days);
  previous_period_start := period_start - make_interval(days => period_days);
  local_day_start := date_trunc('day', now() at time zone creator_timezone) at time zone creator_timezone;
  local_day_end := local_day_start + interval '1 day';

  select count(*) into active_member_count from public.memberships where status = 'active';
  select count(*) into new_member_count from public.memberships where status = 'active' and joined_at >= period_start and joined_at < now();
  select count(*) into previous_new_member_count from public.memberships where status = 'active' and joined_at >= previous_period_start and joined_at < period_start;
  select coalesce(sum(amount), 0) into revenue from public.payments where status = 'succeeded' and paid_at >= period_start and paid_at < now();
  select coalesce(sum(amount), 0) into previous_revenue from public.payments where status = 'succeeded' and paid_at >= previous_period_start and paid_at < period_start;
  select count(*) into today_event_count from public.events where status in ('upcoming', 'live') and starts_at >= local_day_start and starts_at < local_day_end;

  select coalesce(jsonb_agg(event_data order by starts_at), '[]'::jsonb) into schedule from (
    select jsonb_build_object(
      'id', event.id,
      'title', event.title,
      'startsAt', event.starts_at,
      'status', event.status,
      'enrollmentCount', (select count(*) from public.event_enrollments enrollment where enrollment.event_id = event.id)
    ) as event_data, event.starts_at
    from public.events event
    where event.status in ('upcoming', 'live') and event.starts_at >= local_day_start and event.starts_at < local_day_end
  ) scheduled_events;

  select count(*) into missing_room_link_count
  from public.events event
  left join public.event_rooms room on room.event_id = event.id
  where event.status = 'upcoming'
    and event.starts_at >= now()
    and nullif(trim(room.zoom_url), '') is null;
  select count(*) into pending_review_count from public.review_applications where status in ('pending', 'under_review');
  select count(*) into draft_lesson_count from public.lessons where status = 'draft';

  return jsonb_build_object(
    'activeMemberCount', active_member_count,
    'newMemberCount', new_member_count,
    'previousNewMemberCount', previous_new_member_count,
    'revenue', revenue,
    'previousRevenue', previous_revenue,
    'todayEventCount', today_event_count,
    'todaySchedule', schedule,
    'attention', jsonb_build_object('missingRoomLinkCount', missing_room_link_count, 'pendingReviewCount', pending_review_count, 'draftLessonCount', draft_lesson_count)
  );
end;
$$;

revoke all on function public.get_creator_overview_metrics(integer, text) from public, anon;
grant execute on function public.get_creator_overview_metrics(integer, text) to authenticated, service_role;
