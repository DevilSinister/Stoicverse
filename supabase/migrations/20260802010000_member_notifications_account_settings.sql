-- Member notification preferences, private avatars, and recoverable account deletion.

create table public.member_notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  event_updates boolean not null default true,
  course_updates boolean not null default true,
  community_mentions boolean not null default true,
  role_achievements boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger member_notification_preferences_set_updated_at
before update on public.member_notification_preferences
for each row execute function public.set_updated_at();

alter table public.member_notification_preferences enable row level security;

create policy member_notification_preferences_own_read
on public.member_notification_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy member_notification_preferences_own_insert
on public.member_notification_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy member_notification_preferences_own_update
on public.member_notification_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.member_notification_preferences to authenticated;
grant all on public.member_notification_preferences to service_role;

-- Optional categories are filtered at the table boundary. Mandatory account,
-- payment, and security notifications do not map to an optional preference.
create or replace function public.filter_notification_by_preference()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  preference_enabled boolean;
begin
  if new.type in ('new_event', 'event_updated', 'event_room_published', 'event_cancelled') then
    select coalesce(preference.event_updates, true)
      into preference_enabled
      from public.member_notification_preferences preference
      where preference.user_id = new.user_id;
  elsif new.type in ('new_course', 'course_updated', 'new_lesson', 'lesson_released') then
    select coalesce(preference.course_updates, true)
      into preference_enabled
      from public.member_notification_preferences preference
      where preference.user_id = new.user_id;
  elsif new.type = 'community_mention' then
    select coalesce(preference.community_mentions, true)
      into preference_enabled
      from public.member_notification_preferences preference
      where preference.user_id = new.user_id;
  elsif new.type in ('role_assigned', 'achievement_unlocked', 'tier_unlocked', 'master_unlocked') then
    select coalesce(preference.role_achievements, true)
      into preference_enabled
      from public.member_notification_preferences preference
      where preference.user_id = new.user_id;
  else
    return new;
  end if;

  -- No row means the default-on preference applies.
  if coalesce(preference_enabled, true) then
    return new;
  end if;
  return null;
end;
$$;

revoke all on function public.filter_notification_by_preference() from public, anon, authenticated;
drop trigger if exists notifications_filter_by_preference on public.notifications;
create trigger notifications_filter_by_preference
before insert on public.notifications
for each row execute function public.filter_notification_by_preference();

grant update (is_read, read_at) on public.notifications to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-avatars', 'member-avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists member_avatars_own_read on storage.objects;
create policy member_avatars_own_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'member-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists member_avatars_own_insert on storage.objects;
create policy member_avatars_own_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'member-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists member_avatars_own_update on storage.objects;
create policy member_avatars_own_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'member-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'member-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists member_avatars_own_delete on storage.objects;
create policy member_avatars_own_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'member-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Discussion and financial audit records survive deletion without retaining a
-- profile link. All other ordinary member-owned records continue to cascade.
alter table public.posts alter column author_id drop not null;
alter table public.posts drop constraint if exists posts_author_id_fkey;
alter table public.posts
  add constraint posts_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete set null;

alter table public.payments alter column user_id drop not null;
alter table public.payments drop constraint if exists payments_user_id_fkey;
alter table public.payments
  add constraint payments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'cancelled', 'completed', 'failed')),
  requested_role text not null,
  scheduled_at timestamptz not null,
  processing_started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  last_error text check (last_error is null or char_length(last_error) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_at >= created_at + interval '29 days')
);

create unique index account_deletion_requests_active_user_idx
on public.account_deletion_requests (user_id)
where user_id is not null and status in ('pending', 'processing', 'failed');

create index account_deletion_requests_due_idx
on public.account_deletion_requests (scheduled_at, id)
where status = 'pending';

create trigger account_deletion_requests_set_updated_at
before update on public.account_deletion_requests
for each row execute function public.set_updated_at();

alter table public.account_deletion_requests enable row level security;

create policy account_deletion_requests_own_read
on public.account_deletion_requests
for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on public.account_deletion_requests to authenticated;
grant all on public.account_deletion_requests to service_role;

create or replace function public.claim_due_account_deletions(max_rows integer default 20)
returns table (request_id uuid, target_user_id uuid, avatar_path text, attempts integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'service role required' using errcode = '42501';
  end if;

  return query
  with due as (
    select request.id
    from public.account_deletion_requests request
    where request.status = 'pending'
      and request.scheduled_at <= now()
      and request.attempt_count < 5
    order by request.scheduled_at, request.id
    for update skip locked
    limit greatest(1, least(max_rows, 50))
  ), claimed as (
    update public.account_deletion_requests request
    set status = 'processing',
        processing_started_at = now(),
        attempt_count = request.attempt_count + 1,
        last_error = null
    from due
    where request.id = due.id
    returning request.id, request.user_id, request.attempt_count
  )
  select claimed.id,
         claimed.user_id,
         profile.avatar_url,
         claimed.attempt_count
  from claimed
  left join public.profiles profile on profile.id = claimed.user_id;
end;
$$;

revoke all on function public.claim_due_account_deletions(integer) from public, anon, authenticated;
grant execute on function public.claim_due_account_deletions(integer) to service_role;

create or replace function public.verify_account_deletion_cron_secret(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public, vault, pg_temp
as $$
  select exists (
    select 1
    from vault.decrypted_secrets secret
    where secret.name = 'account_deletion_cron_secret'
      and secret.decrypted_secret = candidate
  );
$$;

revoke all on function public.verify_account_deletion_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_account_deletion_cron_secret(text) to service_role;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
