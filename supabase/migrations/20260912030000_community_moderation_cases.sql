-- Sanctions with a case log, and a reports queue.
--
-- Until now the only lever a moderator had over a person was `is_suspended`
-- on `profiles` — a platform-wide switch that also ends their access to the
-- courses and events they paid for. This adds community-scoped sanctions that
-- do not touch it: a warning, a timeout that expires by itself, and a ban that
-- locks someone out of the community while leaving their subscription exactly
-- where it was. A contract test asserts the ban RPC mentions neither
-- `is_suspended` nor `memberships`.
--
-- Phase 2's `private.community_gate` returned only 'suspended', and the
-- resolver already branched on 'banned' and 'timeout' against a gate that
-- could never return them. This migration is what makes those branches live:
-- no change to `community_permissions` is needed, because the shape was
-- written for this.
--
-- Provably inert on the data as it stands: both tables are new and empty, so
-- every gate returns exactly what it returned yesterday until someone issues a
-- sanction.

-- ----------------------------------------------------------------- pre-flight

do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'channel_permission_overrides'
  ) then
    raise exception 'pre-flight: phase 3 (channel_permission_overrides) is not applied; apply 20260912020000 first';
  end if;

  if not exists (
    select 1 from public.community_roles where system_key = 'moderator' and 'moderate_members' = any(permissions)
  ) then
    raise exception 'pre-flight: the Moderator role does not carry moderate_members, so nobody could use what this migration builds';
  end if;

  raise notice 'pre-flight: % existing moderation event(s) will keep their action values',
    (select count(*) from public.community_moderation_events);
end $$;

-- -------------------------------------------------------------------- cases

create table if not exists public.community_mod_cases (
  id uuid primary key default gen_random_uuid(),
  -- Human-facing and stable. "Case 14" is something two people can say to each
  -- other; a uuid is not.
  case_number integer generated always as identity,
  subject_id uuid not null references public.profiles(id) on delete cascade,
  -- Null means AutoMod acted, which phase 5 will start doing. A case with no
  -- actor is not a case with a missing actor.
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('warn', 'timeout', 'untimeout', 'ban', 'unban', 'note')),
  reason text check (reason is null or char_length(btrim(reason)) between 3 and 500),
  -- 60 seconds to 28 days, Discord's range.
  duration_seconds integer check (duration_seconds is null or duration_seconds between 60 and 2419200),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'automod')),
  automod_rule_id uuid,
  post_id uuid references public.posts(id) on delete set null,
  channel_id uuid references public.channels(id) on delete set null,
  created_at timestamptz not null default now(),
  -- A timeout is the only kind that expires, and it always does. Without the
  -- biconditional a ban could carry an expiry nothing reads, or a timeout could
  -- be issued that never ends.
  constraint community_mod_cases_timeout_expires check ((kind = 'timeout') = (expires_at is not null)),
  -- The reason is the point of the record. Only the kinds that undo something,
  -- and the free-form note, may go without one.
  constraint community_mod_cases_reason_required
    check (kind in ('note', 'untimeout', 'unban') or reason is not null)
);

-- One live ban per person. Two would make "is this member banned" a question
-- with two answers and "unban them" a question about which one.
create unique index if not exists community_mod_cases_one_active_ban_idx
  on public.community_mod_cases (subject_id) where kind = 'ban' and revoked_at is null;

create index if not exists community_mod_cases_subject_idx
  on public.community_mod_cases (subject_id, created_at desc);
create index if not exists community_mod_cases_actor_idx on public.community_mod_cases (actor_id);
create index if not exists community_mod_cases_post_idx on public.community_mod_cases (post_id);
create index if not exists community_mod_cases_channel_idx on public.community_mod_cases (channel_id);
create index if not exists community_mod_cases_revoked_by_idx on public.community_mod_cases (revoked_by);
-- The gate reads this on every permission resolution, so it gets its own index.
create index if not exists community_mod_cases_active_timeout_idx
  on public.community_mod_cases (subject_id, expires_at) where kind = 'timeout' and revoked_at is null;

-- ------------------------------------------------------------------ reports

create table if not exists public.community_message_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason_kind text not null check (reason_kind in ('spam', 'harassment', 'hate', 'sexual', 'scam', 'other')),
  details text check (details is null or char_length(btrim(details)) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(btrim(resolution_note)) <= 500),
  resolution_case_id uuid references public.community_mod_cases(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Reporting the same message twice is not twice the signal.
  constraint community_message_reports_once unique (post_id, reporter_id)
);

create index if not exists community_message_reports_status_idx
  on public.community_message_reports (status, created_at desc);
create index if not exists community_message_reports_post_idx on public.community_message_reports (post_id);
create index if not exists community_message_reports_reporter_idx on public.community_message_reports (reporter_id);
create index if not exists community_message_reports_resolved_by_idx on public.community_message_reports (resolved_by);
create index if not exists community_message_reports_case_idx on public.community_message_reports (resolution_case_id);

-- A reports queue is only useful if it is not trivially floodable. Twenty open
-- reports in a day is far above honest use and far below what would bury a
-- moderator.
create or replace function private.assert_report_rate()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if (
    select count(*) from public.community_message_reports
    where reporter_id = new.reporter_id
      and status = 'open'
      and created_at > now() - interval '24 hours'
  ) >= 20 then
    raise exception 'You have too many open reports. A moderator will get to them shortly.';
  end if;
  return new;
end;
$$;

drop trigger if exists community_message_reports_rate_limit on public.community_message_reports;
create trigger community_message_reports_rate_limit
before insert on public.community_message_reports
for each row execute function private.assert_report_rate();

-- --------------------------------------------------------- the audit trail

alter table public.community_moderation_events
  add column if not exists case_id uuid references public.community_mod_cases(id) on delete set null;

create index if not exists community_moderation_events_case_idx
  on public.community_moderation_events (case_id);

-- The audit log recorded what happened to a message. It now also records what
-- happened to a person, so one table answers "what did this moderator do".
alter table public.community_moderation_events drop constraint if exists community_moderation_events_action_check;
alter table public.community_moderation_events
  add constraint community_moderation_events_action_check
  check (action in (
    'edit', 'delete', 'pin', 'unpin', 'flag',
    'bulk_delete', 'warn', 'timeout', 'untimeout', 'ban', 'unban',
    'report_resolved', 'automod_block'
  ));

-- --------------------------------------------------------------- the gate

-- Phase 2 shipped this returning only 'suspended', and phase 2's resolver
-- already branched on 'banned' and 'timeout'. Those branches become reachable
-- here, and the resolver does not change.
--
-- Order matters: suspension is platform-wide and outranks a community ban,
-- which outranks a timeout. Each is a strictly smaller loss of access.
create or replace function private.community_gate(target uuid)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select case
    when exists (select 1 from public.profiles where id = target and is_suspended) then 'suspended'
    when exists (
      select 1 from public.community_mod_cases
      where subject_id = target and kind = 'ban' and revoked_at is null
    ) then 'banned'
    when exists (
      select 1 from public.community_mod_cases
      where subject_id = target and kind = 'timeout' and revoked_at is null and expires_at > now()
    ) then 'timeout'
  end;
$$;

-- What the member is told, and when it ends. A timeout that says nothing about
-- when it lifts is indistinguishable from a ban to the person serving it.
create or replace function public.community_access_state()
returns table (state text, reason text, expires_at timestamptz)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    coalesce(private.community_gate((select auth.uid())), 'ok'),
    (
      select case_row.reason
      from public.community_mod_cases case_row
      where case_row.subject_id = (select auth.uid())
        and case_row.revoked_at is null
        and (case_row.kind = 'ban' or (case_row.kind = 'timeout' and case_row.expires_at > now()))
      order by case case_row.kind when 'ban' then 0 else 1 end, case_row.created_at desc
      limit 1
    ),
    (
      select case_row.expires_at
      from public.community_mod_cases case_row
      where case_row.subject_id = (select auth.uid())
        and case_row.revoked_at is null
        and (case_row.kind = 'ban' or (case_row.kind = 'timeout' and case_row.expires_at > now()))
      order by case case_row.kind when 'ban' then 0 else 1 end, case_row.created_at desc
      limit 1
    );
$$;

-- --------------------------------------------------------------- sanctions

-- Shared by every sanction RPC: you may only act on someone strictly below
-- your own highest role, and never on the owner. Without it a moderator could
-- ban the influencer.
create or replace function private.assert_can_sanction(actor uuid, target uuid, required text)
returns void
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor_perms text[];
  target_platform text;
begin
  if actor is null then
    raise exception 'Sign in to moderate.';
  end if;
  if actor = target then
    raise exception 'You cannot do that to yourself.';
  end if;

  actor_perms := public.community_permissions(actor);
  if not (required = any(actor_perms) or 'administrator' = any(actor_perms)) then
    raise exception 'You do not have permission to do that.';
  end if;

  select platform_role into target_platform from public.profiles where id = target;
  if target_platform is null then
    raise exception 'That member could not be found.';
  end if;
  if target_platform in ('influencer', 'super_admin') then
    raise exception 'That account cannot be moderated here.';
  end if;

  if not ('administrator' = any(actor_perms))
     and public.community_highest_position(target) >= public.community_highest_position(actor) then
    raise exception 'You can only moderate members below your own highest role.';
  end if;
end;
$$;

create or replace function public.community_warn_member(target uuid, reason text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  clean_reason text := btrim(coalesce(reason, ''));
  saved uuid;
begin
  perform private.assert_can_sanction(actor, target, 'moderate_members');
  if char_length(clean_reason) not between 3 and 500 then
    raise exception 'A reason must be between 3 and 500 characters.';
  end if;

  insert into public.community_mod_cases (subject_id, actor_id, kind, reason)
  values (target, actor, 'warn', clean_reason)
  returning id into saved;

  insert into public.community_moderation_events (actor_id, subject_id, action, reason, case_id)
  values (actor, target, 'warn', clean_reason, saved);

  insert into public.notifications (user_id, type, title, body, action_url)
  values (target, 'community_mod_case', 'You received a warning', clean_reason, '/dashboard/community');

  return saved;
end;
$$;

create or replace function public.community_timeout_member(target uuid, duration_seconds integer, reason text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  clean_reason text := btrim(coalesce(reason, ''));
  saved uuid;
begin
  perform private.assert_can_sanction(actor, target, 'moderate_members');
  if char_length(clean_reason) not between 3 and 500 then
    raise exception 'A reason must be between 3 and 500 characters.';
  end if;
  if duration_seconds is null or duration_seconds not between 60 and 2419200 then
    raise exception 'A timeout must be between 1 minute and 28 days.';
  end if;

  -- A second timeout replaces the first rather than stacking. Two live
  -- timeouts would make "when does this end" a question with two answers.
  update public.community_mod_cases
  set revoked_at = now(), revoked_by = actor
  where subject_id = target and kind = 'timeout' and revoked_at is null and expires_at > now();

  insert into public.community_mod_cases (subject_id, actor_id, kind, reason, duration_seconds, expires_at)
  values (target, actor, 'timeout', clean_reason, duration_seconds, now() + make_interval(secs => duration_seconds))
  returning id into saved;

  insert into public.community_moderation_events (actor_id, subject_id, action, reason, case_id)
  values (actor, target, 'timeout', clean_reason, saved);

  insert into public.notifications (user_id, type, title, body, action_url)
  values (target, 'community_mod_case', 'You have been timed out',
          clean_reason || ' You can post again in ' ||
          case when duration_seconds < 3600 then (duration_seconds / 60)::text || ' minutes'
               when duration_seconds < 86400 then (duration_seconds / 3600)::text || ' hours'
               else (duration_seconds / 86400)::text || ' days' end || '.',
          '/dashboard/community');

  return saved;
end;
$$;

create or replace function public.community_untimeout_member(target uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  clean_reason text := nullif(btrim(coalesce(reason, '')), '');
  saved uuid;
  lifted integer;
begin
  perform private.assert_can_sanction(actor, target, 'moderate_members');

  update public.community_mod_cases
  set revoked_at = now(), revoked_by = actor
  where subject_id = target and kind = 'timeout' and revoked_at is null and expires_at > now();

  get diagnostics lifted = row_count;
  if lifted = 0 then
    raise exception 'That member is not timed out.';
  end if;

  insert into public.community_mod_cases (subject_id, actor_id, kind, reason)
  values (target, actor, 'untimeout', clean_reason)
  returning id into saved;

  insert into public.community_moderation_events (actor_id, subject_id, action, reason, case_id)
  values (actor, target, 'untimeout', clean_reason, saved);
end;
$$;

-- A ban is community-scoped. It does not touch `profiles.is_suspended` and it
-- does not touch `memberships`: someone barred from the community keeps the
-- courses and events they paid for, and ending a subscription stays a separate,
-- deliberate act. A contract test asserts this body mentions neither.
create or replace function public.community_ban_member(target uuid, reason text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  clean_reason text := btrim(coalesce(reason, ''));
  saved uuid;
begin
  perform private.assert_can_sanction(actor, target, 'ban_members');
  if char_length(clean_reason) not between 3 and 500 then
    raise exception 'A reason must be between 3 and 500 characters.';
  end if;
  if exists (
    select 1 from public.community_mod_cases
    where subject_id = target and kind = 'ban' and revoked_at is null
  ) then
    raise exception 'That member is already banned.';
  end if;

  insert into public.community_mod_cases (subject_id, actor_id, kind, reason)
  values (target, actor, 'ban', clean_reason)
  returning id into saved;

  insert into public.community_moderation_events (actor_id, subject_id, action, reason, case_id)
  values (actor, target, 'ban', clean_reason, saved);

  insert into public.notifications (user_id, type, title, body, action_url)
  values (target, 'community_mod_case', 'You have been removed from the community', clean_reason, '/dashboard');

  return saved;
end;
$$;

create or replace function public.community_unban_member(target uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  clean_reason text := nullif(btrim(coalesce(reason, '')), '');
  saved uuid;
  lifted integer;
begin
  perform private.assert_can_sanction(actor, target, 'ban_members');

  update public.community_mod_cases
  set revoked_at = now(), revoked_by = actor
  where subject_id = target and kind = 'ban' and revoked_at is null;

  get diagnostics lifted = row_count;
  if lifted = 0 then
    raise exception 'That member is not banned.';
  end if;

  insert into public.community_mod_cases (subject_id, actor_id, kind, reason)
  values (target, actor, 'unban', clean_reason)
  returning id into saved;

  insert into public.community_moderation_events (actor_id, subject_id, action, reason, case_id)
  values (actor, target, 'unban', clean_reason, saved);

  insert into public.notifications (user_id, type, title, body, action_url)
  values (target, 'community_mod_case', 'You can take part in the community again', clean_reason, '/dashboard/community');
end;
$$;

-- One call, not N. Each message still gets its own audit row carrying the body
-- as it was, because "they deleted forty messages" is not a record of anything.
create or replace function public.community_bulk_delete_messages(post_ids uuid[], reason text default null)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  clean_reason text := nullif(btrim(coalesce(reason, '')), '');
  rules public.community_settings%rowtype;
  target public.posts%rowtype;
  removed integer := 0;
begin
  if actor is null then
    raise exception 'Sign in to moderate.';
  end if;
  if post_ids is null or cardinality(post_ids) = 0 then
    raise exception 'Select at least one message.';
  end if;
  if cardinality(post_ids) > 100 then
    raise exception 'Delete at most 100 messages at a time.';
  end if;

  select * into rules from public.community_settings limit 1;
  if found and rules.delete_requires_reason and clean_reason is null then
    raise exception 'This community requires a reason when deleting a message.';
  end if;
  if clean_reason is not null and char_length(clean_reason) not between 3 and 500 then
    raise exception 'A reason must be between 3 and 500 characters.';
  end if;

  for target in
    select * from public.posts where id = any(post_ids) and not is_deleted
  loop
    if not public.community_has('manage_messages', target.channel_id) then
      raise exception 'You do not have permission to delete messages in every one of those channels.';
    end if;

    update public.posts set is_deleted = true, updated_at = now() where id = target.id;

    insert into public.community_moderation_events
      (post_id, channel_id, actor_id, subject_id, action, reason, previous_body)
    values (target.id, target.channel_id, actor, target.author_id, 'bulk_delete', clean_reason, target.body);

    removed := removed + 1;
  end loop;

  return removed;
end;
$$;

-- ------------------------------------------------------------------ reports

create or replace function public.community_report_message(
  post_id uuid,
  reason_kind text,
  details text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  reporter uuid := (select auth.uid());
  clean_details text := nullif(btrim(coalesce(details, '')), '');
  target public.posts%rowtype;
  saved uuid;
begin
  if reporter is null then
    raise exception 'Sign in to report a message.';
  end if;
  if reason_kind not in ('spam', 'harassment', 'hate', 'sexual', 'scam', 'other') then
    raise exception 'Choose a reason for the report.';
  end if;
  if clean_details is not null and char_length(clean_details) > 500 then
    raise exception 'Extra detail must be 500 characters or fewer.';
  end if;

  select * into target from public.posts where id = community_report_message.post_id;
  -- You can only report what you can see, which is also what stops a report
  -- from becoming a way to learn that a message exists.
  if not found or target.is_deleted or not public.community_has('view_channel', target.channel_id) then
    raise exception 'That message could not be found.';
  end if;
  if target.author_id = reporter then
    raise exception 'You cannot report your own message.';
  end if;

  insert into public.community_message_reports (post_id, reporter_id, reason_kind, details)
  values (community_report_message.post_id, reporter, reason_kind, clean_details)
  on conflict (post_id, reporter_id) do nothing
  returning id into saved;

  if saved is null then
    raise exception 'You have already reported this message.';
  end if;

  return saved;
end;
$$;

create or replace function public.community_report_resolve(
  report_id uuid,
  next_status text,
  note text default null,
  case_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  clean_note text := nullif(btrim(coalesce(note, '')), '');
  report public.community_message_reports%rowtype;
begin
  if actor is null then
    raise exception 'Sign in to moderate.';
  end if;
  if not (public.community_has('moderate_members') or public.community_has('administrator')) then
    raise exception 'You do not have permission to resolve reports.';
  end if;
  if next_status not in ('resolved', 'dismissed') then
    raise exception 'A report is either resolved or dismissed.';
  end if;
  if clean_note is not null and char_length(clean_note) > 500 then
    raise exception 'A resolution note must be 500 characters or fewer.';
  end if;

  select * into report from public.community_message_reports where id = report_id;
  if not found then
    raise exception 'That report could not be found.';
  end if;
  if report.status <> 'open' then
    raise exception 'That report has already been dealt with.';
  end if;

  update public.community_message_reports
  set status = next_status,
      resolved_by = actor,
      resolved_at = now(),
      resolution_note = clean_note,
      resolution_case_id = community_report_resolve.case_id
  where id = report_id;

  insert into public.community_moderation_events
    (post_id, channel_id, actor_id, subject_id, action, reason, case_id)
  select report.post_id, post.channel_id, actor, post.author_id, 'report_resolved',
         coalesce(clean_note, next_status), community_report_resolve.case_id
  from public.posts post where post.id = report.post_id;
end;
$$;

-- --------------------------------------------------------------- read paths

create or replace function public.community_member_cases(
  target uuid,
  before timestamptz default null,
  page_size integer default 26
)
returns table (
  id uuid,
  case_number integer,
  kind text,
  reason text,
  duration_seconds integer,
  expires_at timestamptz,
  revoked_at timestamptz,
  source text,
  actor_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select case_row.id, case_row.case_number, case_row.kind, case_row.reason,
         case_row.duration_seconds, case_row.expires_at, case_row.revoked_at, case_row.source,
         coalesce(nullif(btrim(actor.full_name), ''), 'AutoMod'),
         case_row.created_at
  from public.community_mod_cases case_row
  left join public.profiles actor on actor.id = case_row.actor_id
  where case_row.subject_id = target
    and (public.community_has('moderate_members') or public.community_has('ban_members')
         or (target = (select auth.uid()) and case_row.kind <> 'note'))
    and (before is null or case_row.created_at < before)
  order by case_row.created_at desc
  limit least(greatest(page_size, 1), 51);
$$;

create or replace function public.community_reports_queue(
  queue_status text default 'open',
  before timestamptz default null,
  page_size integer default 26
)
returns table (
  id uuid,
  post_id uuid,
  channel_id uuid,
  channel_name text,
  post_body text,
  post_author_id uuid,
  post_author_name text,
  reporter_name text,
  reason_kind text,
  details text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select report.id, report.post_id, post.channel_id, channel.name,
         left(coalesce(post.body, ''), 280),
         post.author_id, coalesce(nullif(btrim(author.full_name), ''), 'Deleted member'),
         coalesce(nullif(btrim(reporter.full_name), ''), 'Deleted member'),
         report.reason_kind, report.details, report.status, report.created_at
  from public.community_message_reports report
  join public.posts post on post.id = report.post_id
  join public.channels channel on channel.id = post.channel_id
  left join public.profiles author on author.id = post.author_id
  left join public.profiles reporter on reporter.id = report.reporter_id
  where (public.community_has('moderate_members') or public.community_has('administrator'))
    and report.status = queue_status
    and (before is null or report.created_at < before)
  order by report.created_at desc
  limit least(greatest(page_size, 1), 51);
$$;

-- ------------------------------------------------------------------- RLS

alter table public.community_mod_cases enable row level security;
alter table public.community_message_reports enable row level security;

-- A member may read what was done to them, but not the private notes a
-- moderator left about them.
drop policy if exists community_mod_cases_read on public.community_mod_cases;
create policy community_mod_cases_read
on public.community_mod_cases
for select
to authenticated
using (
  public.community_has('moderate_members')
  or public.community_has('ban_members')
  or (subject_id = (select auth.uid()) and kind <> 'note')
);

-- The reporter can see what they filed; moderators see everything.
drop policy if exists community_message_reports_read on public.community_message_reports;
create policy community_message_reports_read
on public.community_message_reports
for select
to authenticated
using (reporter_id = (select auth.uid()) or public.community_has('moderate_members'));

-- No DML policies on either table: the RPCs above are the only writers, and
-- Supabase's default privileges grant DML on every public table regardless.
revoke insert, update, delete, truncate on public.community_mod_cases from anon, authenticated;
revoke insert, update, delete, truncate on public.community_message_reports from anon, authenticated;
grant select on public.community_mod_cases, public.community_message_reports to authenticated;
grant all on public.community_mod_cases, public.community_message_reports to service_role;

-- ------------------------------------------------------------------ grants

revoke execute on function private.assert_report_rate() from public, anon, authenticated;
revoke execute on function private.assert_can_sanction(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function private.community_gate(uuid) from public, anon, authenticated;

revoke execute on function public.community_warn_member(uuid, text) from public, anon;
revoke execute on function public.community_timeout_member(uuid, integer, text) from public, anon;
revoke execute on function public.community_untimeout_member(uuid, text) from public, anon;
revoke execute on function public.community_ban_member(uuid, text) from public, anon;
revoke execute on function public.community_unban_member(uuid, text) from public, anon;
revoke execute on function public.community_bulk_delete_messages(uuid[], text) from public, anon;
revoke execute on function public.community_report_message(uuid, text, text) from public, anon;
revoke execute on function public.community_report_resolve(uuid, text, text, uuid) from public, anon;
revoke execute on function public.community_member_cases(uuid, timestamptz, integer) from public, anon;
revoke execute on function public.community_reports_queue(text, timestamptz, integer) from public, anon;
revoke execute on function public.community_access_state() from public, anon;

grant execute on function public.community_warn_member(uuid, text) to authenticated, service_role;
grant execute on function public.community_timeout_member(uuid, integer, text) to authenticated, service_role;
grant execute on function public.community_untimeout_member(uuid, text) to authenticated, service_role;
grant execute on function public.community_ban_member(uuid, text) to authenticated, service_role;
grant execute on function public.community_unban_member(uuid, text) to authenticated, service_role;
grant execute on function public.community_bulk_delete_messages(uuid[], text) to authenticated, service_role;
grant execute on function public.community_report_message(uuid, text, text) to authenticated, service_role;
grant execute on function public.community_report_resolve(uuid, text, text, uuid) to authenticated, service_role;
grant execute on function public.community_member_cases(uuid, timestamptz, integer) to authenticated, service_role;
grant execute on function public.community_reports_queue(text, timestamptz, integer) to authenticated, service_role;
grant execute on function public.community_access_state() to authenticated, service_role;

-- --------------------------------------------------------- schema cache

-- Two new tables and a changed function signature. Without this the API keeps
-- serving the old schema and answers "column does not exist" for rows that are
-- plainly there — see the phase 3 incident on 2026-09-11.
notify pgrst, 'reload schema';
