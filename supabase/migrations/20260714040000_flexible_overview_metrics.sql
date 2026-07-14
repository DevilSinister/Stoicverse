-- Drop the old signature if it exists
drop function if exists public.get_creator_overview_metrics(integer, text);

-- Create the new flexible signature
create or replace function public.get_creator_overview_metrics(
  period_days integer default 30,
  creator_timezone text default 'UTC',
  metrics_start timestamptz default null,
  metrics_end timestamptz default null,
  trends_start timestamptz default null,
  trends_end timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  p_metrics_start timestamptz;
  p_metrics_end timestamptz;
  p_prev_metrics_start timestamptz;
  p_prev_metrics_end timestamptz;
  p_trends_start timestamptz;
  p_trends_end timestamptz;
  local_day_start timestamptz;
  local_day_end timestamptz;
  active_member_count integer;
  total_member_count integer;
  previous_total_member_count integer;
  new_member_count integer;
  previous_new_member_count integer;
  revenue numeric(12, 2);
  previous_revenue numeric(12, 2);
  today_event_count integer;
  missing_room_link_count integer;
  pending_review_count integer;
  draft_lesson_count integer;
  schedule jsonb;
  trend_data jsonb;
  metrics_duration interval;
begin
  if not (public.is_influencer() or public.is_super_admin()) then
    raise exception 'Creator overview access is required' using errcode = '42501';
  end if;
  if not exists (select 1 from pg_timezone_names where name = creator_timezone) then
    raise exception 'Unsupported timezone' using errcode = '22023';
  end if;

  -- 1. Parse metrics date range
  if metrics_start is not null and metrics_end is not null then
    p_metrics_start := metrics_start;
    p_metrics_end := metrics_end;
    metrics_duration := p_metrics_end - p_metrics_start;
    p_prev_metrics_start := p_metrics_start - metrics_duration;
    p_prev_metrics_end := p_metrics_start;
  else
    p_metrics_start := now() - make_interval(days => period_days);
    p_metrics_end := now();
    p_prev_metrics_start := p_metrics_start - make_interval(days => period_days);
    p_prev_metrics_end := p_metrics_start;
  end if;

  -- 2. Parse trends date range
  if trends_start is not null and trends_end is not null then
    p_trends_start := trends_start;
    p_trends_end := trends_end;
  else
    p_trends_start := p_metrics_start;
    p_trends_end := p_metrics_end;
  end if;

  -- Today's range in creator's local time for Today's schedule
  local_day_start := date_trunc('day', now() at time zone creator_timezone) at time zone creator_timezone;
  local_day_end := local_day_start + interval '1 day';

  -- Calculations
  select count(*) into active_member_count from public.memberships where status = 'active';
  
  select count(*) into total_member_count from public.memberships where status = 'active' and (joined_at is null or joined_at <= p_metrics_end);
  select count(*) into previous_total_member_count from public.memberships where status = 'active' and (joined_at is null or joined_at <= p_prev_metrics_end);

  select count(*) into new_member_count from public.memberships where status = 'active' and joined_at >= p_metrics_start and joined_at < p_metrics_end;
  select count(*) into previous_new_member_count from public.memberships where status = 'active' and joined_at >= p_prev_metrics_start and joined_at < p_prev_metrics_end;
  
  select coalesce(sum(amount), 0) into revenue from public.payments where status = 'succeeded' and paid_at >= p_metrics_start and paid_at < p_metrics_end;
  select coalesce(sum(amount), 0) into previous_revenue from public.payments where status = 'succeeded' and paid_at >= p_prev_metrics_start and paid_at < p_prev_metrics_end;
  
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

  -- Calculate trend data
  with days as (
    select generate_series(
      date_trunc('day', p_trends_start at time zone creator_timezone) at time zone creator_timezone,
      date_trunc('day', p_trends_end at time zone creator_timezone) at time zone creator_timezone,
      '1 day'::interval
    ) as d
  ),
  daily_revenue as (
    select date_trunc('day', paid_at at time zone creator_timezone) at time zone creator_timezone as d, sum(amount) as rev
    from public.payments
    where status = 'succeeded' and paid_at >= p_trends_start and paid_at < p_trends_end + interval '1 day'
    group by 1
  ),
  daily_new_members as (
    select date_trunc('day', joined_at at time zone creator_timezone) at time zone creator_timezone as d, count(*) as new_members
    from public.memberships
    where status = 'active' and joined_at >= p_trends_start and joined_at < p_trends_end + interval '1 day'
    group by 1
  ),
  daily_total_members as (
    select d.d,
      (select count(*) from public.memberships where status = 'active' and joined_at < d.d + interval '1 day') as total_members
    from days d
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date', to_char(d.d at time zone creator_timezone, 'Mon FMDD'),
      'revenue', coalesce(dr.rev, 0),
      'newMembers', coalesce(dnm.new_members, 0),
      'totalMembers', coalesce(dtm.total_members, 0)
    ) order by d.d
  ), '[]'::jsonb) into trend_data
  from days d
  left join daily_revenue dr on dr.d = d.d
  left join daily_new_members dnm on dnm.d = d.d
  left join daily_total_members dtm on dtm.d = d.d;

  return jsonb_build_object(
    'activeMemberCount', active_member_count,
    'totalMemberCount', total_member_count,
    'previousTotalMemberCount', previous_total_member_count,
    'newMemberCount', new_member_count,
    'previousNewMemberCount', previous_new_member_count,
    'revenue', revenue,
    'previousRevenue', previous_revenue,
    'todayEventCount', today_event_count,
    'todaySchedule', schedule,
    'trendData', trend_data,
    'attention', jsonb_build_object('missingRoomLinkCount', missing_room_link_count, 'pendingReviewCount', pending_review_count, 'draftLessonCount', draft_lesson_count)
  );
end;
$$;

revoke all on function public.get_creator_overview_metrics(integer, text, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_creator_overview_metrics(integer, text, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated, service_role;
