-- The RPCs the /channels page reads and writes through.
--
-- Split from 20260912070000 deliberately. That migration reshapes `posts` and
-- `reactions` and backfills both; this one only creates functions. Applying
-- them separately means a syntax error here cannot leave the table changes
-- half-done, and the schema half can be verified on its own before anything
-- depends on it.
--
-- **`community_send_message` is a SECURITY DEFINER, so it makes every check
-- `posts_member_insert` was making.** Definer rights bypass the policy, which
-- means the policy stops being the enforcement boundary on this path and the
-- function becomes it. The policy stays in place for the legacy composer,
-- which still inserts directly.
--
-- The checks run in the order a person would hit them: can you be here at all,
-- may you speak here, is the thread open, does the reply belong, are the files
-- yours and allowed, may you post a link, may you ping this many people, and
-- only then AutoMod.
--
-- **AutoMod runs once.** Phase 5 put an AFTER INSERT trigger on `posts` that
-- records a match. This function evaluates *before* its insert — which is the
-- whole reason phase 5 could not persist an alert for a blocked message — so
-- the trigger has to be told the work is already done, or every message sent
-- through here would record twice: two alerts, two notifications, two timeout
-- cases. A transaction-local setting does that, reset immediately after the
-- insert so a second call in the same transaction is evaluated normally.

do $$
begin
  if not exists (select 1 from pg_class where relname = 'threads' and relnamespace = 'public'::regnamespace) then
    raise exception 'pre-flight: 20260912070000 is not applied; apply the schema half first';
  end if;
end $$;

-- ---------------------------------------------------- AutoMod, exactly once

create or replace function private.automod_record_post()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- `community_send_message` evaluated this message before inserting it, so
  -- the alert, the case and the notification already exist. Evaluating again
  -- would duplicate all three.
  if coalesce(current_setting('stoicverse.automod_done', true), 'off') = 'on' then
    return new;
  end if;
  perform private.automod_evaluate(new.author_id, new.channel_id, new.body, new.id);
  return new;
end;
$$;

-- ----------------------------------------------------------- send a message

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

  -- 1. Can you be here at all. The resolver returns nothing for any of these,
  --    but a member deserves to be told which one it is.
  select private.community_gate(actor) into gate;
  if gate = 'suspended' then
    raise exception 'Your account is suspended.' using errcode = '42501';
  elsif gate = 'banned' then
    raise exception 'You are banned from this community.' using errcode = '42501';
  elsif gate = 'timeout' then
    raise exception 'You are timed out and cannot post right now.' using errcode = '42501';
  end if;

  -- 2. May you speak here. A thread has its own permission, because allowing
  --    replies in threads without allowing new top-level messages is a real
  --    moderation posture.
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

  -- 3. A reply stays in its channel. A trigger enforces this too; this is the
  --    message a person can act on.
  if reply_to is not null and not exists (
    select 1 from public.posts where id = reply_to and channel_id = channel and not is_deleted
  ) then
    raise exception 'The message you are replying to is not in this channel.';
  end if;

  -- 4. Attachments: yours, allowed, and within the caps.
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
      -- The upload policy writes into `<uid>/<channel>/`; this refuses a body
      -- that points at somebody else's upload.
      if split_part(attachment->>'path', '/', 1) <> actor::text then
        raise exception 'An attachment does not belong to you.' using errcode = '42501';
      end if;
      if (attachment->>'mimeType') not in
         ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'application/pdf') then
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

  -- 5. Links.
  if coalesce(body, '') ~* '(https?://|www\.)' and not public.community_has('embed_links', channel) then
    raise exception 'You do not have permission to post links here.' using errcode = '42501';
  end if;

  -- 6. Mentions. `@everyone` and `@here` are one permission; a role that is
  --    not marked mentionable is another. A mentionable role needs neither.
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

  -- 7. Custom emoji. Phase 6 adds `community_emoji_usable`; until then no
  --    custom emoji exists, so a token of that shape names nothing.
  if coalesce(body, '') ~ '<:[a-z0-9_]{2,32}:[0-9a-fA-F-]{36}>' then
    raise exception 'Custom emoji are not available yet.';
  end if;

  -- 8. AutoMod, evaluated before the insert so the alert and any timeout
  --    survive a block. This is the thing phase 5 could not do.
  select * into verdict from private.automod_evaluate(actor, channel, body, null) limit 1;

  if verdict.blocked then
    return query select null::uuid, verdict.reason;
    return;
  end if;

  -- Tell the AFTER INSERT trigger the work is done, then put it back.
  perform set_config('stoicverse.automod_done', 'on', true);

  insert into public.posts (channel_id, author_id, body, post_type, reply_to_post_id, thread_id, client_nonce)
  values (channel, actor, nullif(btrim(coalesce(body, '')), ''), 'post', reply_to, thread, client_nonce)
  returning id into new_post;

  perform set_config('stoicverse.automod_done', 'off', true);

  if attachment_count > 0 then
    insert into public.post_attachments (post_id, path, mime_type, byte_size, width, height, sort_order)
    select new_post,
           entry.value->>'path',
           entry.value->>'mimeType',
           nullif(entry.value->>'byteSize', '')::bigint,
           nullif(entry.value->>'width', '')::integer,
           nullif(entry.value->>'height', '')::integer,
           (entry.ordinality - 1)::integer
    from jsonb_array_elements(attachments) with ordinality as entry(value, ordinality);
  end if;

  return query select new_post, null::text;
end;
$$;

-- ------------------------------------------------------------ read messages

-- One page of a channel or a thread, newest first.
--
-- Keyset on `(created_at, id)` rather than OFFSET: a channel only grows, and a
-- member scrolling back would have an offset walk re-read everything above
-- them. The id breaks ties, because two messages can share a timestamp.
create or replace function public.community_channel_messages(
  channel uuid,
  before_created_at timestamptz default null,
  before_id uuid default null,
  page_size integer default 50,
  thread uuid default null
)
returns table (
  id uuid,
  author_id uuid,
  author_name text,
  author_avatar text,
  author_color text,
  body text,
  post_type text,
  is_pinned boolean,
  created_at timestamptz,
  edited_at timestamptz,
  client_nonce text,
  reply_to_post_id uuid,
  reply_author_name text,
  reply_excerpt text,
  thread_id uuid,
  thread_name text,
  thread_message_count integer,
  attachments jsonb,
  reactions jsonb
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
         -- The highest role that carries a colour, which is what the name is
         -- tinted with in the message list.
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

create or replace function public.community_channel_pins(channel uuid)
returns table (id uuid, author_name text, body text, pinned_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.community_has('view_channel', channel) then
    raise exception 'You do not have access to that channel.' using errcode = '42501';
  end if;
  return query
  select post.id, coalesce(author.full_name, 'Former member'), post.body, post.pinned_at
  from public.posts post
  left join public.profiles author on author.id = post.author_id
  where post.channel_id = channel and post.is_pinned and not post.is_deleted
  order by post.pinned_at desc nulls last
  limit 50;
end;
$$;

-- ----------------------------------------------------------------- threads

create or replace function public.community_thread_create(root_post uuid, thread_name text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  source public.posts%rowtype;
  created uuid;
begin
  if actor is null then
    raise exception 'You are not signed in.' using errcode = '42501';
  end if;
  select * into source from public.posts where id = root_post and not is_deleted;
  if not found then
    raise exception 'That message no longer exists.';
  end if;
  if not public.community_has('create_threads', source.channel_id) then
    raise exception 'You do not have permission to start a thread here.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(thread_name, ''))) not between 1 and 100 then
    raise exception 'A thread name must be between 1 and 100 characters.';
  end if;

  insert into public.threads (root_post_id, channel_id, name, created_by)
  values (root_post, source.channel_id, btrim(thread_name), actor)
  returning id into created;

  return created;
end;
$$;

create or replace function public.community_thread_set(
  thread uuid,
  archived boolean default null,
  is_locked boolean default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  thread_row public.threads%rowtype;
begin
  select * into thread_row from public.threads where id = thread;
  if not found then
    raise exception 'That thread no longer exists.';
  end if;
  if not public.community_has('manage_threads', thread_row.channel_id) then
    raise exception 'You do not have permission to manage threads here.' using errcode = '42501';
  end if;

  update public.threads
  set archived_at = case when archived is null then archived_at
                         when archived then coalesce(archived_at, now())
                         else null end,
      locked = coalesce(is_locked, locked)
  where id = thread;
end;
$$;

-- --------------------------------------------------------------- read state

create or replace function public.community_mark_read(channel uuid, last_post uuid default null)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'You are not signed in.' using errcode = '42501';
  end if;
  if not public.community_has('view_channel', channel) then
    raise exception 'You do not have access to that channel.' using errcode = '42501';
  end if;

  insert into public.channel_read_states as state (user_id, channel_id, last_read_post_id, last_read_at, mention_count)
  values (actor, channel, last_post, now(), 0)
  on conflict (user_id, channel_id)
  do update set last_read_post_id = coalesce(excluded.last_read_post_id, state.last_read_post_id),
                last_read_at = now(),
                mention_count = 0;
end;
$$;

create or replace function public.community_set_channel_notification(
  channel uuid,
  notification_level text default 'all',
  mute_until timestamptz default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'You are not signed in.' using errcode = '42501';
  end if;
  if notification_level not in ('all', 'mentions', 'none') then
    raise exception 'That is not a notification level.';
  end if;
  if not public.community_has('view_channel', channel) then
    raise exception 'You do not have access to that channel.' using errcode = '42501';
  end if;

  insert into public.channel_notification_settings as setting (user_id, channel_id, level, muted_until)
  values (actor, channel, notification_level, mute_until)
  on conflict (user_id, channel_id)
  do update set level = excluded.level, muted_until = excluded.muted_until;
end;
$$;

-- ------------------------------------------------------------------- search

-- `ilike` against the trigram index rather than full-text search: members
-- search for fragments and tickers, not lexemes, and `websearch_to_tsquery`
-- would stem "trading" and "trade" together while missing "BTCUSD".
--
-- The query is escaped, so a member typing `%` searches for a percent sign
-- instead of matching every message ever written.
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

-- -------------------------------------------------------------- member data

create or replace function public.community_member_profile(target uuid)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  joined_at timestamptz,
  platform_role text,
  roles jsonb
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'You are not signed in.' using errcode = '42501';
  end if;
  return query
  select profile.id,
         coalesce(profile.full_name, 'Former member'),
         profile.avatar_url,
         membership.joined_at,
         profile.platform_role,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', role.id, 'name', role.name, 'color', role.color, 'position', role.position
                  ) order by role.position desc)
           from public.community_role_members assignment
           join public.community_roles role on role.id = assignment.role_id
           where assignment.user_id = profile.id
         ), '[]'::jsonb)
  from public.profiles profile
  left join public.memberships membership on membership.user_id = profile.id
  where profile.id = target and not profile.is_suspended;
end;
$$;

create or replace function public.community_member_directory()
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  top_role_id uuid,
  top_role_name text,
  top_role_color text,
  hoisted boolean,
  roles jsonb
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'You are not signed in.' using errcode = '42501';
  end if;
  return query
  with ranked as (
    select profile.id as member_id,
           coalesce(profile.full_name, 'Former member') as member_name,
           profile.avatar_url as member_avatar,
           (
             select role.id from public.community_role_members assignment
             join public.community_roles role on role.id = assignment.role_id
             where assignment.user_id = profile.id and role.hoist
             order by role.position desc limit 1
           ) as hoisted_role
    from public.profiles profile
    join public.memberships membership on membership.user_id = profile.id and membership.status = 'active'
    where not profile.is_suspended
  )
  select ranked.member_id, ranked.member_name, ranked.member_avatar,
         role.id, role.name, role.color, (role.id is not null),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', member_role.id, 'name', member_role.name, 'color', member_role.color
                  ) order by member_role.position desc)
           from public.community_role_members assignment
           join public.community_roles member_role on member_role.id = assignment.role_id
           where assignment.user_id = ranked.member_id
         ), '[]'::jsonb)
  from ranked
  left join public.community_roles role on role.id = ranked.hoisted_role
  order by coalesce(role.position, -1) desc, ranked.member_name;
end;
$$;

-- ---------------------------------------------------- directory with unread

-- Same shape as before, with `has_unread` and `mention_count` actually filled.
-- They were hard-coded false and 0 from phase 3 so the column list would not
-- have to change when the read-state table arrived.
create or replace function public.community_channel_directory()
returns table (
  category_id uuid, category_name text, category_description text, category_sort_order integer,
  channel_id uuid, channel_name text, channel_type text, channel_description text,
  channel_sort_order integer, min_tier integer, is_locked boolean, can_send boolean,
  slow_mode_seconds integer, permissions_synced boolean, unlock_tier integer,
  has_unread boolean, mention_count integer
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with visible as (
    select category.id as cat_id,
           category.name as cat_name,
           category.description as cat_description,
           category.sort_order as cat_sort_order,
           channel.id as ch_id,
           channel.name as ch_name,
           channel.type as ch_type,
           channel.description as ch_description,
           channel.sort_order as ch_sort_order,
           channel.min_tier as ch_min_tier,
           channel.slow_mode_seconds as ch_slow_mode,
           channel.permissions_synced as ch_synced,
           channel.visibility_mode as ch_visibility,
           public.community_permissions((select auth.uid()), channel.id) as perms,
           (
             select min(substring(role.system_key from 6)::integer)
             from public.channel_permission_overrides override
             join public.community_roles role on role.id = override.role_id
             where role.system_key in ('tier_1', 'tier_2', 'tier_3', 'tier_4', 'tier_5')
               and 'view_channel' = any(override.allow)
               and (case when channel.permissions_synced
                         then override.category_id = channel.category_id
                         else override.channel_id = channel.id end)
           ) as ch_unlock_tier,
           state.last_read_at as ch_last_read,
           coalesce(state.mention_count, 0) as ch_mentions
    from public.channel_categories category
    join public.channels channel on channel.category_id = category.id
    left join public.channel_read_states state
      on state.channel_id = channel.id and state.user_id = (select auth.uid())
    where not category.is_archived and not channel.is_archived and channel.is_active
  )
  select cat_id, cat_name, cat_description, cat_sort_order,
         ch_id, ch_name, ch_type,
         case when 'view_channel' = any(perms) then ch_description else null end,
         ch_sort_order, ch_min_tier,
         not ('view_channel' = any(perms)),
         'send_messages' = any(perms),
         ch_slow_mode, ch_synced, ch_unlock_tier,
         -- Never read is not unread: a channel nobody has opened would
         -- otherwise light up for every member on the day they join.
         (ch_last_read is not null and exists (
            select 1 from public.posts post
            where post.channel_id = ch_id and not post.is_deleted
              and post.created_at > ch_last_read
          )),
         ch_mentions
  from visible
  where 'view_channel' = any(perms)
     or (ch_visibility = 'locked' and ch_unlock_tier is not null)
  order by cat_sort_order, ch_sort_order;
$$;

-- ------------------------------------------------------------- viewer state

-- Everything the page layout needs in one round trip: who you are, what you
-- hold, what you may do in each channel, what you have read, what you have
-- muted. The layout renders before any channel is chosen, so splitting this
-- into five calls would mean five waterfalls before the first paint.
create or replace function public.community_viewer_state()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  gate text;
begin
  if actor is null then
    raise exception 'You are not signed in.' using errcode = '42501';
  end if;
  select private.community_gate(actor) into gate;

  return jsonb_build_object(
    'userId', actor,
    'gate', gate,
    'isInfluencer', public.is_influencer() or public.is_super_admin(),
    'profile', (
      select jsonb_build_object('fullName', coalesce(full_name, 'Member'), 'avatarUrl', avatar_url)
      from public.profiles where id = actor
    ),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', role.id, 'name', role.name, 'color', role.color,
               'position', role.position, 'hoist', role.hoist
             ) order by role.position desc)
      from public.community_role_members assignment
      join public.community_roles role on role.id = assignment.role_id
      where assignment.user_id = actor
    ), '[]'::jsonb),
    'grants', to_jsonb(public.community_permissions(actor)),
    'channelPermissions', coalesce((
      select jsonb_object_agg(channel.id::text, to_jsonb(public.community_permissions(actor, channel.id)))
      from public.channels channel
      where not channel.is_archived and channel.is_active
    ), '{}'::jsonb),
    'readStates', coalesce((
      select jsonb_object_agg(state.channel_id::text, jsonb_build_object(
               'lastReadAt', state.last_read_at,
               'lastReadPostId', state.last_read_post_id,
               'mentionCount', state.mention_count
             ))
      from public.channel_read_states state where state.user_id = actor
    ), '{}'::jsonb),
    'notificationSettings', coalesce((
      select jsonb_object_agg(setting.channel_id::text, jsonb_build_object(
               'level', setting.level, 'mutedUntil', setting.muted_until
             ))
      from public.channel_notification_settings setting where setting.user_id = actor
    ), '{}'::jsonb)
  );
end;
$$;

-- -------------------------------------------------------------------- grants

revoke execute on function private.automod_record_post() from public, anon, authenticated;

-- `create or replace` keeps the grants a function already had, so on this
-- database the directory stayed revoked. Replayed onto a fresh one it would
-- not: PostgreSQL grants EXECUTE to PUBLIC on a newly created function. See
-- Cross-Project Lessons 29 and 36.
revoke execute on function public.community_channel_directory() from public, anon;
grant execute on function public.community_channel_directory() to authenticated, service_role;

revoke execute on function public.community_send_message(uuid, text, uuid, uuid, jsonb, text) from public, anon;
revoke execute on function public.community_channel_messages(uuid, timestamptz, uuid, integer, uuid) from public, anon;
revoke execute on function public.community_channel_pins(uuid) from public, anon;
revoke execute on function public.community_thread_create(uuid, text) from public, anon;
revoke execute on function public.community_thread_set(uuid, boolean, boolean) from public, anon;
revoke execute on function public.community_mark_read(uuid, uuid) from public, anon;
revoke execute on function public.community_set_channel_notification(uuid, text, timestamptz) from public, anon;
revoke execute on function public.community_search_messages(text, uuid, timestamptz, integer) from public, anon;
revoke execute on function public.community_member_profile(uuid) from public, anon;
revoke execute on function public.community_member_directory() from public, anon;
revoke execute on function public.community_viewer_state() from public, anon;

grant execute on function public.community_send_message(uuid, text, uuid, uuid, jsonb, text) to authenticated, service_role;
grant execute on function public.community_channel_messages(uuid, timestamptz, uuid, integer, uuid) to authenticated, service_role;
grant execute on function public.community_channel_pins(uuid) to authenticated, service_role;
grant execute on function public.community_thread_create(uuid, text) to authenticated, service_role;
grant execute on function public.community_thread_set(uuid, boolean, boolean) to authenticated, service_role;
grant execute on function public.community_mark_read(uuid, uuid) to authenticated, service_role;
grant execute on function public.community_set_channel_notification(uuid, text, timestamptz) to authenticated, service_role;
grant execute on function public.community_search_messages(text, uuid, timestamptz, integer) to authenticated, service_role;
grant execute on function public.community_member_profile(uuid) to authenticated, service_role;
grant execute on function public.community_member_directory() to authenticated, service_role;
grant execute on function public.community_viewer_state() to authenticated, service_role;

notify pgrst, 'reload schema';
