-- Security boundaries for the single Stoicverse community.
-- Sensitive meeting and video-provider identifiers must not live on tables that
-- members can read directly through the Data API.

create schema if not exists private;

create table public.event_rooms (
  event_id uuid primary key references public.events(id) on delete cascade,
  zoom_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.event_rooms (event_id, zoom_url)
select id, zoom_url from public.events where zoom_url is not null
on conflict (event_id) do update set zoom_url = excluded.zoom_url;

alter table public.events drop column if exists zoom_url;
alter table public.event_rooms enable row level security;
revoke all on public.event_rooms from anon, authenticated;
grant all on public.event_rooms to service_role;

create trigger event_rooms_set_updated_at
before update on public.event_rooms
for each row execute function public.set_updated_at();

create table public.lesson_assets (
  lesson_id uuid primary key references public.lessons(id) on delete cascade,
  video_file_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (video_file_id ~ '^[A-Za-z0-9_-]{10,200}$')
);

insert into public.lesson_assets (lesson_id, video_file_id)
select id, video_file_id from public.lessons
on conflict (lesson_id) do update set video_file_id = excluded.video_file_id;

alter table public.lessons drop column if exists video_file_id;
alter table public.lesson_assets enable row level security;
revoke all on public.lesson_assets from anon, authenticated;
grant all on public.lesson_assets to service_role;

create trigger lesson_assets_set_updated_at
before update on public.lesson_assets
for each row execute function public.set_updated_at();

create or replace function public.is_reserved_username(candidate text)
returns boolean
language sql
immutable
security invoker
set search_path = public, pg_temp
as $$
  select regexp_replace(lower(coalesce(candidate, '')), '[^a-z0-9]+', '', 'g') ~ '(stoic|sinister)';
$$;

alter table public.profiles
  add constraint profiles_full_name_not_blank check (btrim(full_name) <> '');

alter table public.profiles
  add constraint profiles_full_name_not_reserved check (not public.is_reserved_username(full_name));

create unique index profiles_full_name_unique_idx on public.profiles (lower(btrim(full_name)));

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.profiles where id = (select auth.uid()) and platform_role = 'super_admin' and not is_suspended); $$;

create or replace function public.is_influencer()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.profiles where id = (select auth.uid()) and platform_role = 'influencer' and not is_suspended); $$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.profiles where id = (select auth.uid()) and platform_role in ('super_admin', 'influencer', 'moderator') and not is_suspended); $$;

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
  );
$$;

create or replace function public.has_active_membership()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.is_active_member(); $$;

create or replace function public.has_tier_access(required_tier integer default 0)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select public.is_staff() or exists (
    select 1
    from public.member_tiers tier
    where tier.user_id = (select auth.uid())
      and public.is_active_member()
      and (tier.is_master or tier.current_tier >= required_tier)
  );
$$;

create or replace function public.is_master_member()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select public.is_staff() or exists (
    select 1 from public.member_tiers tier
    where tier.user_id = (select auth.uid()) and tier.is_master and public.is_active_member()
  );
$$;

create or replace function public.is_lesson_unlocked(target_lesson_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select public.is_staff() or exists (
    select 1
    from public.lessons lesson
    join public.tiers tier on tier.id = lesson.tier_id
    join public.member_tiers member_tier on member_tier.user_id = (select auth.uid())
    where lesson.id = target_lesson_id
      and public.is_active_member()
      and lesson.status = 'published'
      and (lesson.release_at is null or lesson.release_at <= now())
      and (member_tier.is_master or member_tier.current_tier >= tier.level)
      and (
        member_tier.current_tier > tier.level
        or not exists (
          select 1
          from public.lessons earlier
          left join public.lesson_progress earlier_progress
            on earlier_progress.lesson_id = earlier.id
            and earlier_progress.user_id = (select auth.uid())
          where earlier.tier_id = lesson.tier_id
            and earlier.status = 'published'
            and (earlier.release_at is null or earlier.release_at <= now())
            and earlier.sort_order < lesson.sort_order
            and coalesce(earlier_progress.is_completed, false) = false
        )
      )
  );
$$;

drop policy if exists channels_read on public.channels;
create policy channels_read on public.channels for select to authenticated
using (is_active and public.has_tier_access(min_tier) and (type <> 'master' or public.is_master_member()));

drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select to authenticated
using (
  not is_deleted
  and exists (
    select 1 from public.channels channel
    where channel.id = posts.channel_id
      and channel.is_active
      and public.has_tier_access(channel.min_tier)
      and (channel.type <> 'master' or public.is_master_member())
  )
);

drop policy if exists reactions_read on public.reactions;
create policy reactions_read on public.reactions for select to authenticated
using (public.is_active_member() or public.is_staff());

drop policy if exists reactions_own_write on public.reactions;
create policy reactions_own_write on public.reactions for all to authenticated
using (user_id = (select auth.uid()) and public.is_active_member())
with check (user_id = (select auth.uid()) and public.is_active_member());

drop policy if exists events_read on public.events;
create policy events_read on public.events for select to authenticated
using (public.has_tier_access(min_tier));

drop policy if exists tiers_read on public.tiers;
create policy tiers_read on public.tiers for select to authenticated
using (public.is_active_member() or public.is_staff());

drop policy if exists lessons_read on public.lessons;
create policy lessons_read on public.lessons for select to authenticated
using (public.is_lesson_unlocked(id));

drop policy if exists lesson_progress_read on public.lesson_progress;
create policy lesson_progress_read on public.lesson_progress for select to authenticated
using (user_id = (select auth.uid()) and public.is_active_member() or public.is_staff());

drop policy if exists lesson_progress_own_insert on public.lesson_progress;
drop policy if exists lesson_progress_own_update on public.lesson_progress;
revoke insert, update, delete on public.lesson_progress from authenticated;

drop policy if exists event_enrollments_eligible_insert on public.event_enrollments;
create policy event_enrollments_eligible_insert on public.event_enrollments
for insert to authenticated with check (
  user_id = (select auth.uid())
  and public.is_active_member()
  and exists (
    select 1 from public.events event
    where event.id = event_id
      and event.status in ('upcoming', 'live')
      and public.has_tier_access(event.min_tier)
  )
);

drop policy if exists event_enrollments_own_read on public.event_enrollments;
create policy event_enrollments_own_read on public.event_enrollments for select to authenticated
using ((user_id = (select auth.uid()) and public.is_active_member()) or public.is_staff());

drop policy if exists event_enrollments_own_delete on public.event_enrollments;
create policy event_enrollments_own_delete on public.event_enrollments for delete to authenticated
using ((user_id = (select auth.uid()) and public.is_active_member()) or public.is_staff());

create or replace function public.get_event_room_url(target_event_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  room_url text;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  select room.zoom_url into room_url
  from public.event_rooms room
  join public.events event on event.id = room.event_id
  where room.event_id = target_event_id
    and event.status in ('upcoming', 'live')
    and event.starts_at <= now()
    and (event.ends_at is null or event.ends_at > now())
    and (
      public.is_staff()
      or (
        public.is_active_member()
        and public.has_tier_access(event.min_tier)
        and exists (
          select 1 from public.event_enrollments enrollment
          where enrollment.event_id = event.id and enrollment.user_id = (select auth.uid())
        )
      )
    );

  if room_url is null then
    raise exception 'event room is unavailable';
  end if;

  return room_url;
end;
$$;

revoke all on function public.get_event_room_url(uuid) from public, anon;
grant execute on function public.get_event_room_url(uuid) to authenticated, service_role;

create or replace function public.get_lesson_video_file_id(target_lesson_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  file_id text;
begin
  if (select auth.uid()) is null or not public.is_lesson_unlocked(target_lesson_id) then
    raise exception 'lesson is unavailable';
  end if;
  select video_file_id into file_id from public.lesson_assets where lesson_id = target_lesson_id;
  if file_id is null then raise exception 'lesson video is unavailable'; end if;
  return file_id;
end;
$$;

revoke all on function public.get_lesson_video_file_id(uuid) from public, anon;
grant execute on function public.get_lesson_video_file_id(uuid) to authenticated, service_role;

create or replace function public.record_lesson_progress(target_lesson_id uuid, elapsed_seconds integer)
returns table (watched_seconds integer, completion_percentage numeric, is_completed boolean, current_tier integer, is_master boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := (select auth.uid());
  lesson_record record;
  progress_record public.lesson_progress%rowtype;
  new_watched_seconds integer;
  new_completion numeric(5,2);
  completed boolean;
  completed_count integer;
  required_count integer;
  next_tier integer;
  tier_record public.member_tiers%rowtype;
begin
  if actor_id is null or not public.is_active_member() then
    raise exception 'active membership required';
  end if;
  if elapsed_seconds < 1 or elapsed_seconds > 15 then
    raise exception 'elapsed watch time must be between 1 and 15 seconds';
  end if;
  if not public.is_lesson_unlocked(target_lesson_id) then
    raise exception 'lesson is locked';
  end if;

  select lesson.id, lesson.tier_id, lesson.duration_seconds, lesson.completion_threshold, tier.level, tier.required_lesson_count
  into lesson_record
  from public.lessons lesson join public.tiers tier on tier.id = lesson.tier_id
  where lesson.id = target_lesson_id
  for update;

  if lesson_record.duration_seconds <= 0 then
    raise exception 'lesson duration is not configured';
  end if;

  select * into progress_record from public.lesson_progress
  where user_id = actor_id and lesson_id = target_lesson_id
  for update;

  if found and progress_record.last_watched_at > now() - interval '10 seconds' then
    raise exception 'progress is being recorded too quickly';
  end if;

  new_watched_seconds := least(lesson_record.duration_seconds, coalesce(progress_record.watched_seconds, 0) + elapsed_seconds);
  new_completion := round((new_watched_seconds::numeric / lesson_record.duration_seconds::numeric) * 100, 2);
  completed := new_completion >= lesson_record.completion_threshold;

  insert into public.lesson_progress (user_id, lesson_id, watched_seconds, completion_percentage, is_completed, first_started_at, last_watched_at, completed_at)
  values (actor_id, target_lesson_id, new_watched_seconds, new_completion, completed, now(), now(), case when completed then now() else null end)
  on conflict (user_id, lesson_id) do update set
    watched_seconds = excluded.watched_seconds,
    completion_percentage = excluded.completion_percentage,
    is_completed = public.lesson_progress.is_completed or excluded.is_completed,
    last_watched_at = now(),
    completed_at = coalesce(public.lesson_progress.completed_at, excluded.completed_at),
    updated_at = now();

  select * into tier_record from public.member_tiers where user_id = actor_id for update;
  if completed and not tier_record.is_master and tier_record.current_tier = lesson_record.level then
    select count(*) into completed_count
    from public.lessons lesson
    join public.lesson_progress progress on progress.lesson_id = lesson.id and progress.user_id = actor_id and progress.is_completed
    where lesson.tier_id = lesson_record.tier_id and lesson.status = 'published' and (lesson.release_at is null or lesson.release_at <= now());

    required_count := lesson_record.required_lesson_count;
    if completed_count >= required_count then
      if lesson_record.level = 4 then
        update public.member_tiers set current_tier = 5, is_master = true, master_unlocked_at = coalesce(master_unlocked_at, now()) where id = tier_record.id;
      else
        next_tier := lesson_record.level + 1;
        update public.member_tiers set current_tier = next_tier, tier_unlocked_at = now() where id = tier_record.id;
      end if;
      select * into tier_record from public.member_tiers where id = tier_record.id;
    end if;
  end if;

  return query select new_watched_seconds, new_completion, completed, tier_record.current_tier, tier_record.is_master;
end;
$$;

revoke all on function public.record_lesson_progress(uuid, integer) from public, anon;
grant execute on function public.record_lesson_progress(uuid, integer) to authenticated, service_role;

revoke all on function public.is_super_admin() from public, anon;
revoke all on function public.is_influencer() from public, anon;
revoke all on function public.is_staff() from public, anon;
revoke all on function public.is_active_member() from public, anon;
revoke all on function public.has_active_membership() from public, anon;
revoke all on function public.has_tier_access(integer) from public, anon;
revoke all on function public.is_master_member() from public, anon;
revoke all on function public.is_lesson_unlocked(uuid) from public, anon;
grant execute on function public.is_super_admin(), public.is_influencer(), public.is_staff(), public.is_active_member(), public.has_active_membership(), public.has_tier_access(integer), public.is_master_member(), public.is_lesson_unlocked(uuid) to authenticated, service_role;
