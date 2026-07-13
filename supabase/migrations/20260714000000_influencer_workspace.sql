-- The dedicated influencer workspace needs access to operational rows, while members retain the existing gated read policies.
create policy influencer_channels_manage on public.channels for all to authenticated using (public.is_influencer()) with check (public.is_influencer());
create policy influencer_lessons_manage on public.lessons for all to authenticated using (public.is_influencer()) with check (public.is_influencer());
create policy influencer_events_manage on public.events for all to authenticated using (public.is_influencer()) with check (public.is_influencer());
create policy influencer_reviews_manage on public.review_applications for all to authenticated using (public.is_influencer()) with check (public.is_influencer());
create policy influencer_profiles_read on public.profiles for select to authenticated using (public.is_influencer());
create policy influencer_moderator_assignment on public.profiles for update to authenticated
using (public.is_influencer() and platform_role in ('member', 'moderator'))
with check (public.is_influencer() and platform_role in ('member', 'moderator'));
grant insert, update, delete on public.channels to authenticated;
grant insert, update, delete on public.lessons to authenticated;
grant update on public.review_applications to authenticated;
grant update (platform_role) on public.profiles to authenticated;
