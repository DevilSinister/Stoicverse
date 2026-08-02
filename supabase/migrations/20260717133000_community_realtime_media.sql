-- Private media is stored by the posting staff member. Readers only receive a
-- signed URL after the post's channel policy has allowed them to see that post.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-posts', 'community-posts', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']::text[])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists community_posts_staff_upload on storage.objects;
create policy community_posts_staff_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'community-posts'
  and public.is_staff()
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists community_posts_visible_read on storage.objects;
create policy community_posts_visible_read on storage.objects for select to authenticated using (
  bucket_id = 'community-posts'
  and exists (
    select 1 from public.posts post
    where post.image_url = name
      and not post.is_deleted
      and public.can_view_channel(post.channel_id)
  )
);

drop policy if exists community_posts_staff_delete on storage.objects;
create policy community_posts_staff_delete on storage.objects for delete to authenticated using (
  bucket_id = 'community-posts'
  and public.is_staff()
  and owner_id = (select auth.uid())::text
);

alter table public.reactions replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts') then
    alter publication supabase_realtime add table public.posts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reactions') then
    alter publication supabase_realtime add table public.reactions;
  end if;
end;
$$;
