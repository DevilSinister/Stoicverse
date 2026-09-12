-- The messaging model: replies, threads, attachments, mentions, read state.
--
-- Everything so far has treated a post as a row with a body and maybe an
-- image. The `/channels` page needs a message: something that can answer
-- another message, live in a thread, carry up to ten files, mention a person
-- or a role by id, and be marked read. This migration is that shape, plus the
-- RPCs the page reads and writes through.
--
-- Four decisions the rest of this file rests on:
--
-- 1. **A thread post keeps its parent's `channel_id`.** The alternative —
--    letting a thread own its posts — would mean every channel policy,
--    override and AutoMod exemption needed a second code path for threads.
--    Instead `thread_id` is an extra axis on a row that is still, for every
--    permission question, a post in that channel.
--
-- 2. **`reactions` gains `channel_id`.** Not denormalisation for its own sake:
--    the page subscribes to reactions per channel, and Supabase realtime can
--    only filter on columns of the row it delivers. Without this, a reaction
--    in any channel wakes every open channel.
--
-- 3. **`community_send_message` is the new write path, and it is a definer.**
--    It therefore repeats every check `posts_member_insert` makes, because
--    definer rights bypass the policy that was making them. That policy stays
--    in place for the legacy composer, which still inserts directly.
--
-- 4. **Old columns stay.** `posts.image_url` is backfilled into
--    `post_attachments` and then left alone, so the existing community
--    workspace keeps rendering while the new page is built. Phase 9 drops it.
--
-- Deferred on purpose, because the phase that owns it has not run:
--   * Custom emoji in a body are validated for shape only. `community_emoji_usable`
--     arrives in phase 6; until then no custom emoji exists, so such a token
--     names nothing and the shape check refuses it anyway.
--   * `channel_notification_settings.level = 'all'` stores a preference that
--     generates no extra notification yet. Phase P3 reads it for the unread
--     badge. No control in this phase sets it.

-- ----------------------------------------------------------------- pre-flight

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'private') then
    raise exception 'pre-flight: the private schema is missing';
  end if;

  if not exists (select 1 from pg_proc where proname = 'automod_match') then
    raise exception 'pre-flight: phase 5 (private.automod_match) is not applied; apply 20260912040000 first';
  end if;

  if not exists (select 1 from pg_proc where proname = 'community_has') then
    raise exception 'pre-flight: phase 2 (public.community_has) is not applied';
  end if;

  raise notice 'pre-flight: % post(s) carry an image_url and will be backfilled into post_attachments',
    (select count(*) from public.posts where image_url is not null);
  raise notice 'pre-flight: % reaction(s) will have channel_id backfilled',
    (select count(*) from public.reactions);
end $$;

-- ------------------------------------------------------------------- threads

create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  -- The message the thread hangs off. One thread per message, enforced by the
  -- unique constraint rather than in the RPC, so a double-submit cannot make
  -- two.
  root_post_id uuid not null unique references public.posts(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  locked boolean not null default false,
  message_count integer not null default 0 check (message_count >= 0),
  last_message_at timestamptz
);

comment on table public.threads is
  'A side conversation hanging off one message. Thread posts keep the parent channel_id.';

create index if not exists threads_channel_idx on public.threads (channel_id, last_message_at desc nulls last);
create index if not exists threads_created_by_idx on public.threads (created_by);
create index if not exists threads_root_post_idx on public.threads (root_post_id);

alter table public.threads enable row level security;

drop policy if exists threads_read on public.threads;
create policy threads_read
  on public.threads
  for select
  to authenticated
  using (public.community_has('view_channel', channel_id));

-- -------------------------------------------------------------- post columns

alter table public.posts
  add column if not exists reply_to_post_id uuid references public.posts(id) on delete set null,
  add column if not exists thread_id uuid references public.threads(id) on delete cascade,
  add column if not exists edited_at timestamptz,
  -- Supplied by the client so an optimistic bubble can be reconciled with the
  -- row that arrives over realtime, instead of rendering the message twice.
  add column if not exists client_nonce text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'posts_post_type_check' and pg_get_constraintdef(oid) like '%system%'
  ) then
    alter table public.posts drop constraint if exists posts_post_type_check;
    -- 'system' is how AutoMod and the platform speak in a channel: a post with
    -- no author. `author_id` was already nullable before this phase.
    alter table public.posts add constraint posts_post_type_check
      check (post_type in ('post', 'announcement', 'event', 'system'));
  end if;
end $$;

create index if not exists posts_channel_stream_idx
  on public.posts (channel_id, created_at desc, id desc)
  where not is_deleted and thread_id is null;

create index if not exists posts_thread_stream_idx
  on public.posts (thread_id, created_at, id)
  where not is_deleted and thread_id is not null;

create index if not exists posts_pinned_idx
  on public.posts (channel_id, pinned_at desc)
  where is_pinned and not is_deleted;

create index if not exists posts_reply_to_idx on public.posts (reply_to_post_id);
create index if not exists posts_thread_idx on public.posts (thread_id);

-- A reply and its parent must sit in the same channel, or a reply excerpt
-- would carry a message out of a channel the reader cannot see.
create or replace function private.assert_reply_same_channel()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  parent_channel uuid;
begin
  if new.reply_to_post_id is null then
    return new;
  end if;
  select channel_id into parent_channel from public.posts where id = new.reply_to_post_id;
  if parent_channel is null or parent_channel <> new.channel_id then
    raise exception 'A reply has to stay in the same channel as the message it answers.';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_assert_reply_channel on public.posts;
create trigger posts_assert_reply_channel
before insert or update of reply_to_post_id on public.posts
for each row execute function private.assert_reply_same_channel();

-- --------------------------------------------------------------- attachments

create table if not exists public.post_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  -- The object name inside `community-posts`, which is `<uid>/<channel>/<file>`.
  path text not null,
  mime_type text not null check (
    mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'application/pdf')
  ),
  -- Null only for rows backfilled from `image_url`, where the size was never
  -- recorded against the post. Every row written from here on carries it.
  byte_size bigint check (byte_size is null or byte_size between 0 and 26214400),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  sort_order integer not null default 0 check (sort_order between 0 and 9),
  created_at timestamptz not null default now(),
  unique (post_id, sort_order)
);

comment on table public.post_attachments is
  'Up to ten files per message, ordered. Backfilled from posts.image_url; that column goes in phase 9.';

create index if not exists post_attachments_post_idx on public.post_attachments (post_id, sort_order);
create index if not exists post_attachments_path_idx on public.post_attachments (path);

alter table public.post_attachments enable row level security;

drop policy if exists post_attachments_read on public.post_attachments;
create policy post_attachments_read
  on public.post_attachments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.posts post
      where post.id = post_attachments.post_id
        and not post.is_deleted
        and public.community_has('view_channel', post.channel_id)
    )
  );

-- `sort_order between 0 and 9` bounds the position; this bounds the count, so
-- ten rows at positions 0-9 is the only way to reach ten.
create or replace function private.assert_attachment_count()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if (select count(*) from public.post_attachments where post_id = new.post_id) > 10 then
    raise exception 'A message can carry at most 10 attachments.';
  end if;
  return new;
end;
$$;

drop trigger if exists post_attachments_cap on public.post_attachments;
create trigger post_attachments_cap
after insert on public.post_attachments
for each row execute function private.assert_attachment_count();

-- Backfill. The mime type is inferred from the extension, because the post
-- never recorded one; the size comes from the storage object where it exists.
do $$
declare
  moved integer := 0;
  skipped integer := 0;
begin
  insert into public.post_attachments (post_id, path, mime_type, byte_size, sort_order)
  select post.id,
         post.image_url,
         case
           when post.image_url ~* '\.png$' then 'image/png'
           when post.image_url ~* '\.(jpe?g)$' then 'image/jpeg'
           when post.image_url ~* '\.webp$' then 'image/webp'
           when post.image_url ~* '\.gif$' then 'image/gif'
           when post.image_url ~* '\.mp4$' then 'video/mp4'
           when post.image_url ~* '\.webm$' then 'video/webm'
           when post.image_url ~* '\.pdf$' then 'application/pdf'
         end,
         nullif(object.metadata->>'size', '')::bigint,
         0
  from public.posts post
  left join storage.objects object
    on object.bucket_id = 'community-posts' and object.name = post.image_url
  where post.image_url is not null
    and post.image_url ~* '\.(png|jpe?g|webp|gif|mp4|webm|pdf)$'
  on conflict (post_id, sort_order) do nothing;

  get diagnostics moved = row_count;

  select count(*) into skipped
  from public.posts
  where image_url is not null and image_url !~* '\.(png|jpe?g|webp|gif|mp4|webm|pdf)$';

  raise notice 'backfill: % attachment row(s) created, % image_url(s) skipped for an unrecognised extension',
    moved, skipped;
end $$;

-- The storage read policy matched `posts.image_url` only. Nothing writes that
-- column from here on, so without this every newly uploaded file would 404 for
-- everyone including its author.
drop policy if exists community_posts_visible_read on storage.objects;
create policy community_posts_visible_read
  on storage.objects
  for select
  using (
    bucket_id = 'community-posts'
    and (
      exists (
        select 1 from public.posts post
        where post.image_url = objects.name
          and not post.is_deleted
          and public.can_view_channel(post.channel_id)
      )
      or exists (
        select 1
        from public.post_attachments attachment
        join public.posts post on post.id = attachment.post_id
        where attachment.path = objects.name
          and not post.is_deleted
          and public.can_view_channel(post.channel_id)
      )
    )
  );

-- ------------------------------------------------------------------ mentions

create table if not exists public.post_mentions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  kind text not null check (kind in ('user', 'role', 'channel', 'everyone', 'here')),
  -- Null for `everyone` and `here`, which name no row.
  target_id uuid,
  created_at timestamptz not null default now(),
  constraint post_mentions_target_matches_kind check (
    (kind in ('everyone', 'here') and target_id is null)
    or (kind in ('user', 'role', 'channel') and target_id is not null)
  )
);

create unique index if not exists post_mentions_unique_idx
  on public.post_mentions (post_id, kind, coalesce(target_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists post_mentions_target_idx on public.post_mentions (kind, target_id);
create index if not exists post_mentions_post_idx on public.post_mentions (post_id);

alter table public.post_mentions enable row level security;

drop policy if exists post_mentions_read on public.post_mentions;
create policy post_mentions_read
  on public.post_mentions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.posts post
      where post.id = post_mentions.post_id
        and not post.is_deleted
        and public.community_has('view_channel', post.channel_id)
    )
  );

-- Token forms, all id-bearing so renaming a person, role or channel never
-- breaks an old message:
--   <@uuid>  a person     <@&uuid>  a role
--   <#uuid>  a channel    @everyone / @here
--
-- The legacy `@all` and `@tier-N` forms are deliberately not extracted. They
-- survive in old bodies and the client renders them as inert chips; a tier
-- mention is a role mention now, because tiers became roles in phase 2.
create or replace function private.extract_post_mentions(post uuid, body text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  body_text text := coalesce(body, '');
begin
  delete from public.post_mentions where post_id = post;

  insert into public.post_mentions (post_id, kind, target_id)
  select post, 'user', (token[1])::uuid
  from regexp_matches(body_text, '<@([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})>', 'g') as token
  on conflict do nothing;

  insert into public.post_mentions (post_id, kind, target_id)
  select post, 'role', (token[1])::uuid
  from regexp_matches(body_text, '<@&([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})>', 'g') as token
  on conflict do nothing;

  insert into public.post_mentions (post_id, kind, target_id)
  select post, 'channel', (token[1])::uuid
  from regexp_matches(body_text, '<#([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})>', 'g') as token
  on conflict do nothing;

  if body_text ~ '(^|[^[:alnum:]_])@everyone([^[:alnum:]_]|$)' then
    insert into public.post_mentions (post_id, kind, target_id)
    values (post, 'everyone', null) on conflict do nothing;
  end if;

  if body_text ~ '(^|[^[:alnum:]_])@here([^[:alnum:]_]|$)' then
    insert into public.post_mentions (post_id, kind, target_id)
    values (post, 'here', null) on conflict do nothing;
  end if;
end;
$$;

-- Who hears about a message, and why.
--
-- Reads `channel_notification_settings`, skips the author, skips anyone who
-- cannot see the channel, and bumps the unread mention counter that
-- `community_channel_directory` reports.
create or replace function private.notify_post_mentions(post uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  message public.posts%rowtype;
  body_excerpt text;
  action text;
  parent_author uuid;
begin
  select * into message from public.posts where id = post;
  if not found then
    return;
  end if;
  body_excerpt := left(coalesce(message.body, ''), 240);
  action := '/channels/' || message.channel_id;

  with recipients as (
    select distinct profile.id as user_id
    from public.post_mentions mention
    join public.profiles profile
      on (mention.kind = 'user' and profile.id = mention.target_id)
      or (mention.kind = 'role' and exists (
            select 1 from public.community_role_members assignment
            where assignment.role_id = mention.target_id and assignment.user_id = profile.id))
      or (mention.kind in ('everyone', 'here'))
    where mention.post_id = post
      and not profile.is_suspended
      and profile.id is distinct from message.author_id
      and 'view_channel' = any (public.community_permissions(profile.id, message.channel_id))
      and not exists (
        select 1 from public.channel_notification_settings setting
        where setting.user_id = profile.id
          and setting.channel_id = message.channel_id
          and (setting.level = 'none' or (setting.muted_until is not null and setting.muted_until > now()))
      )
  ),
  counted as (
    insert into public.channel_read_states as state (user_id, channel_id, mention_count, last_read_at)
    select user_id, message.channel_id, 1, now() from recipients
    on conflict (user_id, channel_id)
    do update set mention_count = state.mention_count + 1
    returning state.user_id
  )
  insert into public.notifications (user_id, type, title, body, action_url)
  select user_id, 'community_mention', 'You were mentioned in the community', body_excerpt, action
  from counted;

  -- A reply is a mention of one person, whether or not they were named in it.
  if message.reply_to_post_id is not null then
    select author_id into parent_author from public.posts where id = message.reply_to_post_id;
    if parent_author is not null
       and parent_author is distinct from message.author_id
       and not exists (select 1 from public.post_mentions where post_id = post and target_id = parent_author)
       and not exists (
         select 1 from public.channel_notification_settings setting
         where setting.user_id = parent_author
           and setting.channel_id = message.channel_id
           and (setting.level = 'none' or (setting.muted_until is not null and setting.muted_until > now()))
       )
       and 'view_channel' = any (public.community_permissions(parent_author, message.channel_id)) then
      insert into public.notifications (user_id, type, title, body, action_url)
      values (parent_author, 'community_reply', 'Someone replied to your message', body_excerpt, action);
    end if;
  end if;
end;
$$;

-- One trigger calling both, in a fixed order. Two AFTER triggers would fire in
-- name order, and a rename would silently reorder them.
create or replace function private.post_mentions_sync()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform private.extract_post_mentions(new.id, new.body);
  if tg_op = 'INSERT' then
    perform private.notify_post_mentions(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists posts_mentions_sync on public.posts;
create trigger posts_mentions_sync
after insert or update of body on public.posts
for each row execute function private.post_mentions_sync();

-- The old notifier read `@all` and `@tier-N` out of the body and joined
-- `member_tiers` to decide who to tell. Tiers are roles now, and a mention
-- carries an id.
drop trigger if exists posts_notify_mentions on public.posts;
drop function if exists public.notify_community_mentions();

-- --------------------------------------------------------------- read state

create table if not exists public.channel_read_states (
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  last_read_post_id uuid references public.posts(id) on delete set null,
  last_read_at timestamptz not null default now(),
  mention_count integer not null default 0 check (mention_count >= 0),
  primary key (user_id, channel_id)
);

create index if not exists channel_read_states_channel_idx on public.channel_read_states (channel_id);
create index if not exists channel_read_states_post_idx on public.channel_read_states (last_read_post_id);

alter table public.channel_read_states enable row level security;

drop policy if exists channel_read_states_own on public.channel_read_states;
create policy channel_read_states_own
  on public.channel_read_states
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create table if not exists public.channel_notification_settings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  -- 'all' is stored and not yet acted on: phase P3 reads it for the unread
  -- badge. Nothing in this phase offers a control that sets it.
  level text not null default 'all' check (level in ('all', 'mentions', 'none')),
  muted_until timestamptz,
  primary key (user_id, channel_id)
);

create index if not exists channel_notification_settings_channel_idx
  on public.channel_notification_settings (channel_id);

alter table public.channel_notification_settings enable row level security;

drop policy if exists channel_notification_settings_own on public.channel_notification_settings;
create policy channel_notification_settings_own
  on public.channel_notification_settings
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ----------------------------------------------------------- thread counters

create or replace function private.thread_touch()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.thread_id is not null then
    update public.threads
    set message_count = message_count + 1, last_message_at = new.created_at
    where id = new.thread_id;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_thread_touch on public.posts;
create trigger posts_thread_touch
after insert on public.posts
for each row execute function private.thread_touch();

-- ----------------------------------------------------------------- reactions

alter table public.reactions
  add column if not exists channel_id uuid references public.channels(id) on delete cascade;

create or replace function private.reaction_fill_channel()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.channel_id is null then
    select channel_id into new.channel_id from public.posts where id = new.post_id;
  end if;
  return new;
end;
$$;

drop trigger if exists reactions_fill_channel on public.reactions;
create trigger reactions_fill_channel
before insert on public.reactions
for each row execute function private.reaction_fill_channel();

update public.reactions reaction
set channel_id = post.channel_id
from public.posts post
where post.id = reaction.post_id and reaction.channel_id is null;

do $$
begin
  if exists (select 1 from public.reactions where channel_id is null) then
    raise exception 'backfill: % reaction(s) still have no channel_id',
      (select count(*) from public.reactions where channel_id is null);
  end if;
end $$;

alter table public.reactions alter column channel_id set not null;

create index if not exists reactions_channel_idx on public.reactions (channel_id, created_at desc);
create index if not exists reactions_post_idx on public.reactions (post_id);
create index if not exists reactions_user_idx on public.reactions (user_id);

-- Twenty distinct emoji per message, the cap Discord applies.
--
-- The advisory lock is not optional: two concurrent inserts of the twenty-first
-- and twenty-second emoji would both count twenty and both pass.
create or replace function private.reactions_cap_distinct()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  distinct_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(new.post_id::text));

  select count(distinct emoji) into distinct_count
  from public.reactions
  where post_id = new.post_id and emoji <> new.emoji;

  if distinct_count >= 20 then
    raise exception 'This message already has 20 different reactions.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists reactions_cap on public.reactions;
create trigger reactions_cap
before insert on public.reactions
for each row execute function private.reactions_cap_distinct();

-- ------------------------------------------------ posting rules, minus tiers

-- `@all` and `@tier-N` gating leaves this function. A mention carries an id
-- now, and the permission question moved into `community_send_message`, where
-- the mention has already been parsed and the specific role is known.
create or replace function private.assert_post_content_allowed()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  rules public.community_settings%rowtype;
  author_is_owner boolean;
  last_post timestamptz;
  channel_slow_mode integer;
  hit record;
begin
  select * into rules from public.community_settings limit 1;
  if not found then
    return new;
  end if;

  if char_length(coalesce(new.body, '')) > 10000 then
    raise exception 'Messages are limited to 10,000 characters here.';
  end if;

  select exists (
    select 1 from public.profiles
    where id = new.author_id and platform_role in ('influencer', 'super_admin')
  ) into author_is_owner;

  if coalesce(new.body, '') <> '' and not author_is_owner then
    select * into hit from private.automod_match(new.author_id, new.channel_id, new.body) limit 1;
    if hit.rule_id is not null and hit.action_block then
      raise exception 'That message was stopped by AutoMod rule "%".', hit.rule_name;
    end if;
  end if;

  select slow_mode_seconds into channel_slow_mode from public.channels where id = new.channel_id;

  if tg_op = 'INSERT'
     and coalesce(channel_slow_mode, 0) > 0
     and new.author_id is not null
     and not public.community_has('bypass_slowmode', new.channel_id) then
    perform pg_advisory_xact_lock(hashtext(new.channel_id::text || ':' || new.author_id::text));

    select max(created_at) into last_post
    from public.posts
    where channel_id = new.channel_id and author_id = new.author_id and not is_deleted;

    if last_post is not null and now() < last_post + make_interval(secs => channel_slow_mode) then
      raise exception 'Slow mode is on here. You can post again in % seconds.',
        ceil(extract(epoch from (last_post + make_interval(secs => channel_slow_mode)) - now()));
    end if;
  end if;

  if tg_op = 'UPDATE'
     and rules.edit_window_minutes > 0
     and not author_is_owner
     and new.body is distinct from old.body
     and old.created_at < now() - make_interval(mins => rules.edit_window_minutes) then
    raise exception 'Messages can only be edited within % minutes of posting.', rules.edit_window_minutes;
  end if;

  return new;
end;
$$;

drop function if exists public.community_mention_kind(text);

-- ------------------------------------------------------------------- grants

revoke insert, update, delete, truncate on public.threads from anon, authenticated;
revoke insert, update, delete, truncate on public.post_attachments from anon, authenticated;
revoke insert, update, delete, truncate on public.post_mentions from anon, authenticated;
revoke insert, update, delete, truncate on public.channel_read_states from anon, authenticated;
revoke insert, update, delete, truncate on public.channel_notification_settings from anon, authenticated;

grant select on public.threads, public.post_attachments, public.post_mentions,
                public.channel_read_states, public.channel_notification_settings to authenticated;
grant all on public.threads, public.post_attachments, public.post_mentions,
             public.channel_read_states, public.channel_notification_settings to service_role;

revoke execute on function private.assert_reply_same_channel() from public, anon, authenticated;
revoke execute on function private.assert_attachment_count() from public, anon, authenticated;
revoke execute on function private.extract_post_mentions(uuid, text) from public, anon, authenticated;
revoke execute on function private.notify_post_mentions(uuid) from public, anon, authenticated;
revoke execute on function private.post_mentions_sync() from public, anon, authenticated;
revoke execute on function private.thread_touch() from public, anon, authenticated;
revoke execute on function private.reaction_fill_channel() from public, anon, authenticated;
revoke execute on function private.reactions_cap_distinct() from public, anon, authenticated;
revoke execute on function private.assert_post_content_allowed() from public, anon, authenticated;

notify pgrst, 'reload schema';
