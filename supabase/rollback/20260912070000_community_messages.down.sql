-- Rollback for 20260912070000_community_messages.sql.
--
-- Run 20260912070001_community_message_rpcs.down.sql first: those RPCs read
-- every table this file drops.
--
-- **This loses data, and not only the obvious kind.**
--
--   * Every thread is dropped, and `posts.thread_id` is `on delete cascade`,
--     so **the messages inside a thread would go with it**. The first
--     statement below detaches them into the channel instead, which is the
--     less destructive reading of "undo" — but it changes where those messages
--     appear, and it cannot be undone a second time.
--   * `posts.image_url` is written back from `post_attachments` at
--     `sort_order = 0`. A message with two or more attachments keeps only the
--     first: the old column holds one image and there is nowhere to put the
--     rest.
--   * Replies lose their parent, mentions lose their targets, and every read
--     state and per-channel notification preference is discarded.
--
-- Run this to undo a failed apply, not to step back a shipped phase.

-- Detach thread messages before the cascade takes them. They become ordinary
-- messages in the channel they were always stored against.
update public.posts set thread_id = null where thread_id is not null;

-- Put the first attachment back where the legacy composer reads it.
update public.posts post
set image_url = attachment.path
from public.post_attachments attachment
where attachment.post_id = post.id
  and attachment.sort_order = 0
  and post.image_url is null;

do $$
declare
  orphaned integer;
begin
  select count(*) into orphaned from public.post_attachments where sort_order > 0;
  if orphaned > 0 then
    raise notice 'rollback: % attachment row(s) beyond the first are being discarded with no column to hold them', orphaned;
  end if;
end $$;

drop trigger if exists posts_mentions_sync on public.posts;
drop trigger if exists posts_thread_touch on public.posts;
drop trigger if exists posts_assert_reply_channel on public.posts;
drop trigger if exists post_attachments_cap on public.post_attachments;
drop trigger if exists reactions_cap on public.reactions;
drop trigger if exists reactions_fill_channel on public.reactions;

drop function if exists private.post_mentions_sync();
drop function if exists private.notify_post_mentions(uuid);
drop function if exists private.extract_post_mentions(uuid, text);
drop function if exists private.thread_touch();
drop function if exists private.assert_reply_same_channel();
drop function if exists private.assert_attachment_count();
drop function if exists private.reactions_cap_distinct();
drop function if exists private.reaction_fill_channel();

-- The storage read policy goes back to matching `posts.image_url` only.
drop policy if exists community_posts_visible_read on storage.objects;
create policy community_posts_visible_read
  on storage.objects
  for select
  using (
    bucket_id = 'community-posts'
    and exists (
      select 1 from public.posts post
      where post.image_url = objects.name
        and not post.is_deleted
        and public.can_view_channel(post.channel_id)
    )
  );

drop table if exists public.channel_notification_settings;
drop table if exists public.channel_read_states;
drop table if exists public.post_mentions;
drop table if exists public.post_attachments;

alter table public.posts
  drop column if exists reply_to_post_id,
  drop column if exists thread_id,
  drop column if exists edited_at,
  drop column if exists client_nonce;

drop table if exists public.threads;

drop index if exists public.posts_channel_stream_idx;
drop index if exists public.posts_thread_stream_idx;
drop index if exists public.posts_pinned_idx;
drop index if exists public.posts_reply_to_idx;
drop index if exists public.posts_thread_idx;

alter table public.posts drop constraint if exists posts_post_type_check;
alter table public.posts add constraint posts_post_type_check
  check (post_type in ('post', 'announcement', 'event'));

drop index if exists public.reactions_channel_idx;
drop index if exists public.reactions_post_idx;
drop index if exists public.reactions_user_idx;
alter table public.reactions drop column if exists channel_id;

-- `community_mention_kind` comes back first, because the trigger below calls it.
create or replace function public.community_mention_kind(body_text text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case
    when body_text ~* '(^|[^[:alnum:]_])@all([^[:alnum:]_]|$)' then 'all'
    when body_text ~* '(^|[^[:alnum:]_])@tier-[1-5]([^[:alnum:]_]|$)' then 'tier'
    else null
  end;
$$;

revoke execute on function public.community_mention_kind(text) from public, anon;
grant execute on function public.community_mention_kind(text) to authenticated, service_role;

-- Phase 3's body, restored: the `@all` / `@tier-N` gating this phase removed,
-- with the AutoMod lookup phase 5 had already put in place of the blocked-word
-- block kept as it was.
create or replace function private.assert_post_content_allowed()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  rules public.community_settings%rowtype;
  author_is_owner boolean;
  mention text;
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

  if (select auth.uid()) is not null then
    mention := public.community_mention_kind(new.body);
    if mention = 'all' and not public.community_has('mention_everyone', new.channel_id) then
      raise exception 'You do not have permission to mention everyone here.';
    end if;
    if mention = 'tier' and not public.community_has('mention_roles', new.channel_id) then
      raise exception 'You do not have permission to mention a tier here.';
    end if;
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

revoke execute on function private.assert_post_content_allowed() from public, anon, authenticated;

-- The mention notifier this phase replaced, reading `@all` and `@tier-N` and
-- joining `member_tiers`.
create or replace function public.notify_community_mentions()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  body_text text := coalesce(new.body, '');
  kind text := public.community_mention_kind(body_text);
  action text := '/dashboard/community?channel=' || new.channel_id;
begin
  if kind is null then
    return new;
  end if;

  insert into public.notifications(user_id, type, title, body, action_url)
  select profile.id,
         'community_mention',
         case when kind = 'all'
              then 'You were mentioned in the community'
              else 'Your tier was mentioned in the community' end,
         left(body_text, 240),
         action
  from public.profiles profile
  join public.memberships membership on membership.user_id = profile.id and membership.status = 'active'
  join public.member_tiers tier on tier.user_id = profile.id
  where not profile.is_suspended
    and profile.id <> new.author_id
    and (
      kind = 'all'
      or body_text ~* ('(^|[^[:alnum:]_])@tier-' || case when tier.is_master then 5 else tier.current_tier end || '([^[:alnum:]_]|$)')
    );

  return new;
end;
$$;

revoke execute on function public.notify_community_mentions() from public, anon, authenticated;

drop trigger if exists posts_notify_mentions on public.posts;
create trigger posts_notify_mentions
after insert on public.posts
for each row execute function public.notify_community_mentions();

notify pgrst, 'reload schema';
