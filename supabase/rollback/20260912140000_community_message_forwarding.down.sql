-- Undo 20260912140000_community_message_forwarding.
--
-- Dropping the column takes every forward's link with it. The forwarding
-- messages themselves survive as ordinary posts carrying only the note their
-- author typed, which for a note-less forward is an empty message — so this is
-- destructive in the ordinary sense, and the rows are worth counting before it
-- runs:
--
--   select count(*) from public.posts where forwarded_from_post_id is not null;
--
-- `community_channel_messages` is restored to its 20260912110000 shape, which
-- is the definition this migration replaced.

begin;

drop function if exists public.community_forward_message(uuid, uuid[], text);

drop trigger if exists posts_forward_is_flat on public.posts;
drop function if exists private.assert_forward_is_flat();

drop index if exists public.posts_forwarded_from_idx;
alter table public.posts drop column if exists forwarded_from_post_id;

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

revoke execute on function public.community_channel_messages(uuid, timestamptz, uuid, integer, uuid) from public, anon;
grant execute on function public.community_channel_messages(uuid, timestamptz, uuid, integer, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
