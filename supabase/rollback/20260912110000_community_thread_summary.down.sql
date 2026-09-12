-- Rollback for 20260912110000_community_thread_summary.sql
--
-- Restores the single join, `threads.id = post.thread_id`. No data is touched:
-- this is a read-only function, and the forward migration changed no table.
--
-- What breaks after this runs: a message stops showing the thread hanging off
-- it, everywhere. Threads still exist, still list in the header popover, and
-- still take replies — they simply become invisible from the conversation they
-- belong to, which is the bug this rolls back to.

begin;

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
         post.thread_id,
         thread_row.name,
         thread_row.message_count,
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
  left join public.threads thread_row on thread_row.id = post.thread_id
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
