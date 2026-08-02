-- Named, influencer-managed curriculum. Legacy lessons remain for migration safety.
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  description text,
  min_tier integer not null default 1 check (min_tier between 1 and 5),
  completion_tier integer check (completion_tier between 1 and 5),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_finished boolean not null default false,
  finished_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_finished and finished_at is not null) or (not is_finished and finished_at is null))
);

create table public.course_prerequisites (
  course_id uuid not null references public.courses(id) on delete cascade,
  prerequisite_course_id uuid not null references public.courses(id) on delete restrict,
  primary key (course_id, prerequisite_course_id),
  check (course_id <> prerequisite_course_id)
);

create table public.course_videos (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  duration_seconds integer not null check (duration_seconds > 0),
  sort_order integer not null check (sort_order >= 0),
  is_optional boolean not null default false,
  release_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, sort_order)
);

-- Provider IDs are deliberately isolated from the member-readable video metadata.
create table public.course_video_assets (
  video_id uuid primary key references public.course_videos(id) on delete cascade,
  video_file_id text not null check (video_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  created_at timestamptz not null default now()
);

create table public.course_enrollments (
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  first_completed_at timestamptz,
  completion_current boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (course_id, user_id)
);

create table public.course_video_progress (
  video_id uuid not null references public.course_videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  watched_seconds integer not null default 0 check (watched_seconds >= 0),
  completion_percentage numeric(5,2) not null default 0 check (completion_percentage between 0 and 100),
  is_completed boolean not null default false,
  first_started_at timestamptz,
  last_watched_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (video_id, user_id)
);

create table public.course_completion_grants (
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_tier integer check (granted_tier between 1 and 5),
  granted_at timestamptz not null default now(),
  primary key (course_id, user_id)
);

create index course_videos_course_sort_idx on public.course_videos(course_id, sort_order);
create index course_enrollments_user_current_idx on public.course_enrollments(user_id, completion_current);
create index course_video_progress_user_idx on public.course_video_progress(user_id, is_completed);

alter table public.courses enable row level security;
alter table public.course_prerequisites enable row level security;
alter table public.course_videos enable row level security;
alter table public.course_video_assets enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.course_video_progress enable row level security;
alter table public.course_completion_grants enable row level security;

create trigger courses_set_updated_at before update on public.courses for each row execute function public.set_updated_at();
create trigger course_videos_set_updated_at before update on public.course_videos for each row execute function public.set_updated_at();
create trigger course_enrollments_set_updated_at before update on public.course_enrollments for each row execute function public.set_updated_at();
create trigger course_video_progress_set_updated_at before update on public.course_video_progress for each row execute function public.set_updated_at();

create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.has_active_membership();
$$;

create or replace function public.has_tier_access(required_tier integer default 0)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_staff() or exists (
    select 1
    from public.member_tiers tier
    where tier.user_id = (select auth.uid())
      and public.has_active_membership()
      and (tier.is_master or tier.current_tier >= required_tier)
  );
$$;

create or replace function public.course_is_available(target_course_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_active_member() and exists (
    select 1 from public.courses c
    where c.id = target_course_id and c.status = 'published'
      and public.has_tier_access(c.min_tier)
      and not exists (
        select 1 from public.course_prerequisites cp
        where cp.course_id = c.id and not exists (
          select 1 from public.course_enrollments e
          where e.course_id = cp.prerequisite_course_id and e.user_id = (select auth.uid()) and e.completion_current
        )
      )
  );
$$;

create or replace function public.course_video_is_unlocked(target_video_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.course_is_available(v.course_id) and (v.release_at is null or v.release_at <= now())
    and exists (select 1 from public.course_enrollments e where e.course_id = v.course_id and e.user_id = (select auth.uid()))
    and not exists (
      select 1 from public.course_videos previous_video
      where previous_video.course_id = v.course_id and previous_video.sort_order < v.sort_order
        and not exists (
          select 1 from public.course_video_progress p
          where p.video_id = previous_video.id and p.user_id = (select auth.uid()) and p.is_completed
        )
    )
  from public.course_videos v
  where v.id = target_video_id;
$$;

create or replace function public.enroll_in_course(target_course_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select auth.uid()) is null or not public.course_is_available(target_course_id) then
    raise exception 'course is unavailable';
  end if;
  insert into public.course_enrollments(course_id, user_id) values(target_course_id, (select auth.uid())) on conflict do nothing;
  return true;
end;
$$;

create or replace function public.get_course_video_file_id(target_video_id uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare file_id text;
begin
  if not public.course_video_is_unlocked(target_video_id) then raise exception 'course video is unavailable'; end if;
  select a.video_file_id into file_id from public.course_video_assets a where a.video_id = target_video_id;
  if file_id is null then raise exception 'course video is unavailable'; end if;
  return file_id;
end;
$$;

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
    if reward is not null then update public.member_tiers set current_tier=greatest(current_tier,reward),is_master=(is_master or reward=5),tier_unlocked_at=now(),master_unlocked_at=case when reward=5 then coalesce(master_unlocked_at,now()) else master_unlocked_at end where user_id=actor_id; end if;
  end if;
  return query select watched,percent,complete,course_complete,coalesce((select current_tier from public.member_tiers where user_id=actor_id),1);
end;
$$;

create or replace function public.invalidate_course_completion_on_required_video()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from public.courses c where c.id=new.course_id and c.is_finished) and not new.is_optional then
    update public.course_enrollments set completion_current=false,completed_at=null where course_id=new.course_id and completion_current;
  end if;
  return new;
end;
$$;
create trigger course_video_required_insert after insert on public.course_videos for each row execute function public.invalidate_course_completion_on_required_video();
create trigger course_video_required_update after update of is_optional on public.course_videos for each row
when (old.is_optional and not new.is_optional) execute function public.invalidate_course_completion_on_required_video();

create policy courses_member_read on public.courses for select to authenticated using ((status='published' and public.is_active_member()) or public.is_influencer() or public.is_super_admin());
create policy courses_influencer_write on public.courses for all to authenticated using (public.is_influencer()) with check (public.is_influencer() and (created_by=(select auth.uid()) or created_by is null));
create policy course_prerequisites_read on public.course_prerequisites for select to authenticated using (public.is_active_member() or public.is_influencer() or public.is_super_admin());
create policy course_prerequisites_influencer_write on public.course_prerequisites for all to authenticated using (public.is_influencer()) with check (public.is_influencer());
create policy course_videos_member_read on public.course_videos for select to authenticated using (((release_at is null or release_at <= now()) and public.course_is_available(course_id) and exists(select 1 from public.course_enrollments e where e.course_id=course_videos.course_id and e.user_id=(select auth.uid()))) or public.is_influencer() or public.is_super_admin());
create policy course_videos_influencer_write on public.course_videos for all to authenticated using (public.is_influencer()) with check (public.is_influencer());
create policy course_assets_influencer_only on public.course_video_assets for all to authenticated using (public.is_influencer()) with check (public.is_influencer());
create policy course_enrollments_read on public.course_enrollments for select to authenticated using (user_id=(select auth.uid()) or public.is_influencer() or public.is_super_admin());
create policy course_progress_read on public.course_video_progress for select to authenticated using (user_id=(select auth.uid()) or public.is_influencer() or public.is_super_admin());
create policy course_grants_read on public.course_completion_grants for select to authenticated using (user_id=(select auth.uid()) or public.is_influencer() or public.is_super_admin());

revoke all on function public.enroll_in_course(uuid), public.get_course_video_file_id(uuid), public.record_course_video_progress(uuid,integer), public.course_is_available(uuid), public.course_video_is_unlocked(uuid) from public, anon;
grant execute on function public.enroll_in_course(uuid), public.get_course_video_file_id(uuid), public.record_course_video_progress(uuid,integer), public.course_is_available(uuid), public.course_video_is_unlocked(uuid) to authenticated, service_role;
grant select on public.courses, public.course_prerequisites, public.course_videos, public.course_enrollments, public.course_video_progress, public.course_completion_grants to authenticated;
grant insert, update, delete on public.courses, public.course_prerequisites, public.course_videos, public.course_video_assets to authenticated;

insert into public.courses(title,description,min_tier,completion_tier,status,created_by)
select seed.title, seed.description, seed.min_tier, seed.completion_tier, 'draft', (select id from public.profiles where platform_role='influencer' limit 1)
from (values ('Basic','The Tier 1 foundations.',1,2),('Beginner','The Tier 2 practice.',2,3),('Intermediate','The Tier 3 application.',3,4)) as seed(title,description,min_tier,completion_tier)
where not exists (select 1 from public.courses c where c.title=seed.title);

insert into public.course_prerequisites(course_id,prerequisite_course_id)
select c.id,p.id from public.courses c join public.courses p on (c.title='Beginner' and p.title='Basic') or (c.title='Intermediate' and p.title='Beginner')
on conflict do nothing;
