-- Undo phase 7's safety gates.
--
-- Order matters: the gate stops returning the three new values *before* the
-- table and columns they read are dropped, so there is no window in which a
-- member's permissions are resolved against a column that has gone.
--
-- Acceptances are dropped with the table. Nothing else references them, and a
-- rules version that no longer exists cannot be accepted against.

-- The gate first, back to sanctions only.
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

-- Then the shape the page reads.
drop function if exists public.community_access_state();

create function public.community_access_state()
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

revoke execute on function public.community_access_state() from public, anon;
grant execute on function public.community_access_state() to authenticated;

-- Triggers before the functions they call.
drop trigger if exists memberships_enforce_join_rate on public.memberships;
drop trigger if exists community_settings_log_rules on public.community_settings;
drop trigger if exists community_settings_rules_channel on public.community_settings;

drop function if exists private.enforce_join_rate();
drop function if exists private.log_rules_update();
drop function if exists private.assert_rules_channel();
drop function if exists public.community_clear_lockdown();
drop function if exists public.community_accept_rules();
drop function if exists public.community_rules_acceptance_count();

create or replace function public.touch_community_settings()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  new.id := true;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

drop table if exists public.community_rules_acceptances;

alter table public.community_settings
  drop constraint if exists community_settings_safety_bounds;

alter table public.community_settings
  drop column if exists rules_version,
  drop column if exists rules_updated_at,
  drop column if exists rules_channel_id,
  drop column if exists verification_level,
  drop column if exists verification_minutes,
  drop column if exists join_rate_limit,
  drop column if exists join_rate_window_minutes,
  drop column if exists lockdown_minutes,
  drop column if exists raid_lockdown_until;

-- Rows written under the two new actions have to go before the CHECK that
-- refuses them is restored, or the constraint cannot be validated.
delete from public.community_moderation_events where action in ('raid_lockdown', 'rules_updated');

alter table public.community_moderation_events
  drop constraint if exists community_moderation_events_action_check;

alter table public.community_moderation_events
  add constraint community_moderation_events_action_check check (
    action = any (array[
      'edit', 'delete', 'pin', 'unpin', 'flag', 'bulk_delete',
      'warn', 'timeout', 'untimeout', 'ban', 'unban',
      'report_resolved', 'automod_block'
    ])
  );

notify pgrst, 'reload schema';
