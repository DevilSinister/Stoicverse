-- Slow mode, blocked words, edit window, and delete reasons.
--
-- Every default here is "off", so this migration changes no behaviour on apply.
--
-- A note that belongs in the interface as much as in the schema: blocked-word
-- matching is a speed bump, not a filter. Homoglyphs, zero-width joiners and
-- letter-spacing all pass straight through it. The settings UI says so; it must
-- never imply a guarantee it cannot keep.

-- ------------------------------------------------------------------- columns

alter table public.community_settings
  add column if not exists slow_mode_seconds integer not null default 0,
  add column if not exists edit_window_minutes integer not null default 0,
  add column if not exists delete_requires_reason boolean not null default false,
  add column if not exists blocked_word_mode text not null default 'block',
  add column if not exists blocked_word_match text not null default 'word';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'community_settings_moderation_bounds') then
    alter table public.community_settings add constraint community_settings_moderation_bounds check (
      -- 0 means off. The ceiling is six hours; beyond that it is a channel
      -- nobody can use rather than a pace control.
      slow_mode_seconds between 0 and 21600
      -- 0 means edits never expire.
      and edit_window_minutes between 0 and 10080
      and blocked_word_mode in ('block', 'flag')
      and blocked_word_match in ('word', 'substring')
    );
  end if;
end $$;

-- -------------------------------------------------------------- blocked words

-- Literal phrases only, never user-supplied regex: a regex evaluated on every
-- insert is a denial-of-service vector aimed at your own database.
create table if not exists public.community_blocked_words (
  id         uuid primary key default gen_random_uuid(),
  phrase     text not null check (char_length(btrim(phrase)) between 2 and 60),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create unique index if not exists community_blocked_words_phrase_idx
  on public.community_blocked_words (lower(btrim(phrase)));

comment on table public.community_blocked_words is
  'Staff-only read. The definer trigger still checks every member post against rows the member cannot see — which is the point.';

alter table public.community_blocked_words enable row level security;

drop policy if exists community_blocked_words_staff_read on public.community_blocked_words;
create policy community_blocked_words_staff_read
  on public.community_blocked_words
  for select
  to authenticated
  using (public.is_staff());

drop policy if exists community_blocked_words_influencer_write on public.community_blocked_words;
create policy community_blocked_words_influencer_write
  on public.community_blocked_words
  for all
  to authenticated
  using (public.is_influencer() or public.is_super_admin())
  with check (public.is_influencer() or public.is_super_admin());

-- 'flag' mode records rather than refuses, so the audit vocabulary grows by one.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'community_moderation_events_action_check') then
    alter table public.community_moderation_events drop constraint community_moderation_events_action_check;
  end if;
  alter table public.community_moderation_events
    add constraint community_moderation_events_action_check
    check (action in ('edit', 'delete', 'pin', 'unpin', 'flag'));
end $$;

-- --------------------------------------------------------------- enforcement

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

  if char_length(coalesce(new.body, '')) > rules.max_body_length then
    raise exception 'Messages are limited to % characters here.', rules.max_body_length;
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

  -- Blocked words apply to everyone, staff included. A phrase the community has
  -- banned should not appear in an announcement either.
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
        -- Flag: record and let it through. Written by this definer function, so
        -- it lands in the audit table that has no insert policy.
        insert into public.community_moderation_events (post_id, channel_id, actor_id, action, reason, previous_body)
        values (new.id, new.channel_id, new.author_id, 'flag', 'matched blocked phrase', left(new.body, 2000));
      end if;
    end if;
  end if;

  -- Slow mode. The advisory lock is not optional: two concurrent inserts would
  -- otherwise both read the same max(created_at) and both pass.
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

  -- Edit window, members only. Staff editing an older post is a correction; a
  -- member rewriting a week-old message changes the record.
  if tg_op = 'UPDATE'
     and rules.edit_window_minutes > 0
     and not author_is_staff
     and new.body is distinct from old.body
     and old.created_at < now() - make_interval(mins => rules.edit_window_minutes) then
    raise exception 'Messages can only be edited within % minutes of posting.', rules.edit_window_minutes;
  end if;

  if author_is_staff then
    return new;
  end if;

  if not rules.allow_links and coalesce(new.body, '') ~* '(https?://|www\.)' then
    raise exception 'Links are not allowed in this community.';
  end if;

  if not rules.allow_attachments and new.image_url is not null then
    raise exception 'Attachments are not allowed in this community.';
  end if;

  return new;
end;
$$;
