-- Undo for 20260911000000_community_settings_identity.
--
-- Dropping community_settings destroys the branding, welcome message and rules
-- the influencer has written. Nothing else reads that data, so there is no
-- backup elsewhere. Copy the row out before running this if any of it matters.
--
-- The storage bucket is NOT dropped: it may hold an uploaded logo, and deleting
-- a bucket deletes its objects. Remove it by hand after confirming it is empty.

drop policy if exists community_branding_influencer_write on storage.objects;

drop function if exists public.set_community_name(text);
drop function if exists public.community_branding();

drop trigger if exists community_settings_touch on public.community_settings;
drop function if exists public.touch_community_settings();

drop policy if exists community_settings_influencer_update on public.community_settings;
drop policy if exists community_settings_member_read on public.community_settings;

drop table if exists public.community_settings;
