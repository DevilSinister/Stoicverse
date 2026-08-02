-- Close a privilege-escalation path that let any authenticated user make
-- themselves super_admin, and repair the notifications write grant.
--
-- How the escalation worked
-- -------------------------
-- 20260711000001_profile_update_hardening.sql correctly narrowed profile writes:
--     revoke update on public.profiles from authenticated;
--     grant update (full_name, avatar_url) on public.profiles to authenticated;
--
-- 20260714000000_influencer_workspace.sql then re-opened the authorization
-- column to EVERY authenticated user in order to support one influencer feature:
--     grant update (platform_role) on public.profiles to authenticated;
--
-- The accompanying policy (influencer_moderator_assignment) does constrain the
-- change to is_influencer() and roles in (member, moderator). But PostgreSQL
-- combines PERMISSIVE policies for the same command with OR, and the older
-- profiles_update policy is still permissive and still active:
--     using       (id = auth.uid() or public.is_super_admin())
--     with check  (id = auth.uid() or public.is_super_admin())
--
-- Its WITH CHECK never inspects the new platform_role, so
--     update profiles set platform_role = 'super_admin' where id = auth.uid();
-- satisfies profiles_update and is accepted. There are no RESTRICTIVE policies
-- anywhere in the schema to AND against it. Result: any signed-up user could
-- take over the platform using only the publishable/anon key.
--
-- Why revoking is safe
-- --------------------
-- Every reference to platform_role in src/ is a SELECT; no application code
-- writes the column. The influencer moderator-assignment feature is not built
-- yet, so removing the grant breaks nothing today. When it is built it must go
-- through a security definer RPC, matching save_creator_event, soft_delete_post
-- and the rest of this schema's write paths.

-- The migration runner wraps this file in its own transaction; no explicit
-- begin/commit here.

-- 1. Remove the column-level write. This alone closes the escalation: the GRANT
--    layer is evaluated before RLS, so no policy combination can reach the
--    column afterwards.
revoke update (platform_role) on public.profiles from authenticated;

-- 2. Drop the now-unreachable policy so the schema does not imply a capability
--    that no longer exists.
drop policy if exists influencer_moderator_assignment on public.profiles;

-- 3. Defense in depth. Even if a future migration re-grants the column, this
--    trigger is the authoritative check: it can compare OLD and NEW, which an
--    RLS WITH CHECK cannot. service_role (auth.uid() is null under the service
--    key) and super_admins remain able to set roles.
create or replace function private.guard_platform_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.platform_role is distinct from old.platform_role then
    if (select auth.uid()) is null then
      return new;  -- service_role / server-side administration
    end if;

    if public.is_super_admin() then
      return new;
    end if;

    raise exception 'platform_role may not be changed by this account'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_platform_role_change() from public, anon, authenticated;

drop trigger if exists guard_platform_role_change on public.profiles;
create trigger guard_platform_role_change
  before update of platform_role on public.profiles
  for each row
  execute function private.guard_platform_role_change();

-- 4. Unrelated but adjacent: notifications_own_update has existed since the
--    initial schema, but authenticated was only ever granted SELECT on the
--    table. GRANTs are checked before RLS, so marking a notification read
--    (src/app/api/dashboard/notifications/route.ts) always failed. Grant the
--    two columns the policy already scopes to the owning user.
grant update (is_read, read_at) on public.notifications to authenticated;

-- 5. Supabase's database linter reports these four security definer functions as
--    still callable by anon over /rest/v1/rpc, despite the blanket revokes in
--    earlier migrations. Verified safe to revoke: every policy referencing
--    is_active_member/has_tier_access is scoped `to authenticated`, and the only
--    anon-readable policies (settings_public_read, and communities_public_read
--    on a since-dropped table) reference neither.
--    Revoke from PUBLIC, not from `anon`. These functions carry the default
--    `=X/postgres` ACL entry, i.e. EXECUTE granted to PUBLIC; a role-specific
--    revoke cannot remove a privilege held that way and silently does nothing.
--    Their explicit `authenticated=X` grant survives, so RLS keeps working.
revoke execute on function public.is_active_member() from public;
revoke execute on function public.has_tier_access(integer) from public;

--    These two are trigger functions. A trigger fires without consulting the
--    caller's EXECUTE privilege, so no role needs it — exposing them as RPC is
--    purely surface area.
revoke execute on function public.invalidate_course_completion_on_required_video() from public;
revoke execute on function public.notify_community_mentions() from public;
