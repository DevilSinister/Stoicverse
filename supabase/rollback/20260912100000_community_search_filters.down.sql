-- Rollback for 20260912100000_community_search_filters.sql
--
-- Restores the four-argument `community_search_messages` exactly as
-- 20260912070001 defined it, and drops the seven-argument one. No data is
-- touched: both are read-only functions.
--
-- What breaks after this runs: `from:`, `has:` and `after:` in the search bar.
-- The client sends all seven arguments by name, so every search fails rather
-- than quietly ignoring the three filters — which is the right failure, since
-- a search that silently drops "from:someone" returns somebody else's messages
-- and looks like it worked.

begin;

drop function if exists public.community_search_messages(text, uuid, timestamptz, integer, uuid, timestamptz, text);

create or replace function public.community_search_messages(
  query text,
  channel uuid default null,
  before_created_at timestamptz default null,
  page_size integer default 25
)
returns table (
  id uuid,
  channel_id uuid,
  channel_name text,
  author_name text,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  cleaned text := btrim(coalesce(query, ''));
  limited integer := least(greatest(coalesce(page_size, 25), 1), 25);
  pattern text;
begin
  if char_length(cleaned) < 2 or char_length(cleaned) > 100 then
    raise exception 'A search needs between 2 and 100 characters.';
  end if;
  pattern := '%' || replace(replace(replace(cleaned, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select post.id, post.channel_id, source.name,
         coalesce(author.full_name, 'Former member'), post.body, post.created_at
  from public.posts post
  join public.channels source on source.id = post.channel_id
  left join public.profiles author on author.id = post.author_id
  where not post.is_deleted
    and post.body ilike pattern
    and post.channel_id in (select public.community_visible_channel_ids())
    and (channel is null or post.channel_id = channel)
    and (before_created_at is null or post.created_at < before_created_at)
  order by post.created_at desc
  limit limited;
end;
$$;

revoke execute on function public.community_search_messages(text, uuid, timestamptz, integer) from public, anon;
grant execute on function public.community_search_messages(text, uuid, timestamptz, integer) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
