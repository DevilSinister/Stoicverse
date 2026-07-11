-- Pin helper function resolution to trusted schemas.
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.on_membership_activated() set search_path = public, pg_temp;
alter function public.is_super_admin() set search_path = public, pg_temp;
alter function public.is_community_staff(uuid) set search_path = public, pg_temp;
alter function public.is_community_influencer(uuid) set search_path = public, pg_temp;
alter function public.has_community_access(uuid, integer) set search_path = public, pg_temp;

-- This event-trigger helper is database-internal, not an RPC endpoint.
revoke execute on function public.rls_auto_enable() from anon, authenticated;
