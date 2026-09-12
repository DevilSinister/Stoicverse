-- Undo phase 6's custom emoji.
--
-- Order matters. The send path stops accepting emoji tokens *before* the table
-- those tokens resolve against is dropped, and the reactions that carry them go
-- with it: a reaction whose emoji no longer exists renders as a token nothing
-- can read, in a row of otherwise ordinary faces.
--
-- Message bodies are not rewritten. A `<:name:uuid>` left in an old message is
-- what somebody wrote, and the renderer already shows an unresolvable token as
-- `:name:`.

-- Reactions carrying a custom emoji, before the trigger and the table go.
delete from public.reactions
where emoji ~ '^<:[a-z0-9_]{2,32}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>$';

-- The 32-character cap comes back. Nothing can violate it: the reactions that
-- could have were deleted above.
alter table public.reactions drop constraint if exists reactions_emoji_check;
alter table public.reactions
  add constraint reactions_emoji_check check (char_length(emoji) >= 1 and char_length(emoji) <= 32);

drop trigger if exists reactions_emoji_usable on public.reactions;
drop trigger if exists community_emojis_cap on public.community_emojis;

drop function if exists private.assert_reaction_emoji_usable();
drop function if exists private.assert_emoji_cap();
drop function if exists public.community_emoji_create(text, text, text, boolean, uuid[]);
drop function if exists public.community_emoji_update(uuid, text, uuid[]);
drop function if exists public.community_emoji_delete(uuid);

drop policy if exists community_emojis_public_read on storage.objects;
drop policy if exists community_emojis_manage_write on storage.objects;
drop policy if exists community_emojis_manage_delete on storage.objects;

-- The objects have to go before the bucket will.
delete from storage.objects where bucket_id = 'community-emojis';
delete from storage.buckets where id = 'community-emojis';

drop table if exists public.community_emoji_roles;
drop table if exists public.community_emojis;

-- The send path, closed again. This is 20260912150000's function verbatim: its
-- custom-emoji branch refuses every token rather than asking whether the
-- person may use one, because after this file runs there is nothing to ask.

create or replace function public.community_send_message(
  channel uuid,
  body text default null,
  reply_to uuid default null,
  thread uuid default null,
  attachments jsonb default '[]'::jsonb,
  client_nonce text default null
)
returns table (post_id uuid, blocked_reason text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  gate text;
  thread_row public.threads%rowtype;
  attachment jsonb;
  attachment_count integer;
  new_post uuid;
  verdict record;
  mentioned_role uuid;
  mention_token text;
begin
  if actor is null then
    raise exception 'You are not signed in.' using errcode = '42501';
  end if;

  select private.community_gate(actor) into gate;
  if gate = 'suspended' then
    raise exception 'Your account is suspended.' using errcode = '42501';
  elsif gate = 'banned' then
    raise exception 'You are banned from this community.' using errcode = '42501';
  elsif gate = 'timeout' then
    raise exception 'You are timed out and cannot post right now.' using errcode = '42501';
  end if;

  if thread is not null then
    select * into thread_row from public.threads where id = thread;
    if not found then
      raise exception 'That thread no longer exists.';
    end if;
    if thread_row.channel_id <> channel then
      raise exception 'That thread belongs to a different channel.';
    end if;
    if thread_row.locked then
      raise exception 'That thread is locked.';
    end if;
    if thread_row.archived_at is not null then
      raise exception 'That thread is archived.';
    end if;
    if not public.community_has('send_messages_in_threads', channel) then
      raise exception 'You do not have permission to post in threads here.' using errcode = '42501';
    end if;
  else
    if not public.community_has('send_messages', channel) then
      raise exception 'You do not have permission to post here.' using errcode = '42501';
    end if;
  end if;

  if reply_to is not null and not exists (
    select 1 from public.posts where id = reply_to and channel_id = channel and not is_deleted
  ) then
    raise exception 'The message you are replying to is not in this channel.';
  end if;

  attachment_count := coalesce(jsonb_array_length(attachments), 0);
  if attachment_count > 10 then
    raise exception 'A message can carry at most 10 attachments.';
  end if;
  if attachment_count > 0 then
    if not public.community_has('attach_files', channel) then
      raise exception 'You do not have permission to attach files here.' using errcode = '42501';
    end if;
    for attachment in select * from jsonb_array_elements(attachments) loop
      if (attachment->>'path') is null or btrim(attachment->>'path') = '' then
        raise exception 'An attachment is missing its path.';
      end if;
      if split_part(attachment->>'path', '/', 1) <> actor::text then
        raise exception 'An attachment does not belong to you.' using errcode = '42501';
      end if;
      if (attachment->>'mimeType') not in
         ('image/jpeg', 'image/png', 'image/webp', 'image/gif',
          'video/mp4', 'video/webm',
          'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg',
          'application/pdf') then
        raise exception 'That file type is not allowed here.';
      end if;
      if coalesce((attachment->>'byteSize')::bigint, 0) > 26214400 then
        raise exception 'Attachments are limited to 25 MB each.';
      end if;
    end loop;
  end if;

  if coalesce(btrim(body), '') = '' and attachment_count = 0 then
    raise exception 'A message needs something in it.';
  end if;

  if coalesce(body, '') ~* '(https?://|www\.)' and not public.community_has('embed_links', channel) then
    raise exception 'You do not have permission to post links here.' using errcode = '42501';
  end if;

  if coalesce(body, '') ~ '(^|[^[:alnum:]_])@(everyone|here)([^[:alnum:]_]|$)'
     and not public.community_has('mention_everyone', channel) then
    raise exception 'You do not have permission to mention everyone here.' using errcode = '42501';
  end if;

  for mention_token in
    select token[1]
    from regexp_matches(coalesce(body, ''),
      '<@&([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})>', 'g') as token
  loop
    mentioned_role := mention_token::uuid;
    if exists (select 1 from public.community_roles where id = mentioned_role and not mentionable)
       and not public.community_has('mention_roles', channel) then
      raise exception 'You do not have permission to mention that role.' using errcode = '42501';
    end if;
  end loop;

  if coalesce(body, '') ~ '<:[a-z0-9_]{2,32}:[0-9a-fA-F-]{36}>' then
    raise exception 'Custom emoji are not available yet.';
  end if;

  select * into verdict from private.automod_evaluate(actor, channel, body, null) limit 1;

  if verdict.blocked then
    return query select null::uuid, verdict.reason;
    return;
  end if;

  perform set_config('stoicverse.automod_done', 'on', true);

  insert into public.posts (channel_id, author_id, body, post_type, reply_to_post_id, thread_id, client_nonce)
  values (channel, actor, nullif(btrim(coalesce(body, '')), ''), 'post', reply_to, thread, client_nonce)
  returning id into new_post;

  perform set_config('stoicverse.automod_done', 'off', true);

  if attachment_count > 0 then
    insert into public.post_attachments
      (post_id, path, mime_type, byte_size, width, height, duration_seconds, sort_order)
    select new_post,
           entry.value->>'path',
           entry.value->>'mimeType',
           nullif(entry.value->>'byteSize', '')::bigint,
           nullif(entry.value->>'width', '')::integer,
           nullif(entry.value->>'height', '')::integer,
           nullif(entry.value->>'durationSeconds', '')::numeric,
           (entry.ordinality - 1)::integer
    from jsonb_array_elements(attachments) with ordinality as entry(value, ordinality);
  end if;

  return query select new_post, null::text;
end;
$$;

-- Nothing calls it now.
drop function if exists public.community_emoji_usable(uuid, uuid, uuid);

revoke execute on function public.community_send_message(uuid, text, uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.community_send_message(uuid, text, uuid, uuid, jsonb, text) to authenticated, service_role;

notify pgrst, 'reload schema';
