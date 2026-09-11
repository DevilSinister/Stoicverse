-- Undo for 20260911010000_community_composer_rules.
--
-- Restores the reaction policy to its pre-migration form: no emoji predicate,
-- so any emoji is accepted again.

drop function if exists public.community_composer_rules();

drop trigger if exists posts_assert_content on public.posts;
drop function if exists private.assert_post_content_allowed();

alter table public.posts drop constraint if exists posts_body_length_check;

drop policy if exists reactions_own_write on public.reactions;
create policy reactions_own_write
  on public.reactions
  for all
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.posts post
      where post.id = reactions.post_id and not post.is_deleted and public.can_view_channel(post.channel_id)
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.posts post
      where post.id = reactions.post_id and not post.is_deleted and public.can_view_channel(post.channel_id)
    )
  );

alter table public.community_settings drop constraint if exists community_settings_composer_bounds;

alter table public.community_settings
  drop column if exists reaction_emojis,
  drop column if exists max_body_length,
  drop column if exists allow_links,
  drop column if exists allow_attachments,
  drop column if exists max_attachment_bytes,
  drop column if exists allowed_attachment_types;
