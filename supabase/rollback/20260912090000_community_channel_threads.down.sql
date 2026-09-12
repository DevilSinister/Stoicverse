-- Rollback for 20260912090000_community_channel_threads.sql
--
-- Drops one read-only function. Nothing is lost: no table, column, policy or
-- row is touched by the forward migration, so this restores the database
-- exactly as it was.
--
-- What breaks after this runs: the thread list popover on `/channels` reads
-- `community_channel_threads` and will report threads as unreadable. Threads
-- themselves keep working — creating, replying, opening one from its root
-- message and archiving all go through the Phase 8 functions, which this does
-- not touch.

begin;

drop function if exists public.community_channel_threads(uuid);

notify pgrst, 'reload schema';

commit;
