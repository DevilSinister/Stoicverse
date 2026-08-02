-- Open the curriculum to every active member while retaining tier achievements.

create or replace function public.course_is_available(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ((select auth.uid()) is not null)
    and (public.is_active_member() or public.is_staff())
    and exists (
      select 1
      from public.courses course_record
      where course_record.id = target_course_id
        and course_record.status = 'published'
    );
$$;

create or replace function public.course_video_is_unlocked(target_video_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.course_is_available(video.course_id)
    and (video.release_at is null or video.release_at <= now())
  from public.course_videos video
  where video.id = target_video_id;
$$;

create or replace function public.is_lesson_unlocked(target_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_staff() or exists (
    select 1
    from public.lessons lesson
    where lesson.id = target_lesson_id
      and public.is_active_member()
      and lesson.status = 'published'
      and (lesson.release_at is null or lesson.release_at <= now())
  );
$$;

drop policy if exists course_videos_member_read on public.course_videos;
create policy course_videos_member_read
on public.course_videos
for select
to authenticated
using (public.course_video_is_unlocked(id) or public.is_influencer() or public.is_super_admin());

create or replace function public.record_course_video_progress(target_video_id uuid, elapsed_seconds integer)
returns table (watched_seconds integer, completion_percentage numeric, is_completed boolean, course_completed boolean, current_tier integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := (select auth.uid());
  video_record record;
  existing public.course_video_progress%rowtype;
  watched integer;
  percent numeric(5,2);
  complete boolean;
  course_complete boolean;
  reward integer;
begin
  if actor_id is null or elapsed_seconds < 1 or elapsed_seconds > 15 or not public.course_video_is_unlocked(target_video_id) then
    raise exception 'course video is unavailable';
  end if;

  select video.id, video.course_id, video.duration_seconds
  into video_record
  from public.course_videos video
  where video.id = target_video_id
  for update;

  insert into public.course_enrollments(course_id, user_id)
  values(video_record.course_id, actor_id)
  on conflict do nothing;

  select * into existing
  from public.course_video_progress
  where video_id = target_video_id and user_id = actor_id
  for update;

  if found and existing.last_watched_at > now() - interval '10 seconds' then
    raise exception 'progress is being recorded too quickly';
  end if;

  watched := least(video_record.duration_seconds, coalesce(existing.watched_seconds, 0) + elapsed_seconds);
  percent := round((watched::numeric / video_record.duration_seconds::numeric) * 100, 2);
  complete := percent >= 80;

  insert into public.course_video_progress(video_id,user_id,watched_seconds,completion_percentage,is_completed,first_started_at,last_watched_at,completed_at)
  values(target_video_id,actor_id,watched,percent,complete,now(),now(),case when complete then now() end)
  on conflict(video_id,user_id) do update set
    watched_seconds=excluded.watched_seconds,
    completion_percentage=excluded.completion_percentage,
    is_completed=public.course_video_progress.is_completed or excluded.is_completed,
    last_watched_at=now(),
    completed_at=coalesce(public.course_video_progress.completed_at,excluded.completed_at),
    updated_at=now();

  select course_record.completion_tier
  into reward
  from public.courses course_record
  where course_record.id=video_record.course_id and course_record.is_finished;

  course_complete := reward is not null and not exists (
    select 1
    from public.course_videos course_video
    where course_video.course_id=video_record.course_id
      and (
        not course_video.is_optional
        or not exists (
          select 1
          from public.course_enrollments enrollment
          where enrollment.course_id=video_record.course_id
            and enrollment.user_id=actor_id
            and enrollment.first_completed_at is not null
            and course_video.created_at > enrollment.first_completed_at
        )
      )
      and not exists (
        select 1
        from public.course_video_progress progress
        where progress.video_id=course_video.id
          and progress.user_id=actor_id
          and progress.is_completed
      )
  );

  if course_complete then
    update public.course_enrollments
    set first_completed_at=coalesce(first_completed_at,now()), completion_current=true, completed_at=now()
    where course_id=video_record.course_id and user_id=actor_id;

    insert into public.course_completion_grants(course_id,user_id,granted_tier)
    values(video_record.course_id,actor_id,reward)
    on conflict do nothing;

    update public.member_tiers as tier
    set current_tier=greatest(tier.current_tier,reward),
        is_master=(tier.is_master or reward=5),
        tier_unlocked_at=now(),
        master_unlocked_at=case when reward=5 then coalesce(tier.master_unlocked_at,now()) else tier.master_unlocked_at end
    where tier.user_id=actor_id;
  end if;

  return query
  select watched, percent, complete, course_complete,
    coalesce((select tier.current_tier from public.member_tiers tier where tier.user_id=actor_id),1);
end;
$$;

create table public.cosmetic_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 32),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  priority integer not null default 0 check (priority between 0 and 1000),
  permission_config jsonb not null default '{}'::jsonb check (jsonb_typeof(permission_config) = 'object'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index cosmetic_roles_name_unique_idx on public.cosmetic_roles (lower(name));
create index cosmetic_roles_priority_idx on public.cosmetic_roles (priority desc, name);
create index cosmetic_roles_created_by_idx on public.cosmetic_roles (created_by);

create table public.cosmetic_role_assignments (
  role_id uuid not null references public.cosmetic_roles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  primary key (role_id, user_id)
);

create index cosmetic_role_assignments_user_idx on public.cosmetic_role_assignments (user_id, role_id);
create index cosmetic_role_assignments_assigned_by_idx on public.cosmetic_role_assignments (assigned_by);

create trigger cosmetic_roles_set_updated_at
before update on public.cosmetic_roles
for each row execute function public.set_updated_at();

alter table public.cosmetic_roles enable row level security;
alter table public.cosmetic_role_assignments enable row level security;

create policy cosmetic_roles_member_read
on public.cosmetic_roles
for select
to authenticated
using (public.is_active_member() or public.is_staff());

create policy cosmetic_roles_creator_insert
on public.cosmetic_roles
for insert
to authenticated
with check (public.is_influencer() and created_by = (select auth.uid()));

create policy cosmetic_roles_creator_update
on public.cosmetic_roles
for update
to authenticated
using (public.is_influencer())
with check (public.is_influencer() and created_by = (select auth.uid()));

create policy cosmetic_roles_creator_delete
on public.cosmetic_roles
for delete
to authenticated
using (public.is_influencer());

create policy cosmetic_role_assignments_member_read
on public.cosmetic_role_assignments
for select
to authenticated
using (public.is_active_member() or public.is_staff());

create policy cosmetic_role_assignments_creator_insert
on public.cosmetic_role_assignments
for insert
to authenticated
with check (public.is_influencer() and assigned_by = (select auth.uid()));

create policy cosmetic_role_assignments_creator_delete
on public.cosmetic_role_assignments
for delete
to authenticated
using (public.is_influencer());

grant select, insert, update, delete on public.cosmetic_roles to authenticated;
grant select, insert, delete on public.cosmetic_role_assignments to authenticated;
grant all on public.cosmetic_roles, public.cosmetic_role_assignments to service_role;

revoke all on function public.course_is_available(uuid), public.course_video_is_unlocked(uuid), public.is_lesson_unlocked(uuid), public.record_course_video_progress(uuid,integer) from public, anon;
grant execute on function public.course_is_available(uuid), public.course_video_is_unlocked(uuid), public.is_lesson_unlocked(uuid), public.record_course_video_progress(uuid,integer) to authenticated, service_role;
