-- Creator-owned event lifecycle, notifications, and operational metadata.
alter table public.events drop constraint if exists events_status_check;
alter table public.events add constraint events_status_check check (status in ('draft', 'upcoming', 'live', 'completed', 'cancelled'));
alter table public.events add column if not exists publish_at timestamptz;
alter table public.events add column if not exists published_at timestamptz;
alter table public.events add column if not exists cancelled_at timestamptz;
alter table public.events add column if not exists cancellation_reason text;

-- Drafts are operational records: only staff can read them through the Data API.
drop policy if exists events_read on public.events;
create policy events_read on public.events for select to authenticated
using (public.is_staff() or (status <> 'draft' and public.has_active_membership()));

drop policy if exists event_enrollments_eligible_insert on public.event_enrollments;
create policy event_enrollments_eligible_insert on public.event_enrollments
for insert to authenticated with check (
  user_id = (select auth.uid())
  and public.has_active_membership()
  and exists (
    select 1 from public.events event
    join public.member_tiers tier on tier.user_id = (select auth.uid())
    where event.id = event_id
      and event.status in ('upcoming', 'live')
      and (tier.is_master or tier.current_tier >= event.min_tier)
  )
);

-- Existing optional end times remain readable; all new and changed events are
-- validated by the mutation function below.
create or replace function public.save_creator_event(
  target_event_id uuid,
  event_title text,
  event_description text,
  event_host_name text,
  event_starts_at timestamptz,
  event_ends_at timestamptz,
  event_min_tier integer,
  event_zoom_url text,
  intended_publish_at timestamptz,
  publish_now boolean
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor_id uuid := (select auth.uid());
  event_id uuid;
  channel_id uuid;
  was_published boolean := false;
begin
  if actor_id is null or not public.is_influencer() then raise exception 'Creator access is required' using errcode = '42501'; end if;
  if nullif(btrim(event_title), '') is null or char_length(btrim(event_title)) > 160 then raise exception 'Enter an event title up to 160 characters' using errcode = '22023'; end if;
  if event_starts_at is null or event_ends_at is null or event_starts_at <= now() or event_ends_at <= event_starts_at then raise exception 'Use a future start time and an end time after it' using errcode = '22023'; end if;
  if event_min_tier not between 1 and 5 then raise exception 'Invalid event tier' using errcode = '22023'; end if;
  if nullif(event_zoom_url, '') is not null and event_zoom_url !~* '^https://([a-z0-9-]+\.)?zoom\.(us|com)/' then raise exception 'Invalid Zoom URL' using errcode = '22023'; end if;

  select id into channel_id from public.channels where type = 'events' and is_active limit 1;
  if channel_id is null then
    insert into public.channels(name, type, description, created_by) values ('events', 'events', 'Live Stoicverse sessions', actor_id) returning id into channel_id;
  end if;

  if target_event_id is null then
    insert into public.events(channel_id, created_by, title, description, host_name, starts_at, ends_at, min_tier, status, publish_at, published_at)
    values (channel_id, actor_id, btrim(event_title), nullif(btrim(event_description), ''), coalesce(nullif(btrim(event_host_name), ''), 'Stoicverse Team'), event_starts_at, event_ends_at, event_min_tier, case when publish_now then 'upcoming' else 'draft' end, intended_publish_at, case when publish_now then now() else null end)
    returning id into event_id;
  else
    select id, published_at is not null into event_id, was_published from public.events where id = target_event_id for update;
    if event_id is null then raise exception 'Event not found' using errcode = 'P0002'; end if;
    if (select status from public.events where id = event_id) = 'cancelled' then raise exception 'Cancelled events cannot be edited' using errcode = '22023'; end if;
    update public.events set title = btrim(event_title), description = nullif(btrim(event_description), ''), host_name = coalesce(nullif(btrim(event_host_name), ''), 'Stoicverse Team'), starts_at = event_starts_at, ends_at = event_ends_at, min_tier = event_min_tier, publish_at = intended_publish_at, status = case when publish_now then 'upcoming' else status end, published_at = case when publish_now then coalesce(published_at, now()) else published_at end where id = event_id;
  end if;

  if nullif(event_zoom_url, '') is not null then
    insert into public.event_rooms(event_id, zoom_url) values (event_id, event_zoom_url)
    on conflict (event_id) do update set zoom_url = excluded.zoom_url;
  end if;

  if publish_now then
    if not was_published then
      insert into public.posts(channel_id, author_id, post_type, body) values (channel_id, actor_id, 'event', btrim(event_title) || ' · ' || to_char(event_starts_at, 'Mon FMDD, YYYY HH24:MI TZ'));
      insert into public.notifications(user_id, type, title, body, action_url)
      select profile.id, 'new_event', 'New event: ' || btrim(event_title), 'Scheduled for ' || to_char(event_starts_at, 'Mon FMDD at HH24:MI TZ'), '/dashboard/events?event=' || event_id
      from public.profiles profile join public.memberships membership on membership.user_id = profile.id
      where membership.status = 'active' and not profile.is_suspended;
    else
      insert into public.notifications(user_id, type, title, body, action_url)
      select profile.id, 'event_updated', 'Event updated: ' || btrim(event_title), 'Review the updated session details.', '/dashboard/events?event=' || event_id
      from public.profiles profile join public.memberships membership on membership.user_id = profile.id
      where membership.status = 'active' and not profile.is_suspended;
    end if;
  end if;
  return event_id;
end;
$$;

create or replace function public.publish_creator_event_room(target_event_id uuid, event_zoom_url text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare actor_id uuid := (select auth.uid()); event_title text;
begin
  if actor_id is null or not public.is_influencer() then raise exception 'Creator access is required' using errcode = '42501'; end if;
  if nullif(event_zoom_url, '') is null or event_zoom_url !~* '^https://([a-z0-9-]+\.)?zoom\.(us|com)/' then raise exception 'Invalid Zoom URL' using errcode = '22023'; end if;
  select title into event_title from public.events where id = target_event_id and status not in ('draft', 'cancelled') for update;
  if event_title is null then raise exception 'Event not found' using errcode = 'P0002'; end if;
  insert into public.event_rooms(event_id, zoom_url) values (target_event_id, event_zoom_url) on conflict (event_id) do update set zoom_url = excluded.zoom_url;
  insert into public.notifications(user_id, type, title, body, action_url)
  select profile.id, 'event_room_published', 'Room link published: ' || event_title, 'The event room is ready when the session opens.', '/dashboard/events?event=' || target_event_id
  from public.profiles profile join public.memberships membership on membership.user_id = profile.id where membership.status = 'active' and not profile.is_suspended;
end;
$$;

create or replace function public.cancel_creator_event(target_event_id uuid, reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare actor_id uuid := (select auth.uid()); event_title text; was_published boolean;
begin
  if actor_id is null or not public.is_influencer() then raise exception 'Creator access is required' using errcode = '42501'; end if;
  if nullif(btrim(reason), '') is null then raise exception 'Provide a cancellation reason' using errcode = '22023'; end if;
  update public.events set status = 'cancelled', cancelled_at = now(), cancellation_reason = btrim(reason) where id = target_event_id and status <> 'cancelled' returning title, published_at is not null into event_title, was_published;
  if event_title is null then raise exception 'Event not found or already cancelled' using errcode = 'P0002'; end if;
  if was_published then
    insert into public.notifications(user_id, type, title, body, action_url)
    select profile.id, 'event_cancelled', 'Event cancelled: ' || event_title, btrim(reason), '/dashboard/events?event=' || target_event_id
    from public.profiles profile join public.memberships membership on membership.user_id = profile.id where membership.status = 'active' and not profile.is_suspended;
  end if;
end;
$$;

create or replace function public.get_creator_event_room_status()
returns setof uuid language sql stable security definer set search_path = public, pg_temp as $$
  select room.event_id from public.event_rooms room where public.is_influencer();
$$;

create or replace function public.get_creator_event_attention()
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::integer from public.events where status = 'draft' and public.is_influencer();
$$;

revoke all on function public.save_creator_event(uuid, text, text, text, timestamptz, timestamptz, integer, text, timestamptz, boolean), public.publish_creator_event_room(uuid, text), public.cancel_creator_event(uuid, text), public.get_creator_event_room_status(), public.get_creator_event_attention() from public, anon;
grant execute on function public.save_creator_event(uuid, text, text, text, timestamptz, timestamptz, integer, text, timestamptz, boolean), public.publish_creator_event_room(uuid, text), public.cancel_creator_event(uuid, text), public.get_creator_event_room_status(), public.get_creator_event_attention() to authenticated, service_role;
