-- Keep authorization fields server-controlled. Member-facing clients may only edit profile text fields.
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
grant update on public.profiles to service_role;
