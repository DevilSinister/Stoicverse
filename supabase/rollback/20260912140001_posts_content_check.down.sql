-- Undo 20260912140001_posts_content_check.
--
-- Restoring `posts_check` restores the defect it was written to fix: a message
-- carrying only attachments, and a forward carrying no note, both become
-- unsendable again. Worse, any such row already written will fail the
-- constraint's validation and this script will stop rather than leave the
-- table half-guarded — which is the right outcome, and the count to look at
-- first is:
--
--   select count(*) from public.posts
--   where not is_deleted and body is null and image_url is null and video_file_id is null;

begin;

drop trigger if exists posts_has_content on public.posts;
drop function if exists private.assert_post_has_content();

alter table public.posts
  add constraint posts_check
  check (body is not null or image_url is not null or video_file_id is not null);

notify pgrst, 'reload schema';

commit;
