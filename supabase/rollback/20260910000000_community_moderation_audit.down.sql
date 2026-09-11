-- Rollback for 20260910000000_community_moderation_audit.sql
--
-- Not a migration. Files in this directory are never applied forward; they exist
-- so every production DDL change has a written, reviewed way back. Run manually
-- via the dashboard or MCP.
--
-- Restores the pre-Phase-1 state exactly as captured from the live database on
-- 2026-09-10:
--   posts_staff_update  using (is_staff() and can_view_channel(channel_id))
--                       with check (is_staff() and (is_deleted or can_view_channel(channel_id)))
--   soft_delete_post(uuid)  staff-only, no reason, no audit row
--
-- NOTE: this drops the audit table and every row in it. If the audit history
-- matters, copy it out first:
--   create table public.community_moderation_events_backup as
--     select * from public.community_moderation_events;

drop trigger if exists posts_guard_update on public.posts;
drop function if exists public.guard_post_update();

drop policy if exists posts_author_or_staff_update on public.posts;
create policy posts_staff_update on public.posts
for update to authenticated
using (public.is_staff() and public.can_view_channel(channel_id))
with check (public.is_staff() and (is_deleted or public.can_view_channel(channel_id)));

drop function if exists public.soft_delete_post(uuid, text);

create or replace function public.soft_delete_post(target_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if not public.is_staff() or not exists (
    select 1
    from public.posts post
    where post.id = target_post_id
      and not post.is_deleted
      and public.can_view_channel(post.channel_id)
  ) then
    raise exception 'staff access is required';
  end if;

  update public.posts
  set is_deleted = true, updated_at = now()
  where id = target_post_id and not is_deleted;

  return found;
end;
$function$;

revoke all on function public.soft_delete_post(uuid) from public, anon;
grant execute on function public.soft_delete_post(uuid) to authenticated, service_role;

drop table if exists public.community_moderation_events;
