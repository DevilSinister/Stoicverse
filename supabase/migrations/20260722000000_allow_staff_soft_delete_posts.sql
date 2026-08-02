-- Staff may soft-delete posts they can currently access. Once is_deleted is
-- true, the normal channel visibility check is intentionally no longer used
-- for the updated row because posts_read excludes deleted posts.
drop policy if exists posts_staff_update on public.posts;
create policy posts_staff_update on public.posts
for update to authenticated
using (public.is_staff() and public.can_view_channel(channel_id))
with check (public.is_staff() and (is_deleted or public.can_view_channel(channel_id)));

-- Use a narrowly-scoped RPC for moderation deletes. It avoids PostgreSQL
-- re-checking the now-hidden row through the regular UPDATE policy while
-- retaining the current staff and channel-visibility checks.
create or replace function public.soft_delete_post(target_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
$$;

revoke all on function public.soft_delete_post(uuid) from public, anon;
grant execute on function public.soft_delete_post(uuid) to authenticated, service_role;
