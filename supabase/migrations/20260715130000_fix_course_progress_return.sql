-- Qualify member_tiers columns: `current_tier` is also a RETURNS TABLE output
-- name, which caused each progress call to roll back as ambiguous.
create or replace function public.record_course_video_progress(target_video_id uuid, elapsed_seconds integer)
returns table (watched_seconds integer, completion_percentage numeric, is_completed boolean, course_completed boolean, current_tier integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor_id uuid := (select auth.uid()); v record; existing public.course_video_progress%rowtype;
  watched integer; percent numeric(5,2); complete boolean; course_complete boolean; reward integer;
begin
  if actor_id is null or elapsed_seconds < 1 or elapsed_seconds > 15 or not public.course_video_is_unlocked(target_video_id) then raise exception 'course video is unavailable'; end if;
  select video.id, video.course_id, video.duration_seconds into v from public.course_videos video where video.id = target_video_id for update;
  select * into existing from public.course_video_progress where video_id = target_video_id and user_id = actor_id for update;
  if found and existing.last_watched_at > now() - interval '10 seconds' then raise exception 'progress is being recorded too quickly'; end if;
  watched := least(v.duration_seconds, coalesce(existing.watched_seconds, 0) + elapsed_seconds);
  percent := round((watched::numeric / v.duration_seconds::numeric) * 100, 2); complete := percent >= 80;
  insert into public.course_video_progress(video_id,user_id,watched_seconds,completion_percentage,is_completed,first_started_at,last_watched_at,completed_at)
  values(target_video_id,actor_id,watched,percent,complete,now(),now(),case when complete then now() end)
  on conflict(video_id,user_id) do update set watched_seconds=excluded.watched_seconds,completion_percentage=excluded.completion_percentage,is_completed=public.course_video_progress.is_completed or excluded.is_completed,last_watched_at=now(),completed_at=coalesce(public.course_video_progress.completed_at,excluded.completed_at),updated_at=now();
  select c.completion_tier into reward from public.courses c where c.id=v.course_id and c.is_finished;
  course_complete := reward is not null and not exists (
    select 1 from public.course_videos cv
    where cv.course_id=v.course_id and (not cv.is_optional or not exists (select 1 from public.course_enrollments e where e.course_id=v.course_id and e.user_id=actor_id and e.first_completed_at is not null and cv.created_at > e.first_completed_at))
      and not exists (select 1 from public.course_video_progress p where p.video_id=cv.id and p.user_id=actor_id and p.is_completed)
  );
  if course_complete then
    update public.course_enrollments set first_completed_at=coalesce(first_completed_at,now()),completion_current=true,completed_at=now() where course_id=v.course_id and user_id=actor_id;
    insert into public.course_completion_grants(course_id,user_id,granted_tier) values(v.course_id,actor_id,reward) on conflict do nothing;
    if reward is not null then
      update public.member_tiers as tier set current_tier=greatest(tier.current_tier,reward),is_master=(tier.is_master or reward=5),tier_unlocked_at=now(),master_unlocked_at=case when reward=5 then coalesce(tier.master_unlocked_at,now()) else tier.master_unlocked_at end where tier.user_id=actor_id;
    end if;
  end if;
  return query select watched,percent,complete,course_complete,coalesce((select tier.current_tier from public.member_tiers tier where tier.user_id=actor_id),1);
end;
$$;
