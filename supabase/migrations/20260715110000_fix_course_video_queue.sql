-- Optional videos are recommendations, so they do not prevent the following
-- required lesson from opening. They can still be required for an in-progress
-- member to complete the overall course (handled in record_course_video_progress).
create or replace function public.course_video_is_unlocked(target_video_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.course_is_available(v.course_id) and (v.release_at is null or v.release_at <= now())
    and exists (select 1 from public.course_enrollments e where e.course_id = v.course_id and e.user_id = (select auth.uid()))
    and not exists (
      select 1 from public.course_videos previous_video
      where previous_video.course_id = v.course_id
        and previous_video.sort_order < v.sort_order
        and not previous_video.is_optional
        and not exists (
          select 1 from public.course_video_progress p
          where p.video_id = previous_video.id and p.user_id = (select auth.uid()) and p.is_completed
        )
    )
  from public.course_videos v
  where v.id = target_video_id;
$$;
