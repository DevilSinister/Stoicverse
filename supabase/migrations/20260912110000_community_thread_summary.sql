-- Fix — a message never showed the thread hanging off it.
--
-- `community_channel_messages` joined the thread as
--
--     left join public.threads thread_row on thread_row.id = post.thread_id
--
-- and the channel view returns only posts where `post.thread_id is null` —
-- that clause is what separates a channel from the threads inside it. So in
-- the channel stream the join matched nothing, every time, and `thread_name`
-- and `thread_message_count` were structurally always null. Threads could be
-- created, listed and replied to, and the message they hung off said nothing
-- about them.
--
-- The obvious repair is the wrong one. Setting `posts.thread_id` on the root
-- post would make the join work and would delete the message from its own
-- channel, because that same `thread_id is null` clause is what keeps thread
-- replies out of the main list.
--
-- A thread hangs off its root post: `threads.root_post_id` is the link, and it
-- is the one the channel view has to follow. So there are two joins now — the
-- thread a message *started*, and the thread a message is *inside* — and a
-- message is only ever one or the other.
--
-- Both are indexed: `threads_root_post_idx`, and the primary key.

begin;

do $$
begin
  if not exists (select 1 from pg_class where relname = 'threads' and relnamespace = 'public'::regnamespace) then
    raise exception 'public.threads is missing: apply 20260912070000 first';
  end if;
  if not exists (
    select 1 from pg_proc
    where proname = 'community_channel_messages' and pronamespace = 'public'::regnamespace
  ) then
    raise exception 'public.community_channel_messages is missing: apply 20260912070001 first';
  end if;
end
$$;

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
  thread_id uuid, thread_name text, thread_message_count integer, attachments jsonb, reactions jsonb
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
         ), '[]'::jsonb)
  from public.posts post
  left join public.profiles author on author.id = post.author_id
  left join public.posts parent on parent.id = post.reply_to_post_id
  left join public.profiles parent_author on parent_author.id = parent.author_id
  left join public.threads started on started.root_post_id = post.id
  left join public.threads inside on inside.id = post.thread_id
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
  'One page of a channel, or of a thread inside it. The thread summary is the thread a message started (root_post_id) or the one it sits in (thread_id).';

revoke execute on function public.community_channel_messages(uuid, timestamptz, uuid, integer, uuid) from public, anon;
grant execute on function public.community_channel_messages(uuid, timestamptz, uuid, integer, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
