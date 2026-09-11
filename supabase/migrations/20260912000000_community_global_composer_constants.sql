-- Composer and reaction rules become global constants.
--
-- Phase 5 made message length, links, attachments and the reaction set
-- per-community settings. The owner has since decided these are platform
-- rules, not creator choices: 10,000 characters, attachments up to 25 MB
-- (images, video, PDF), links allowed, any Unicode or custom emoji as a
-- reaction, at most 20 distinct emoji per message. This migration removes the
-- per-community columns and the dead RPC that read them, and replaces the
-- reaction predicate with a format check.
--
-- Provably a no-op on the data as it stands, verified live before applying:
-- 15 posts with a longest body of 41 characters; 6 reactions, every one a
-- single code point; the settings row at every default; the bucket at 20 MB
-- with six MIME types. Nothing stored is refused by anything below.

-- ----------------------------------------------------------------- pre-flight

do $$
begin
  if exists (select 1 from public.posts where char_length(body) > 10000) then
    raise exception 'pre-flight: a post exceeds 10,000 characters; the constant ceiling would refuse it';
  end if;
  if exists (
    select 1 from public.reactions
    where not (
      emoji ~ '^<:[a-z0-9_]{2,32}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>$'
      or emoji ~ '^([0-9#*]️?⃣|[^[:ascii:]]{1,16})$'
    )
  ) then
    raise exception 'pre-flight: a stored reaction would fail the new token validator';
  end if;
end $$;

-- --------------------------------------------------------- reaction validator

-- One Unicode grapheme (up to 16 code units, keycap sequences included) or a
-- custom emoji token `<:name:uuid>`. Immutable, so it can sit in a policy and
-- later in a CHECK. The custom branch is validated for *shape* only here; that
-- the emoji exists and the member may use it is the custom-emoji phase's job.
create or replace function public.community_reaction_token_is_valid(token text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select token is not null and (
    token ~ '^<:[a-z0-9_]{2,32}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>$'
    or token ~ '^([0-9#*]️?⃣|[^[:ascii:]]{1,16})$'
  );
$$;

revoke execute on function public.community_reaction_token_is_valid(text) from public;
revoke execute on function public.community_reaction_token_is_valid(text) from anon;
grant execute on function public.community_reaction_token_is_valid(text) to authenticated;

-- --------------------------------------------------------------------- policy

-- WITH CHECK still carries the predicate and USING still does not: a token that
-- later stops validating (a deleted custom emoji, say) must remain removable by
-- the member who placed it.
drop policy if exists reactions_own_write on public.reactions;
create policy reactions_own_write
  on public.reactions
  for all
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.posts post
      where post.id = reactions.post_id and not post.is_deleted and public.can_view_channel(post.channel_id)
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.posts post
      where post.id = reactions.post_id and not post.is_deleted and public.can_view_channel(post.channel_id)
    )
    and public.community_reaction_token_is_valid(reactions.emoji)
  );

-- ------------------------------------------------------------------- columns

alter table public.community_settings drop constraint if exists community_settings_composer_bounds;

alter table public.community_settings
  drop column if exists reaction_emojis,
  drop column if exists max_body_length,
  drop column if exists allow_links,
  drop column if exists allow_attachments,
  drop column if exists max_attachment_bytes,
  drop column if exists allowed_attachment_types;

-- Built for the composer to read its limits from; no TypeScript caller ever
-- existed, and the limits are now constants in src/lib/community/constants.ts.
drop function if exists public.community_composer_rules();

-- -------------------------------------------------------------------- bucket

-- 25 MB and PDF, matching ATTACHMENT_MAX_BYTES and ATTACHMENT_MIME_TYPES.
update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','application/pdf']::text[]
where id = 'community-posts';

-- ---------------------------------------------------------- content trigger

-- Same function as 20260911030000 minus the three branches that read the
-- dropped columns. Length is the fixed `posts_body_length_check` CHECK now;
-- links and attachments are always allowed. Mention gating, blocked words, slow
-- mode and the edit window are unchanged.
create or replace function private.assert_post_content_allowed()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  rules public.community_settings%rowtype;
  author_is_staff boolean;
  mention text;
  last_post timestamptz;
  matched text;
begin
  select * into rules from public.community_settings limit 1;
  if not found then
    return new;
  end if;

  if (select auth.uid()) is not null then
    mention := public.community_mention_kind(new.body);
    if mention = 'all' and not public.community_grant('mention_all') then
      raise exception 'You do not have permission to mention everyone here.';
    end if;
    if mention = 'tier' and not public.community_grant('mention_tier') then
      raise exception 'You do not have permission to mention a tier here.';
    end if;
  end if;

  select exists (
    select 1 from public.profiles
    where id = new.author_id and platform_role in ('moderator','influencer','super_admin')
  ) into author_is_staff;

  if coalesce(new.body, '') <> '' then
    select phrase into matched
    from public.community_blocked_words
    where case
            when rules.blocked_word_match = 'substring'
              then position(lower(btrim(phrase)) in lower(new.body)) > 0
            else new.body ~* ('(^|[^[:alnum:]_])' ||
                              regexp_replace(btrim(phrase), '([\^$.|?*+()\[\]{}\\])', '\\\1', 'g') ||
                              '([^[:alnum:]_]|$)')
          end
    limit 1;

    if matched is not null then
      if rules.blocked_word_mode = 'block' then
        raise exception 'That message contains a word this community does not allow.';
      elsif new.author_id is not null then
        insert into public.community_moderation_events (post_id, channel_id, actor_id, action, reason, previous_body)
        values (new.id, new.channel_id, new.author_id, 'flag', 'matched blocked phrase', left(new.body, 2000));
      end if;
    end if;
  end if;

  if tg_op = 'INSERT'
     and rules.slow_mode_seconds > 0
     and new.author_id is not null
     and not author_is_staff
     and not public.community_grant('bypass_slow_mode') then
    perform pg_advisory_xact_lock(hashtext(new.channel_id::text || ':' || new.author_id::text));

    select max(created_at) into last_post
    from public.posts
    where channel_id = new.channel_id and author_id = new.author_id and not is_deleted;

    if last_post is not null and now() < last_post + make_interval(secs => rules.slow_mode_seconds) then
      raise exception 'Slow mode is on here. You can post again in % seconds.',
        ceil(extract(epoch from (last_post + make_interval(secs => rules.slow_mode_seconds)) - now()));
    end if;
  end if;

  if tg_op = 'UPDATE'
     and rules.edit_window_minutes > 0
     and not author_is_staff
     and new.body is distinct from old.body
     and old.created_at < now() - make_interval(mins => rules.edit_window_minutes) then
    raise exception 'Messages can only be edited within % minutes of posting.', rules.edit_window_minutes;
  end if;

  return new;
end;
$$;

revoke execute on function private.assert_post_content_allowed() from public;
revoke execute on function private.assert_post_content_allowed() from anon;
revoke execute on function private.assert_post_content_allowed() from authenticated;
