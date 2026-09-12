-- Phase 7 — safety gates.
--
-- Three ways the community can hold somebody back from posting without
-- sanctioning them personally, and one automatic one:
--
--   * **Rules.** The rules carry a version. Publishing an edit bumps it, and
--     every member accepts the new one before they can post again.
--   * **Member age.** A membership younger than N minutes can read but not
--     post — the cheapest possible answer to an account made to post once.
--   * **Lockdown.** More than N joins inside a window trips a timed lockdown
--     of the whole community, recorded in the audit log and pushed to the
--     people who can lift it.
--
-- None of these is a sanction, so none writes a moderation case. They are
-- properties of the community, and they lift themselves.
--
-- The resolver already knows about them: `community_permissions` has handled
-- `gate in ('timeout','rules','verification','lockdown')` since phase 8, and
-- strips the posting keys for all four. This migration is what finally makes
-- the last three reachable.
--
-- Two shapes worth naming:
--
--   * **`rules_channel_id` is checked by a trigger, not a CHECK.** The rule is
--     "must be a channel of type rules", which reads another table, and a
--     CHECK constraint cannot. `posts_check` was written that way once and
--     silently un-shipped attachments-only messages for a day.
--   * **The join-rate trigger can never refuse a join.** It hangs off
--     `memberships`, which is the table Stripe writes through. Its whole body
--     is inside an exception block: raid protection failing must cost somebody
--     a lockdown, never a membership they paid for.

-- ---------------------------------------------------------------- settings

alter table public.community_settings
  add column if not exists rules_version int not null default 1,
  add column if not exists rules_updated_at timestamptz,
  add column if not exists rules_channel_id uuid references public.channels(id) on delete set null,
  add column if not exists verification_level text not null default 'none',
  add column if not exists verification_minutes int not null default 0,
  add column if not exists join_rate_limit int not null default 0,
  add column if not exists join_rate_window_minutes int not null default 10,
  add column if not exists lockdown_minutes int not null default 30,
  add column if not exists raid_lockdown_until timestamptz;

alter table public.community_settings
  drop constraint if exists community_settings_safety_bounds;

alter table public.community_settings
  add constraint community_settings_safety_bounds check (
    verification_level in ('none', 'member_age', 'accepted_rules')
    and verification_minutes between 0 and 10080
    and join_rate_limit between 0 and 500
    and join_rate_window_minutes between 1 and 60
    and lockdown_minutes between 5 and 1440
    and rules_version >= 1
  );

comment on column public.community_settings.rules_version is
  'Bumped by touch_community_settings whenever the rules text changes. Acceptances are per version.';
comment on column public.community_settings.raid_lockdown_until is
  'Set by private.enforce_join_rate, cleared by community_clear_lockdown. While in the future, members cannot post.';

-- The rules channel has to *be* a rules channel, and that reads `channels`.
create or replace function private.assert_rules_channel()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.rules_channel_id is not null and not exists (
    select 1 from public.channels
    where id = new.rules_channel_id and type = 'rules'
  ) then
    raise exception 'The rules channel must be a channel of type rules.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function private.assert_rules_channel() from public, anon, authenticated;

drop trigger if exists community_settings_rules_channel on public.community_settings;
create trigger community_settings_rules_channel
  before insert or update of rules_channel_id on public.community_settings
  for each row execute function private.assert_rules_channel();

-- ------------------------------------------------------- the rules version

create or replace function public.touch_community_settings()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  new.id := true;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  -- Only the text moving counts. Saving the same rules again must not ask
  -- every member to read them a second time.
  if tg_op = 'UPDATE' and new.rules is distinct from old.rules then
    new.rules_version := old.rules_version + 1;
    new.rules_updated_at := now();
  end if;
  return new;
end;
$$;

create or replace function private.log_rules_update()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.rules_version is distinct from old.rules_version then
    insert into public.community_moderation_events (actor_id, action, reason)
    values (new.updated_by, 'rules_updated',
            format('The rules were republished as version %s.', new.rules_version));
  end if;
  return null;
end;
$$;

revoke execute on function private.log_rules_update() from public, anon, authenticated;

drop trigger if exists community_settings_log_rules on public.community_settings;
create trigger community_settings_log_rules
  after update on public.community_settings
  for each row execute function private.log_rules_update();

-- ------------------------------------------------------------ acceptances

create table if not exists public.community_rules_acceptances (
  user_id uuid not null references public.profiles(id) on delete cascade,
  rules_version int not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, rules_version)
);

alter table public.community_rules_acceptances enable row level security;

drop policy if exists rules_acceptances_select_own on public.community_rules_acceptances;
create policy rules_acceptances_select_own on public.community_rules_acceptances
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists rules_acceptances_insert_own on public.community_rules_acceptances;
create policy rules_acceptances_insert_own on public.community_rules_acceptances
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Append-only. Supabase's default privileges have already handed every public
-- table to `anon` and `authenticated`, so the absence of an update policy is
-- not on its own a bar to updating: the revoke is.
revoke update, delete, truncate on public.community_rules_acceptances from public, anon, authenticated;

create index if not exists community_rules_acceptances_version_idx
  on public.community_rules_acceptances (rules_version);

-- ------------------------------------------------------------------- gate

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
    -- A CASE arm returning null ends the CASE, which is exactly what is wanted
    -- here: the owner and the platform's admins are never held by a soft gate.
    -- They are the people who would have to clear it.
    when exists (
      select 1 from public.profiles
      where id = target and platform_role in ('influencer', 'super_admin')
    ) then null::text
    when exists (
      select 1 from public.community_settings s where s.raid_lockdown_until > now()
    ) then 'lockdown'
    -- Rules with no text would lock everyone out of a page with nothing on it.
    when exists (
      select 1 from public.community_settings s
      where s.verification_level = 'accepted_rules'
        and coalesce(btrim(s.rules), '') <> ''
        and not exists (
          select 1 from public.community_rules_acceptances a
          where a.user_id = target and a.rules_version = s.rules_version
        )
    ) then 'rules'
    when exists (
      select 1 from public.community_settings s
      join public.memberships m on m.user_id = target and m.status = 'active'
      where s.verification_level = 'member_age'
        and s.verification_minutes > 0
        and coalesce(m.joined_at, m.created_at) > now() - make_interval(mins => s.verification_minutes)
    ) then 'verification'
  end;
$$;

revoke execute on function private.community_gate(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------ accept rules

create or replace function public.community_accept_rules()
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  viewer uuid := (select auth.uid());
  current_version int;
begin
  if viewer is null then
    raise exception 'Sign in to accept the rules.' using errcode = '42501';
  end if;
  -- A banned member accepting the rules would be asking to be let back in.
  if private.community_gate(viewer) in ('suspended', 'banned') then
    raise exception 'You cannot accept the rules right now.' using errcode = '42501';
  end if;

  select s.rules_version into current_version from public.community_settings s where s.id;
  current_version := coalesce(current_version, 1);

  insert into public.community_rules_acceptances (user_id, rules_version)
  values (viewer, current_version)
  on conflict (user_id, rules_version) do nothing;

  return current_version;
end;
$$;

revoke execute on function public.community_accept_rules() from public, anon;
grant execute on function public.community_accept_rules() to authenticated;

create or replace function public.community_rules_acceptance_count()
returns int
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select count(*)::int
  from public.community_rules_acceptances a
  join public.community_settings s on s.id and s.rules_version = a.rules_version
  where public.community_has('manage_community');
$$;

revoke execute on function public.community_rules_acceptance_count() from public, anon;
grant execute on function public.community_rules_acceptance_count() to authenticated;

-- -------------------------------------------------------- raid protection

create or replace function private.enforce_join_rate()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  settings public.community_settings%rowtype;
  recent int;
  until timestamptz;
begin
  begin
    select * into settings from public.community_settings s where s.id;
    if not found or settings.join_rate_limit = 0 then return null; end if;
    -- Already locked down: extending it on every further join would make the
    -- lockdown outlast the raid by however long the raid ran.
    if coalesce(settings.raid_lockdown_until, '-infinity'::timestamptz) > now() then return null; end if;

    select count(*) into recent
    from public.memberships m
    where m.status = 'active'
      and coalesce(m.joined_at, m.created_at) > now() - make_interval(mins => settings.join_rate_window_minutes);

    if recent < settings.join_rate_limit then return null; end if;

    until := now() + make_interval(mins => settings.lockdown_minutes);
    update public.community_settings s set raid_lockdown_until = until where s.id;

    insert into public.community_moderation_events (action, reason)
    values ('raid_lockdown',
            format('%s joined within %s minutes. Posting is locked for %s minutes.',
                   recent, settings.join_rate_window_minutes, settings.lockdown_minutes));

    -- To the people who can lift it, and nobody else.
    insert into public.notifications (user_id, type, title, body, action_url)
    select distinct member.user_id,
           'community_lockdown',
           'The community locked down',
           format('%s members joined within %s minutes.', recent, settings.join_rate_window_minutes),
           '/channels/settings?section=safety'
    from public.community_role_members member
    join public.community_roles role on role.id = member.role_id
    where role.permissions && array['moderate_members', 'manage_community', 'administrator']::text[]
    union
    select p.id, 'community_lockdown', 'The community locked down',
           format('%s members joined within %s minutes.', recent, settings.join_rate_window_minutes),
           '/channels/settings?section=safety'
    from public.profiles p
    where p.platform_role in ('influencer', 'super_admin');

    return null;
  exception
    when others then
      -- Raid protection must never be the reason somebody cannot join the
      -- community they have just paid for.
      return null;
  end;
end;
$$;

-- A trigger function is invoked by the trigger, never called by name, so
-- nobody needs EXECUTE on it. A definer left executable by PUBLIC is a hole
-- whether or not anybody has found the handle yet.
revoke execute on function private.enforce_join_rate() from public, anon, authenticated;

drop trigger if exists memberships_enforce_join_rate on public.memberships;
create trigger memberships_enforce_join_rate
  after insert or update of status on public.memberships
  for each row when (new.status = 'active')
  execute function private.enforce_join_rate();

create or replace function public.community_clear_lockdown()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.community_has('manage_community') then
    raise exception 'You cannot change safety settings.' using errcode = '42501';
  end if;
  update public.community_settings s set raid_lockdown_until = null where s.id;
  insert into public.community_moderation_events (actor_id, action, reason)
  values ((select auth.uid()), 'raid_lockdown', 'The lockdown was lifted by hand.');
end;
$$;

revoke execute on function public.community_clear_lockdown() from public, anon;
grant execute on function public.community_clear_lockdown() to authenticated;

-- --------------------------------------------------------- audit vocabulary

alter table public.community_moderation_events
  drop constraint if exists community_moderation_events_action_check;

alter table public.community_moderation_events
  add constraint community_moderation_events_action_check check (
    action = any (array[
      'edit', 'delete', 'pin', 'unpin', 'flag', 'bulk_delete',
      'warn', 'timeout', 'untimeout', 'ban', 'unban',
      'report_resolved', 'automod_block',
      'raid_lockdown', 'rules_updated'
    ])
  );

-- ------------------------------------------------------------ access state

-- Dropped and recreated rather than replaced: the return type gains three
-- columns, and `create or replace` cannot change one. The grants do not
-- survive that, which is why they are written again below.
drop function if exists public.community_access_state();

create function public.community_access_state()
returns table (
  state text,
  reason text,
  expires_at timestamptz,
  rules_version int,
  rules_accepted boolean,
  verification_until timestamptz
)
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
    ),
    coalesce((select s.rules_version from public.community_settings s where s.id), 1),
    exists (
      select 1
      from public.community_rules_acceptances a
      join public.community_settings s on s.id and s.rules_version = a.rules_version
      where a.user_id = (select auth.uid())
    ),
    (
      select coalesce(m.joined_at, m.created_at) + make_interval(mins => s.verification_minutes)
      from public.community_settings s
      join public.memberships m on m.user_id = (select auth.uid()) and m.status = 'active'
      where s.verification_level = 'member_age' and s.verification_minutes > 0
      limit 1
    );
$$;

revoke execute on function public.community_access_state() from public, anon;
grant execute on function public.community_access_state() to authenticated;

notify pgrst, 'reload schema';
