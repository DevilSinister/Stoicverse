-- "A message needs something in it" has to be asked after the attachments arrive.
--
-- `posts_check` was `body is not null or image_url is not null or
-- video_file_id is not null`, evaluated row-by-row at insert time. Phase 8
-- moved attachments into their own table, `post_attachments`, inserted
-- immediately after the post they belong to — and a CHECK constraint cannot
-- see another table, so from that phase onward **a message carrying only
-- files and no text has been refused outright**. `community_send_message`
-- writes `nullif(btrim(coalesce(body, '')), '')`, which is null for such a
-- message, and never writes `image_url`. Proven against this database on
-- 2026-09-12: the insert fails with `posts_check`.
--
-- Nobody reported it, because the failure arrives as a refused send rather
-- than as anything that says "attachments". It was found while adding
-- forwarding, which hits the same wall for the same reason: a forward with no
-- note attached has no body either.
--
-- The fix is a **deferred constraint trigger**. Deferred, because the answer
-- to "does this message have anything in it" is only knowable at the end of
-- the transaction that writes the attachments; a constraint trigger, because
-- this is an integrity rule about a row rather than business logic, and it
-- should read as one in the catalogue.
--
-- The rule itself is unchanged in spirit and wider by exactly two cases: a
-- message with attachments, and a message that forwards another.

begin;

do $$
begin
  if not exists (select 1 from pg_class where relname = 'post_attachments' and relnamespace = 'public'::regnamespace) then
    raise exception 'public.post_attachments is missing: apply 20260912070000 first';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'posts' and column_name = 'forwarded_from_post_id'
  ) then
    raise exception 'posts.forwarded_from_post_id is missing: apply 20260912140000 first';
  end if;
end
$$;

create or replace function private.assert_post_has_content()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- A deleted message is allowed to be empty. Deleting is how it gets that way.
  if new.is_deleted then
    return null;
  end if;

  if new.body is not null
     or new.image_url is not null
     or new.video_file_id is not null
     or new.forwarded_from_post_id is not null then
    return null;
  end if;

  if exists (select 1 from public.post_attachments where post_id = new.id) then
    return null;
  end if;

  -- The same sentence `community_send_message` uses, so a member sees one
  -- wording whichever layer refuses them.
  raise exception 'A message needs something in it.';
end;
$$;

revoke execute on function private.assert_post_has_content() from public, anon, authenticated;

drop trigger if exists posts_has_content on public.posts;
create constraint trigger posts_has_content
  after insert or update of body, image_url, video_file_id, forwarded_from_post_id, is_deleted
  on public.posts
  deferrable initially deferred
  for each row execute function private.assert_post_has_content();

-- Dropped last, so the table is never briefly unguarded.
alter table public.posts drop constraint if exists posts_check;

notify pgrst, 'reload schema';

commit;
