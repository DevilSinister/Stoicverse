-- Community moderation audit trail, and the authorship fix for post edits.
--
-- Fixes AUDIT_2026-09-06 M4: posts_staff_update carried no author predicate, so
-- any moderator could silently rewrite the influencer's announcements with no
-- record. Content now belongs to its author; a moderator may hide a post but
-- never rewrite one.
--
-- The audit row is written by a trigger inside the same transaction as the
-- mutation it records, so a server action cannot forget it and a direct
-- PostgREST call cannot skip it.

-- ---------------------------------------------------------------- audit table

create table if not exists public.community_moderation_events (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid references public.posts(id) on delete set null,
  channel_id    uuid references public.channels(id) on delete set null,
  actor_id      uuid not null references public.profiles(id),
  subject_id    uuid references public.profiles(id) on delete set null,
  action        text not null check (action in ('edit','delete','pin','unpin')),
  reason        text check (reason is null or char_length(btrim(reason)) between 3 and 500),
  previous_body text,
  created_at    timestamptz not null default now()
);

comment on table public.community_moderation_events is
  'Append-only. Written solely by public.guard_post_update(). There is no INSERT, UPDATE or DELETE policy: an audit log its own subject can rewrite is not an audit log.';

create index if not exists community_moderation_events_post_idx
  on public.community_moderation_events (post_id, created_at desc);
create index if not exists community_moderation_events_actor_idx
  on public.community_moderation_events (actor_id, created_at desc);
create index if not exists community_moderation_events_channel_idx
  on public.community_moderation_events (channel_id, created_at desc);

alter table public.community_moderation_events enable row level security;

drop policy if exists community_moderation_events_staff_read on public.community_moderation_events;
create policy community_moderation_events_staff_read
  on public.community_moderation_events
  for select to authenticated
  using (public.is_staff());

-- Redundant against RLS, but this project's grants have proven volatile:
-- ALTER DEFAULT PRIVILEGES has re-granted ALL on every public table to
-- anon and authenticated, so the explicit revoke is the durable statement.
revoke insert, update, delete, truncate
  on public.community_moderation_events from anon, authenticated;

-- ------------------------------------------------------------------- trigger

create or replace function public.guard_post_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor uuid := (select auth.uid());
begin
  -- service_role and internal writes carry no JWT; leave them alone.
  if actor is null then
    return new;
  end if;

  if new.body          is distinct from old.body
  or new.image_url     is distinct from old.image_url
  or new.video_file_id is distinct from old.video_file_id then
    if old.author_id is distinct from actor then
      raise exception 'Only the author can edit this message';
    end if;
    insert into public.community_moderation_events
      (post_id, channel_id, actor_id, subject_id, action, previous_body)
    values (old.id, old.channel_id, actor, old.author_id, 'edit', old.body);
  end if;

  if new.is_pinned is distinct from old.is_pinned then
    if not public.is_staff() then
      raise exception 'You do not have permission to pin messages';
    end if;
    insert into public.community_moderation_events
      (post_id, channel_id, actor_id, subject_id, action)
    values (old.id, old.channel_id, actor, old.author_id,
            case when new.is_pinned then 'pin' else 'unpin' end);
  end if;

  if new.is_deleted and not old.is_deleted then
    if old.author_id is distinct from actor and not public.is_staff() then
      raise exception 'You do not have permission to delete this message';
    end if;
    insert into public.community_moderation_events
      (post_id, channel_id, actor_id, subject_id, action, reason, previous_body)
    values (old.id, old.channel_id, actor, old.author_id, 'delete',
            nullif(btrim(coalesce(current_setting('app.moderation_reason', true), '')), ''),
            old.body);
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_post_update() from public, anon, authenticated;

drop trigger if exists posts_guard_update on public.posts;
create trigger posts_guard_update
before update on public.posts
for each row execute function public.guard_post_update();

-- -------------------------------------------------------------- update policy

-- Old: using (is_staff() and can_view_channel(channel_id)) -- no author check.
-- New: the row gate is author-or-staff; which COLUMNS each may change is
-- enforced by the trigger above, because RLS is row-level and cannot express
-- "a moderator may change is_pinned but not body".
drop policy if exists posts_staff_update on public.posts;
drop policy if exists posts_author_or_staff_update on public.posts;
create policy posts_author_or_staff_update on public.posts
for update to authenticated
using (
  public.can_view_channel(channel_id)
  and (author_id = (select auth.uid()) or public.is_staff())
)
with check (
  -- Preserves the 20260722000000 escape hatch: a soft-deleted row must still
  -- pass WITH CHECK even though posts_read no longer matches it.
  is_deleted or public.can_view_channel(channel_id)
);

-- ------------------------------------------------------------ soft_delete_post

-- CREATE OR REPLACE cannot add a defaulted parameter: the 1-arg function would
-- survive and soft_delete_post(uuid) would become ambiguous (42725). Drop first.
-- PostgREST resolves overloads by argument name, so the existing single-argument
-- call site keeps working against the new defaulted signature.
drop function if exists public.soft_delete_post(uuid);
drop function if exists public.soft_delete_post(uuid, text);

create or replace function public.soft_delete_post(
  target_post_id uuid,
  delete_reason  text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  clean_reason text := nullif(btrim(coalesce(delete_reason, '')), '');
begin
  if not exists (
    select 1
    from public.posts post
    where post.id = target_post_id
      and not post.is_deleted
      and public.can_view_channel(post.channel_id)
      and (post.author_id = (select auth.uid()) or public.is_staff())
  ) then
    raise exception 'You do not have permission to delete this message';
  end if;

  if clean_reason is not null and char_length(clean_reason) not between 3 and 500 then
    raise exception 'A deletion reason must be between 3 and 500 characters';
  end if;

  -- Transaction-local, so the trigger stays the single writer of audit rows:
  -- a direct "update posts set is_deleted" is still logged, with a null reason.
  perform set_config('app.moderation_reason', coalesce(clean_reason, ''), true);

  update public.posts
  set is_deleted = true, updated_at = now()
  where id = target_post_id and not is_deleted;

  return found;
end;
$function$;

revoke all on function public.soft_delete_post(uuid, text) from public, anon;
grant execute on function public.soft_delete_post(uuid, text) to authenticated, service_role;
