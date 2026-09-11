-- Rollback for 20260912030000_community_moderation_cases.
--
-- DATA LOSS, stated plainly: every moderation case and every message report is
-- dropped, including the reasons attached to them. That is the whole record of
-- who was warned, timed out or banned and why — there is nowhere else it
-- exists. The `community_moderation_events` rows those actions wrote do not
-- fit the restored CHECK either, so they are deleted too.
--
-- Run only while phase 5 has not been applied.

do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'community_automod_rules'
  ) then
    raise exception 'refusing to roll back: phase 5 (community_automod_rules) is applied and depends on this phase';
  end if;

  raise notice 'rollback will destroy % case(s) and % report(s)',
    (select count(*) from public.community_mod_cases),
    (select count(*) from public.community_message_reports);
end $$;

-- ------------------------------------------------------------------ the gate

-- Back to phase 2's shape: suspension only. Any live ban or timeout stops
-- taking effect the moment this runs, which is the point of the warning above.
create or replace function private.community_gate(target uuid)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select case
    when exists (select 1 from public.profiles where id = target and is_suspended) then 'suspended'
  end;
$$;

revoke execute on function private.community_gate(uuid) from public, anon, authenticated;

drop function if exists public.community_access_state();
create or replace function public.community_access_state()
returns table (state text, reason text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(private.community_gate((select auth.uid())), 'ok'), null::text;
$$;

revoke execute on function public.community_access_state() from public, anon;
grant execute on function public.community_access_state() to authenticated, service_role;

-- --------------------------------------------------------------- functions

drop function if exists public.community_warn_member(uuid, text);
drop function if exists public.community_timeout_member(uuid, integer, text);
drop function if exists public.community_untimeout_member(uuid, text);
drop function if exists public.community_ban_member(uuid, text);
drop function if exists public.community_unban_member(uuid, text);
drop function if exists public.community_bulk_delete_messages(uuid[], text);
drop function if exists public.community_report_message(uuid, text, text);
drop function if exists public.community_report_resolve(uuid, text, text, uuid);
drop function if exists public.community_member_cases(uuid, timestamptz, integer);
drop function if exists public.community_reports_queue(text, timestamptz, integer);
drop function if exists private.assert_can_sanction(uuid, uuid, text);

drop trigger if exists community_message_reports_rate_limit on public.community_message_reports;
drop function if exists private.assert_report_rate();

-- ----------------------------------------------------------- the audit trail

-- The person-scoped actions have no home in the restored CHECK. Deleting them
-- is the only way back, and it is why this rollback is lossy.
delete from public.community_moderation_events
where action in ('bulk_delete', 'warn', 'timeout', 'untimeout', 'ban', 'unban', 'report_resolved', 'automod_block');

alter table public.community_moderation_events drop constraint if exists community_moderation_events_action_check;
alter table public.community_moderation_events
  add constraint community_moderation_events_action_check
  check (action in ('edit', 'delete', 'pin', 'unpin', 'flag'));

drop index if exists community_moderation_events_case_idx;
alter table public.community_moderation_events drop column if exists case_id;

-- -------------------------------------------------------------------- tables

drop table if exists public.community_message_reports;
drop table if exists public.community_mod_cases;

notify pgrst, 'reload schema';
