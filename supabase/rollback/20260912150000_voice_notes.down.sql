-- Undo 20260912150000_voice_notes.
--
-- Narrowing the allow-list will fail if any audio attachment has been sent —
-- which is the right outcome. Count them before running this:
--
--   select count(*) from public.post_attachments where mime_type like 'audio/%';
--
-- `community_send_message` and `community_channel_messages` are left as they
-- are: the first would simply refuse audio again once the CHECK is narrowed,
-- and the second returning a `durationSeconds` of null for every attachment is
-- harmless. Re-running the previous migrations restores their exact bodies.

begin;

alter table public.post_attachments
  drop constraint if exists post_attachments_mime_type_check;
alter table public.post_attachments
  add constraint post_attachments_mime_type_check
  check (mime_type = any (array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'application/pdf'
  ]));

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'application/pdf'
]
where id = 'community-posts';

alter table public.post_attachments drop constraint if exists post_attachments_duration_seconds_check;
alter table public.post_attachments drop column if exists duration_seconds;

notify pgrst, 'reload schema';

commit;
