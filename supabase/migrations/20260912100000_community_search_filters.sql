-- Phase P3 — search filters: from:, has:, after:
--
-- Phase 8's `community_search_messages` took a query, a channel and a `before`
-- cursor. The search bar offers `from: in: has: before: after:`, and the three
-- it could not answer had to be answered somewhere. Filtering client-side was
-- the alternative and it is not an option: the RPC returns one page of 25, so
-- filtering after the fact shows two results out of a page and a "load more"
-- that behaves at random. A filter has to live in the query that pages.
--
-- Both indexes this needs already exist: `posts_body_trgm_idx` (GIN trigram,
-- which is what makes the leading-wildcard ILIKE usable) and
-- `posts_author_recent_idx`.
--
-- The old four-argument function is dropped rather than left beside the new
-- one. `create or replace` with extra parameters creates an *overload* —
-- PostgREST would then choose between two functions by the argument names a
-- caller happened to send, which is a coin toss nobody would ever debug.

begin;

do $$
begin
  if not exists (
    select 1 from pg_proc
    where proname = 'community_search_messages' and pronamespace = 'public'::regnamespace
  ) then
    raise exception 'public.community_search_messages is missing: apply 20260912070001 first';
  end if;
  if not exists (select 1 from pg_class where relname = 'post_attachments' and relnamespace = 'public'::regnamespace) then
    raise exception 'public.post_attachments is missing: apply 20260912070000 first';
  end if;
end
$$;

drop function if exists public.community_search_messages(text, uuid, timestamptz, integer);

create or replace function public.community_search_messages(
  query text default '',
  channel uuid default null,
  before_created_at timestamptz default null,
  page_size integer default 25,
  author uuid default null,
  after_created_at timestamptz default null,
  has text default null
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
  want text := nullif(btrim(lower(coalesce(has, ''))), '');
  pattern text;
begin
  if want is not null and want not in ('link', 'image', 'file') then
    raise exception 'has: takes link, image or file.';
  end if;

  -- A filter is a search. "Everything Ada posted in #general last week" names
  -- no words, and refusing it because the text is empty would be refusing the
  -- most precise query the syntax can express.
  if cleaned = '' then
    if author is null and channel is null and want is null
       and before_created_at is null and after_created_at is null then
      raise exception 'A search needs some text or a filter.';
    end if;
  elsif char_length(cleaned) < 2 or char_length(cleaned) > 100 then
    raise exception 'A search needs between 2 and 100 characters.';
  end if;

  if cleaned <> '' then
    pattern := '%' || replace(replace(replace(cleaned, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select post.id, post.channel_id, source.name,
         coalesce(profile.full_name, 'Former member'), post.body, post.created_at
  from public.posts post
  join public.channels source on source.id = post.channel_id
  left join public.profiles profile on profile.id = post.author_id
  where not post.is_deleted
    and (pattern is null or post.body ilike pattern)
    and post.channel_id in (select public.community_visible_channel_ids())
    and (channel is null or post.channel_id = channel)
    and (author is null or post.author_id = author)
    and (before_created_at is null or post.created_at < before_created_at)
    and (after_created_at is null or post.created_at >= after_created_at)
    and (
      want is null
      -- A bare scheme match, not a full URL parse: this decides whether to
      -- show a row, and a message containing "https://" is one a person
      -- looking for links wants to see.
      or (want = 'link' and post.body ~* 'https?://')
      or (want = 'image' and exists (
            select 1 from public.post_attachments a
            where a.post_id = post.id and a.mime_type like 'image/%'))
      or (want = 'file' and exists (
            select 1 from public.post_attachments a where a.post_id = post.id))
    )
  order by post.created_at desc
  limit limited;
end;
$$;

comment on function public.community_search_messages(text, uuid, timestamptz, integer, uuid, timestamptz, text) is
  'Message search across visible channels. Filters: channel, author, has (link/image/file), and a created_at window. Text may be empty when a filter narrows the result.';

revoke execute on function public.community_search_messages(text, uuid, timestamptz, integer, uuid, timestamptz, text) from public, anon;
grant execute on function public.community_search_messages(text, uuid, timestamptz, integer, uuid, timestamptz, text) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
