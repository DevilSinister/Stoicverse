-- Phase P2 — list the threads in a channel.
--
-- Phase 8 gave threads a table, a create RPC and a set-state RPC, but nothing
-- that lists them: `community_channel_messages` returns a thread's *summary*
-- on the root message and nothing else. The thread list popover needs the
-- channel's threads ordered by recency, which is a query no existing function
-- answers.
--
-- `public.threads` does carry a `select` policy gated on `view_channel`, and
-- an index on `(channel_id, last_message_at desc nulls last)` that is exactly
-- this ordering — so the member page could read the table directly. It does
-- not, deliberately. `src/lib/community/messages.ts` reads RPCs and never base
-- tables, and `tests/community-messages.contract.mjs` asserts it, because the
-- member path touching a table whose policy is one clause away from a staff
-- gate is the bug class that layer exists to prevent. One small function is
-- cheaper than an exception to that rule.

begin;

do $$
begin
  if not exists (select 1 from pg_class where relname = 'threads' and relnamespace = 'public'::regnamespace) then
    raise exception 'public.threads is missing: apply 20260912070000_community_messages.sql first';
  end if;
  if not exists (select 1 from pg_proc where proname = 'community_has' and pronamespace = 'public'::regnamespace) then
    raise exception 'public.community_has is missing: apply the permission resolver migration first';
  end if;
end
$$;

-- Invoker, not definer: `threads_read` already says who may see a thread, and
-- the whole answer is one policy on one table. A definer here would be a
-- second copy of that rule, free to drift from it.
create or replace function public.community_channel_threads(channel uuid)
returns table (
  id uuid,
  root_post_id uuid,
  name text,
  message_count integer,
  last_message_at timestamptz,
  created_at timestamptz,
  archived boolean,
  locked boolean
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  select
    t.id,
    t.root_post_id,
    t.name,
    t.message_count,
    t.last_message_at,
    t.created_at,
    t.archived_at is not null as archived,
    t.locked
  from public.threads t
  where t.channel_id = community_channel_threads.channel
  -- An archived thread stays readable and stays listed, below the live ones.
  -- Hiding it would lose the conversation; a member who remembers it would
  -- have no way back to it.
  order by t.archived_at is not null, t.last_message_at desc nulls last, t.created_at desc
  limit 200;
$$;

comment on function public.community_channel_threads(uuid) is
  'Threads in one channel, live first then archived, each ordered by recency. Security invoker: threads_read decides visibility.';

-- A function is executable by PUBLIC by default. Every other function in this
-- feature revokes that first; so does this one.
revoke execute on function public.community_channel_threads(uuid) from public, anon;
grant execute on function public.community_channel_threads(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
