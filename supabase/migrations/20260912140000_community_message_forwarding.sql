-- Forwarding a message into other channels.
--
-- A forward is a **pointer, not a copy**. `posts.forwarded_from_post_id` names
-- the original and the read path follows it live, which is the difference that
-- matters here: a moderator who deletes a message deletes it everywhere it was
-- forwarded, in the same act. A snapshot would have left the deleted words
-- standing in every channel somebody had republished them into, and the
-- moderator would have had no way to know where to look.
--
-- Posts are soft-deleted (`is_deleted`), so the row a forward points at is
-- still there to name its author and its channel after a deletion. The card
-- then says the original is gone rather than losing its attribution. The
-- foreign key is `on delete set null` only for a hard delete, which nothing in
-- the product performs.
--
-- **A forward shows its content to whoever can read the channel it landed in**,
-- including somebody with no access to the channel it came from. That is the
-- feature, not a leak: forwarding is a deliberate act of republication by
-- somebody who could already read it and could already paste it. What does
-- *not* cross is the link back — `forwarded_channel_visible` is false for a
-- viewer without `view_channel` there, so the card does not offer a jump into
-- a channel they cannot open.
--
-- Forwarding is otherwise an ordinary send: slow mode, AutoMod, the channel's
-- `send_messages` permission and the community gate all apply, and AutoMod is
-- run against the *forwarded* body as well as against the note, because
-- otherwise forwarding would be the one way to put a blocked phrase into a
-- channel that blocks it.

begin;

do $$
begin
  if not exists (select 1 from pg_class where relname = 'posts' and relnamespace = 'public'::regnamespace) then
    raise exception 'public.posts is missing';
  end if;
  if not exists (
    select 1 from pg_proc
    where proname = 'community_channel_messages' and pronamespace = 'public'::regnamespace
  ) then
    raise exception 'public.community_channel_messages is missing: apply 20260912070001 first';
  end if;
  if not exists (
    select 1 from pg_proc where proname = 'automod_evaluate' and pronamespace = 'private'::regnamespace
  ) then
    raise exception 'private.automod_evaluate is missing: apply 20260912070001 first';
  end if;
end
$$;

-- ------------------------------------------------------------------ the link

alter table public.posts
  add column if not exists forwarded_from_post_id uuid references public.posts(id) on delete set null;

-- Partial: the overwhelming majority of messages are not forwards, and the
-- only query that reads this column reads it for the ones that are.
create index if not exists posts_forwarded_from_idx
  on public.posts (forwarded_from_post_id)
  where forwarded_from_post_id is not null;

comment on column public.posts.forwarded_from_post_id is
  'The message this one forwards. Followed live on read, so deleting the original empties every forward of it.';

-- A forward of a forward points at the message that was actually forwarded,
-- never at a chain. Enforced here rather than in the function so that no
-- writer can build one.
create or replace function private.assert_forward_is_flat()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  origin uuid;
begin
  if new.forwarded_from_post_id is null then
    return new;
  end if;
  if new.forwarded_from_post_id = new.id then
    raise exception 'A message cannot forward itself.';
  end if;

  select forwarded_from_post_id into origin from public.posts where id = new.forwarded_from_post_id;
  if origin is not null then
    -- Collapse rather than refuse: forwarding a forward is a thing people do,
    -- and what they mean by it is "forward the original".
    new.forwarded_from_post_id := origin;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_forward_is_flat on public.posts;
create trigger posts_forward_is_flat
  before insert or update of forwarded_from_post_id on public.posts
  for each row execute function private.assert_forward_is_flat();

revoke execute on function private.assert_forward_is_flat() from public, anon, authenticated;

-- ------------------------------------------------------------- the write path

create or replace function public.community_forward_message(
  source_post uuid,
  targets uuid[],
  note text default null
)
returns table (channel_id uuid, post_id uuid, failure text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  gate text;
  source public.posts%rowtype;
  target uuid;
  seen uuid[] := '{}';
  clean_note text := nullif(btrim(coalesce(note, '')), '');
  new_post uuid;
  verdict record;
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

  -- You may only forward what you may read. Both halves: a channel you can see
  -- but whose history is closed to you is not a channel you can republish from.
  select * into source from public.posts where id = source_post and not is_deleted;
  if not found then
    raise exception 'That message no longer exists.';
  end if;
  if not public.community_has('view_channel', source.channel_id)
     or not public.community_has('read_message_history', source.channel_id) then
    raise exception 'You do not have access to that message.' using errcode = '42501';
  end if;

  if targets is null or array_length(targets, 1) is null then
    raise exception 'Choose at least one channel to forward to.';
  end if;
  if array_length(targets, 1) > 10 then
    raise exception 'A message can be forwarded to at most 10 channels at once.';
  end if;
  if char_length(coalesce(clean_note, '')) > 10000 then
    raise exception 'Messages are limited to 10,000 characters here.';
  end if;

  foreach target in array targets loop
    -- The picker can send the same id twice; doing it twice is not what was
    -- meant by it.
    continue when target = any (seen);
    seen := seen || target;

    if not public.community_has('send_messages', target) then
      channel_id := target;
      post_id := null;
      failure := 'You do not have permission to post there.';
      return next;
      continue;
    end if;

    -- AutoMod against both bodies. The note is what this person wrote; the
    -- forwarded body is what they are about to publish here, and the trigger
    -- on `posts` only ever sees the first of the two.
    select * into verdict from private.automod_evaluate(actor, target, clean_note, null) limit 1;
    if not verdict.blocked and coalesce(source.body, '') <> '' then
      select * into verdict from private.automod_evaluate(actor, target, source.body, null) limit 1;
    end if;
    if verdict.blocked then
      channel_id := target;
      post_id := null;
      failure := verdict.reason;
      return next;
      continue;
    end if;

    -- A sub-block per target, so slow mode or a channel-level refusal on one
    -- of them reports itself and leaves the others sent. Without it the first
    -- failure would roll the whole call back, and somebody forwarding to five
    -- channels would lose four successful sends to one they were rate-limited
    -- in.
    begin
      perform set_config('stoicverse.automod_done', 'on', true);

      insert into public.posts (channel_id, author_id, body, post_type, forwarded_from_post_id)
      values (target, actor, clean_note, 'post', source_post)
      returning id into new_post;

      perform set_config('stoicverse.automod_done', 'off', true);

      channel_id := target;
      post_id := new_post;
      failure := null;
      return next;
    exception when others then
      perform set_config('stoicverse.automod_done', 'off', true);
      channel_id := target;
      post_id := null;
      -- The database's own sentence. Every refusal reachable here is written
      -- for a person to read: slow mode, AutoMod, the length cap.
      failure := sqlerrm;
      return next;
    end;
  end loop;
end;
$$;

comment on function public.community_forward_message(uuid, uuid[], text) is
  'Forwards one message into up to ten channels. Returns a row per channel; a refusal for one does not roll back the others.';

revoke execute on function public.community_forward_message(uuid, uuid[], text) from public, anon;
grant execute on function public.community_forward_message(uuid, uuid[], text) to authenticated, service_role;

-- -------------------------------------------------------------- the read path

-- The return type gains nine columns, so this is a drop and a create rather
-- than a replace — and the revoke is re-issued below, because a dropped
-- function takes its grants with it and a fresh one is created carrying
-- PostgreSQL's default PUBLIC grant.
drop function if exists public.community_channel_messages(uuid, timestamptz, uuid, integer, uuid);

create function public.community_channel_messages(
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
         -- The thread this message started, or the one it sits in. A message
         -- is never both: a root post stays in the channel with a null
         -- `thread_id`, and a reply carries the thread it belongs to.
         coalesce(started.id, post.thread_id),
         coalesce(started.name, inside.name),
         coalesce(started.message_count, inside.message_count),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', attachment.id, 'path', attachment.path, 'mimeType', attachment.mime_type,
                    'byteSize', attachment.byte_size, 'width', attachment.width, 'height', attachment.height
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
         -- The forwarded original, read live. `forwarded_body` is null when it
         -- has since been deleted, and `forwarded_deleted` says which of the
         -- two empty bodies this is.
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

comment on function public.community_channel_messages(uuid, timestamptz, uuid, integer, uuid) is
  'One page of a channel, or of a thread inside it. The thread summary is the thread a message started (root_post_id) or the one it sits in (thread_id); a forward is resolved live through forwarded_from_post_id.';

revoke execute on function public.community_channel_messages(uuid, timestamptz, uuid, integer, uuid) from public, anon;
grant execute on function public.community_channel_messages(uuid, timestamptz, uuid, integer, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
