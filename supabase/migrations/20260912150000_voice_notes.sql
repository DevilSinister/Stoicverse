-- Voice notes: an audio attachment, recorded in the composer.
--
-- A voice note is not a new kind of message. It is an attachment whose mime
-- type happens to be audio, which means every rule already written for
-- attachments applies to it unchanged: the 25 MB cap, ten per message, the
-- `{uid}/{channel}/` path the upload policy reads, `attach_files`, and the
-- deferred content check that lets a message carry no text at all.
--
-- **The allow-list lived in four places** and all four had to agree, or a
-- recording would pass one gate and be refused by the next with a different
-- sentence: the bucket's `allowed_mime_types`, the CHECK on
-- `post_attachments.mime_type`, the inline list inside
-- `community_send_message`, and `ATTACHMENT_MIME_TYPES` in the client. This
-- migration moves the first three; the fourth is in the same commit.
--
-- Four audio types, because the recorder does not get to choose: Chrome and
-- Firefox produce `audio/webm`, Safari produces `audio/mp4`, and `audio/mpeg`
-- and `audio/ogg` are what a file picked off a disk is likely to be.
--
-- `duration_seconds` is the recorder's own measurement, carried so a player
-- can show the length before fetching the audio. It is a hint, not a
-- guarantee: it is written by the client, and nothing is decided by it.

begin;

do $$
begin
  if not exists (select 1 from pg_class where relname = 'post_attachments' and relnamespace = 'public'::regnamespace) then
    raise exception 'public.post_attachments is missing: apply 20260912070000 first';
  end if;
  if not exists (select 1 from storage.buckets where id = 'community-posts') then
    raise exception 'the community-posts bucket is missing';
  end if;
end
$$;

alter table public.post_attachments
  add column if not exists duration_seconds numeric(7, 1);

alter table public.post_attachments
  drop constraint if exists post_attachments_duration_seconds_check;
alter table public.post_attachments
  add constraint post_attachments_duration_seconds_check
  check (duration_seconds is null or (duration_seconds > 0 and duration_seconds <= 3600));

comment on column public.post_attachments.duration_seconds is
  'Length of an audio or video attachment, as measured by the client. A hint for the player; nothing is decided by it.';

-- ------------------------------------------------------------ the allow-list

alter table public.post_attachments
  drop constraint if exists post_attachments_mime_type_check;
alter table public.post_attachments
  add constraint post_attachments_mime_type_check
  check (mime_type = any (array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm',
    'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg',
    'application/pdf'
  ]));

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm',
  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg',
  'application/pdf'
]
where id = 'community-posts';

-- ---------------------------------------------------------------- the sender

-- `create or replace`: same signature, same return type. The revoke is
-- re-issued anyway — a replace preserves grants on the database it runs
-- against, and says nothing about a fresh one built from this script.
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

revoke execute on function public.community_send_message(uuid, text, uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.community_send_message(uuid, text, uuid, uuid, jsonb, text) to authenticated, service_role;

-- ---------------------------------------------------------------- the reader

-- `attachments` gains `durationSeconds`, so a player can show the length
-- before fetching the file. A replace rather than a drop: the return type is
-- unchanged, only the body.
create or replace function public.community_channel_messages(
  channel uuid,
  before_created_at timestamptz default null,
  before_id uuid default null,
  page_size integer default 50,
  thread uuid default null
)
returns table (
  id uuid, author_id uuid, author_name text, author_avatar text, author_color text,
  body text, post_type text, is_pinned boolean, created_at timestamptz, edited_at timestamptz,
  client_nonce text, reply_to_post_id uuid, reply_author_name text, reply_excerpt text,
  thread_id uuid, thread_name text, thread_message_count integer, attachments jsonb, reactions jsonb,
  forwarded_from_post_id uuid, forwarded_author_name text, forwarded_body text,
  forwarded_created_at timestamptz, forwarded_channel_id uuid, forwarded_channel_name text,
  forwarded_channel_visible boolean, forwarded_attachment_count integer, forwarded_deleted boolean
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  limited integer := least(greatest(coalesce(page_size, 50), 1), 100);
begin
  if not public.community_has('view_channel', channel) then
    raise exception 'You do not have access to that channel.' using errcode = '42501';
  end if;
  if not public.community_has('read_message_history', channel) then
    raise exception 'You do not have permission to read the history here.' using errcode = '42501';
  end if;

  return query
  select post.id,
         post.author_id,
         coalesce(author.full_name, 'Former member'),
         author.avatar_url,
         (
           select role.color
           from public.community_role_members assignment
           join public.community_roles role on role.id = assignment.role_id
           where assignment.user_id = post.author_id and role.color is not null
           order by role.position desc
           limit 1
         ),
         post.body,
         post.post_type,
         post.is_pinned,
         post.created_at,
         post.edited_at,
         post.client_nonce,
         post.reply_to_post_id,
         parent_author.full_name,
         left(coalesce(parent.body, ''), 140),
         coalesce(started.id, post.thread_id),
         coalesce(started.name, inside.name),
         coalesce(started.message_count, inside.message_count),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', attachment.id, 'path', attachment.path, 'mimeType', attachment.mime_type,
                    'byteSize', attachment.byte_size, 'width', attachment.width, 'height', attachment.height,
                    'durationSeconds', attachment.duration_seconds
                  ) order by attachment.sort_order)
           from public.post_attachments attachment
           where attachment.post_id = post.id
         ), '[]'::jsonb),
         coalesce((
           select jsonb_agg(summary.grouped)
           from (
             select jsonb_build_object(
                      'emoji', reaction.emoji,
                      'count', count(*),
                      'mine', bool_or(reaction.user_id = (select auth.uid()))
                    ) as grouped
             from public.reactions reaction
             where reaction.post_id = post.id
             group by reaction.emoji
             order by count(*) desc, reaction.emoji
           ) as summary
         ), '[]'::jsonb),
         post.forwarded_from_post_id,
         case when post.forwarded_from_post_id is null then null
              else coalesce(origin_author.full_name, 'Former member') end,
         case when origin.is_deleted then null else origin.body end,
         origin.created_at,
         origin.channel_id,
         origin_channel.name,
         case when post.forwarded_from_post_id is null then null
              else public.community_has('view_channel', origin.channel_id) end,
         case when post.forwarded_from_post_id is null then null
              when origin.is_deleted then 0
              else (select count(*)::integer from public.post_attachments a where a.post_id = origin.id) end,
         origin.is_deleted
  from public.posts post
  left join public.profiles author on author.id = post.author_id
  left join public.posts parent on parent.id = post.reply_to_post_id
  left join public.profiles parent_author on parent_author.id = parent.author_id
  left join public.threads started on started.root_post_id = post.id
  left join public.threads inside on inside.id = post.thread_id
  left join public.posts origin on origin.id = post.forwarded_from_post_id
  left join public.profiles origin_author on origin_author.id = origin.author_id
  left join public.channels origin_channel on origin_channel.id = origin.channel_id
  where post.channel_id = channel
    and not post.is_deleted
    and (case when thread is null then post.thread_id is null else post.thread_id = thread end)
    and (
      before_created_at is null
      or post.created_at < before_created_at
      or (post.created_at = before_created_at and post.id < before_id)
    )
  order by post.created_at desc, post.id desc
  limit limited;
end;
$$;

revoke execute on function public.community_channel_messages(uuid, timestamptz, uuid, integer, uuid) from public, anon;
grant execute on function public.community_channel_messages(uuid, timestamptz, uuid, integer, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
