-- AutoMod: rules that read a message before it lands.
--
-- Phase 1 of the moderation engine gave this community one blunt instrument:
-- a flat list of blocked phrases in `community_blocked_words`, matched by two
-- settings columns that applied to every phrase at once. You could not say
-- "these words block, those words only alert", you could not exempt a role or
-- a channel, and the only thing a phrase could do was stop the message.
--
-- This replaces it with rules. A rule has a kind (keyword, preset, mention
-- spam, link filter, duplicate spam), its own match settings, its own
-- exemptions, and its own actions. The old flat list becomes exactly one
-- keyword rule named "Blocked words" carrying the settings it used to read
-- from `community_settings`, so nothing a moderator configured is lost.
--
-- Two decisions the rest of this file depends on:
--
-- 1. **No regex, ever.** A keyword is plain text plus `*`, and the pattern is
--    compiled by `community_compile_keyword_pattern` inside a trigger. A
--    moderator cannot type a pattern, so a moderator cannot type a pattern
--    that takes the database down. `compiled_pattern` is not writable from
--    outside: the trigger overwrites whatever was sent.
--
-- 2. **The influencer is exempt from every rule.** They own the community; a
--    filter that can silence the owner is a filter that can lock the owner
--    out of their own moderation settings.
--
-- On this database the phrase list is empty, so the conversion below creates
-- no rule and changes no behaviour for any existing message. Every table here
-- is new.
--
-- Alerts on a blocked message are deliberately not persisted yet. The block
-- path raises, which rolls its own alert row back; phase 8's
-- `community_send_message` evaluates before the insert and is where that
-- becomes possible. `alert_channel_id` is carried here and read by nothing
-- until phase 8 adds `post_type = 'system'` and a nullable `posts.author_id`.

-- ----------------------------------------------------------------- pre-flight

do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'community_mod_cases'
  ) then
    raise exception 'pre-flight: phase 4 (community_mod_cases) is not applied; apply 20260912030000 first';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'community_moderation_events_action_check'
      and pg_get_constraintdef(oid) like '%automod_block%'
  ) then
    raise exception 'pre-flight: community_moderation_events does not accept the automod_block action';
  end if;

  raise notice 'pre-flight: % blocked phrase(s) will be converted into a keyword rule',
    (select count(*) from public.community_blocked_words);
end $$;

-- ------------------------------------------------------------------- presets

-- Curated phrase lists the influencer switches on rather than types out. Read
-- by anyone who can configure the community; written by this migration only,
-- so there is no DML policy and no RPC that touches them.
create table if not exists public.community_automod_presets (
  key text primary key,
  label text not null check (char_length(btrim(label)) between 2 and 60),
  description text not null check (char_length(btrim(description)) between 2 and 200),
  phrases text[] not null check (array_length(phrases, 1) between 1 and 500),
  updated_at timestamptz not null default now()
);

comment on table public.community_automod_presets is
  'Seeded phrase lists for preset AutoMod rules. Written by migration only.';

alter table public.community_automod_presets enable row level security;

drop policy if exists community_automod_presets_read on public.community_automod_presets;
create policy community_automod_presets_read
  on public.community_automod_presets
  for select
  to authenticated
  using (public.community_has('manage_community'));

insert into public.community_automod_presets (key, label, description, phrases) values
  (
    'profanity',
    'Profanity',
    'Common English swearing, including the usual letter-swap spellings.',
    array['fuck', 'fuck*', 'sh*t', 'bullsh*t', 'bitch', 'bastard', 'asshole', 'dickhead', 'wanker', 'cunt', 'motherf*']
  ),
  (
    'slurs',
    'Slurs',
    'Racial, ethnic and identity-based slurs. Blocking is strongly recommended.',
    array['n*gger', 'n*gga', 'f*ggot', 'tr*nny', 'k*ke', 'sp*c', 'ch*nk', 'w*tback', 'r*tard', 'r*tarded']
  ),
  (
    'sexual_content',
    'Sexual content',
    'Explicit sexual language, for a community that keeps the channels work-safe.',
    array['porn*', 'blowjob', 'handjob', 'creampie', 'cumshot', 'onlyfans', 'nudes', 'sexting', 'camgirl', 'escort service']
  ),
  (
    'scam_phrases',
    'Scams and solicitation',
    'The recruitment and giveaway patterns that follow any community about money.',
    array[
      'guaranteed returns', 'guaranteed profit', 'double your money', 'risk free investment',
      'dm me to invest', 'dm for signals', 'private signals', 'crypto giveaway', 'free crypto',
      'send me * and i will', 'recovery expert', 'recover your lost funds', 'binary options',
      'forex mentor dm', 'whatsapp me on'
    ]
  )
on conflict (key) do update
  set label = excluded.label,
      description = excluded.description,
      phrases = excluded.phrases,
      updated_at = now();

-- --------------------------------------------------------------------- rules

create table if not exists public.community_automod_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  kind text not null check (kind in ('keyword', 'preset', 'mention_spam', 'link_filter', 'duplicate_spam')),
  enabled boolean not null default true,

  -- keyword
  keywords text[] check (keywords is null or array_length(keywords, 1) between 1 and 200),
  match_mode text check (match_mode is null or match_mode in ('word', 'substring')),
  -- Written by `private.automod_rule_compile` and by nothing else. A contract
  -- test asserts no RPC in this file assigns to it.
  compiled_pattern text,

  -- preset
  preset_key text references public.community_automod_presets(key) on delete restrict,

  -- mention_spam
  mention_limit integer check (mention_limit is null or mention_limit between 1 and 50),

  -- link_filter. An empty array is meaningful: it blocks every link.
  allowed_domains text[] check (allowed_domains is null or array_length(allowed_domains, 1) is null or array_length(allowed_domains, 1) <= 100),

  -- duplicate_spam
  duplicate_count integer check (duplicate_count is null or duplicate_count between 2 and 20),
  duplicate_window_seconds integer check (duplicate_window_seconds is null or duplicate_window_seconds between 10 and 3600),

  -- actions
  action_block boolean not null default true,
  alert_channel_id uuid references public.channels(id) on delete set null,
  timeout_seconds integer check (timeout_seconds is null or timeout_seconds between 60 and 2419200),

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Each kind carries its own fields and nothing else, so a rule cannot hold
  -- settings that its kind will never read.
  constraint community_automod_rules_kind_fields check (
    case kind
      when 'keyword' then
        keywords is not null and match_mode is not null
        and preset_key is null and mention_limit is null and allowed_domains is null
        and duplicate_count is null and duplicate_window_seconds is null
      when 'preset' then
        preset_key is not null and match_mode is not null
        and keywords is null and mention_limit is null and allowed_domains is null
        and duplicate_count is null and duplicate_window_seconds is null
      when 'mention_spam' then
        mention_limit is not null
        and keywords is null and match_mode is null and preset_key is null
        and allowed_domains is null and duplicate_count is null and duplicate_window_seconds is null
      when 'link_filter' then
        allowed_domains is not null
        and keywords is null and match_mode is null and preset_key is null
        and mention_limit is null and duplicate_count is null and duplicate_window_seconds is null
      when 'duplicate_spam' then
        duplicate_count is not null and duplicate_window_seconds is not null
        and keywords is null and match_mode is null and preset_key is null
        and mention_limit is null and allowed_domains is null
      else false
    end
  ),

  -- A timeout is an escalation of a block, never an alternative to one: a rule
  -- that times someone out while letting the message stand reads to everyone
  -- else as the moderation team disappearing a person for nothing.
  constraint community_automod_rules_timeout_needs_block check (
    timeout_seconds is null or action_block
  )
);

comment on table public.community_automod_rules is
  'AutoMod rules. compiled_pattern is trigger-owned; the influencer is exempt from every rule.';

create unique index if not exists community_automod_rules_name_idx
  on public.community_automod_rules (lower(btrim(name)));

create index if not exists community_automod_rules_enabled_idx
  on public.community_automod_rules (kind) where enabled;

create index if not exists community_automod_rules_preset_idx
  on public.community_automod_rules (preset_key);

create index if not exists community_automod_rules_alert_channel_idx
  on public.community_automod_rules (alert_channel_id);

create index if not exists community_automod_rules_created_by_idx
  on public.community_automod_rules (created_by);

alter table public.community_automod_rules enable row level security;

drop policy if exists community_automod_rules_read on public.community_automod_rules;
create policy community_automod_rules_read
  on public.community_automod_rules
  for select
  to authenticated
  using (public.community_has('manage_community'));

-- ---------------------------------------------------------------- exemptions

create table if not exists public.community_automod_exemptions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.community_automod_rules(id) on delete cascade,
  role_id uuid references public.community_roles(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- One target per row. A row exempting both would be two rules pretending to
  -- be one, and the resolver would have to guess whether it meant "and" or "or".
  constraint community_automod_exemptions_one_target check (
    (role_id is not null)::int + (channel_id is not null)::int = 1
  )
);

create unique index if not exists community_automod_exemptions_role_idx
  on public.community_automod_exemptions (rule_id, role_id) where role_id is not null;

create unique index if not exists community_automod_exemptions_channel_idx
  on public.community_automod_exemptions (rule_id, channel_id) where channel_id is not null;

create index if not exists community_automod_exemptions_role_fk_idx
  on public.community_automod_exemptions (role_id);

create index if not exists community_automod_exemptions_channel_fk_idx
  on public.community_automod_exemptions (channel_id);

alter table public.community_automod_exemptions enable row level security;

drop policy if exists community_automod_exemptions_read on public.community_automod_exemptions;
create policy community_automod_exemptions_read
  on public.community_automod_exemptions
  for select
  to authenticated
  using (public.community_has('manage_community'));

-- -------------------------------------------------------------------- alerts

-- Append-only. Every match writes one of these whether or not the message was
-- allowed through, so "what has AutoMod been doing" is answerable without
-- reading the audit log.
create table if not exists public.community_automod_alerts (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references public.community_automod_rules(id) on delete set null,
  -- Kept as text as well as a reference: deleting a rule must not erase the
  -- record of what it did while it existed.
  rule_name text not null,
  subject_id uuid references public.profiles(id) on delete set null,
  channel_id uuid references public.channels(id) on delete set null,
  post_id uuid references public.posts(id) on delete set null,
  blocked boolean not null,
  body_excerpt text not null check (char_length(body_excerpt) <= 2000),
  created_at timestamptz not null default now()
);

comment on table public.community_automod_alerts is
  'Append-only record of AutoMod matches. Written by definer functions only.';

create index if not exists community_automod_alerts_created_idx
  on public.community_automod_alerts (created_at desc, id desc);

create index if not exists community_automod_alerts_rule_idx on public.community_automod_alerts (rule_id);
create index if not exists community_automod_alerts_subject_idx on public.community_automod_alerts (subject_id);
create index if not exists community_automod_alerts_channel_idx on public.community_automod_alerts (channel_id);
create index if not exists community_automod_alerts_post_idx on public.community_automod_alerts (post_id);

alter table public.community_automod_alerts enable row level security;

drop policy if exists community_automod_alerts_read on public.community_automod_alerts;
create policy community_automod_alerts_read
  on public.community_automod_alerts
  for select
  to authenticated
  using (public.community_has('moderate_members'));

-- A case AutoMod opened names the rule that opened it.
alter table public.community_mod_cases
  add column if not exists automod_rule_id uuid references public.community_automod_rules(id) on delete set null;

create index if not exists community_mod_cases_automod_rule_idx
  on public.community_mod_cases (automod_rule_id);

-- Duplicate-spam detection reads a person's recent messages, which nothing
-- else indexes.
create index if not exists posts_author_recent_idx
  on public.posts (author_id, created_at desc) where not is_deleted;

-- ------------------------------------------------------- pattern compilation

-- Plain text plus `*`, turned into one POSIX alternation.
--
-- `src/lib/community-settings/automod.ts` holds a character-for-character
-- mirror of this and `tests/community-automod.test.mjs` asserts the two agree,
-- because the interface's "test a sentence" box is worthless if it disagrees
-- with what the database does on save.
--
-- `*` expands to at most 30 word characters rather than `.*`: an unbounded
-- wildcard between two alternations is how a phrase list becomes a stalled
-- connection.
create or replace function public.community_compile_keyword_pattern(keywords text[], mode text)
returns text
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $$
declare
  word text;
  cleaned text;
  parts text[] := array[]::text[];
  joined text;
begin
  if keywords is null or array_length(keywords, 1) is null then
    return null;
  end if;
  if mode is null or mode not in ('word', 'substring') then
    raise exception 'AutoMod match mode must be word or substring.';
  end if;

  foreach word in array keywords loop
    cleaned := lower(btrim(word));
    continue when cleaned = '';
    -- Escape every regex metacharacter except `*`, which is the one wildcard
    -- a moderator is allowed to type.
    cleaned := regexp_replace(cleaned, '([\^$.|?+()\[\]{}\\])', '\\\1', 'g');
    cleaned := replace(cleaned, '*', '[[:alnum:]_]{0,30}');
    parts := parts || cleaned;
  end loop;

  if array_length(parts, 1) is null then
    return null;
  end if;

  joined := array_to_string(parts, '|');
  if mode = 'word' then
    -- `[^[:alnum:]_]` rather than `\y`, which treats accented letters
    -- differently from the JavaScript mirror.
    return '(^|[^[:alnum:]_])(' || joined || ')([^[:alnum:]_]|$)';
  end if;
  return '(' || joined || ')';
end;
$$;

-- Keywords are validated here rather than by a CHECK, because a CHECK cannot
-- name which element of the array was wrong.
create or replace function private.automod_assert_keywords(keywords text[])
returns void
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $$
declare
  word text;
  cleaned text;
begin
  foreach word in array coalesce(keywords, array[]::text[]) loop
    cleaned := btrim(word);
    if char_length(cleaned) < 2 or char_length(cleaned) > 60 then
      raise exception 'Each keyword must be between 2 and 60 characters: %', cleaned;
    end if;
    if cleaned !~ '^[[:alnum:]_''* -]+$' then
      raise exception 'Keywords may only contain letters, numbers, spaces, hyphens, apostrophes, underscores and *: %', cleaned;
    end if;
  end loop;
end;
$$;

create or replace function private.automod_rule_compile()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  source_keywords text[];
begin
  if new.kind = 'keyword' then
    perform private.automod_assert_keywords(new.keywords);
    source_keywords := new.keywords;
  elsif new.kind = 'preset' then
    select phrases into source_keywords from public.community_automod_presets where key = new.preset_key;
    if source_keywords is null then
      raise exception 'AutoMod preset % does not exist.', new.preset_key;
    end if;
  else
    new.compiled_pattern := null;
    new.updated_at := now();
    return new;
  end if;

  new.compiled_pattern := public.community_compile_keyword_pattern(source_keywords, new.match_mode);
  if new.compiled_pattern is null then
    raise exception 'That rule has no usable keywords.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists community_automod_rules_compile on public.community_automod_rules;
create trigger community_automod_rules_compile
before insert or update on public.community_automod_rules
for each row execute function private.automod_rule_compile();

-- A preset's phrase list is edited by a migration, not by a person — but when
-- it is, every rule pointing at it has to be recompiled or it keeps matching
-- yesterday's list.
create or replace function private.automod_preset_recompile()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  update public.community_automod_rules
  set compiled_pattern = public.community_compile_keyword_pattern(new.phrases, match_mode)
  where preset_key = new.key;
  return new;
end;
$$;

drop trigger if exists community_automod_presets_recompile on public.community_automod_presets;
create trigger community_automod_presets_recompile
after update of phrases on public.community_automod_presets
for each row execute function private.automod_preset_recompile();

-- ------------------------------------------------------------------ matching

-- Pure. Finds the first enabled rule that matches, and writes nothing.
--
-- Split from the side effects on purpose: the BEFORE INSERT trigger on `posts`
-- calls this and raises, and a raise would roll back any row this had written.
-- `private.automod_evaluate` is the one that records.
create or replace function private.automod_match(author uuid, channel uuid, body text)
returns table (rule_id uuid, rule_name text, action_block boolean, timeout_seconds integer, alert_channel_id uuid)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  rule public.community_automod_rules%rowtype;
  text_body text := coalesce(body, '');
  mention_count integer;
  host text;
  offending boolean;
  duplicates integer;
begin
  if text_body = '' or author is null then
    return;
  end if;

  -- The owner is exempt from every rule. See the header.
  if exists (
    select 1 from public.profiles
    where id = author and platform_role in ('influencer', 'super_admin')
  ) then
    return;
  end if;

  for rule in
    select * from public.community_automod_rules
    where enabled
    order by created_at
  loop
    -- Channel exemption.
    if channel is not null and exists (
      select 1 from public.community_automod_exemptions exemption
      where exemption.rule_id = rule.id and exemption.channel_id = channel
    ) then
      continue;
    end if;

    -- Role exemption: any exempt role the author actually holds.
    if exists (
      select 1
      from public.community_automod_exemptions exemption
      join public.community_role_members assignment on assignment.role_id = exemption.role_id
      where exemption.rule_id = rule.id and assignment.user_id = author
    ) then
      continue;
    end if;

    if rule.kind in ('keyword', 'preset') then
      if rule.compiled_pattern is not null and text_body ~* rule.compiled_pattern then
        return query select rule.id, rule.name, rule.action_block, rule.timeout_seconds, rule.alert_channel_id;
        return;
      end if;

    elsif rule.kind = 'mention_spam' then
      -- Counts both the legacy `@name` form and phase 8's `<@uuid>` tokens, so
      -- this rule does not quietly stop counting when the body format changes.
      select count(*) into mention_count
      from regexp_matches(text_body, '(<@[&!]?[0-9a-fA-F-]{6,}>)|((^|[^[:alnum:]_])@[[:alnum:]_-]+)', 'g');
      if mention_count > rule.mention_limit then
        return query select rule.id, rule.name, rule.action_block, rule.timeout_seconds, rule.alert_channel_id;
        return;
      end if;

    elsif rule.kind = 'link_filter' then
      offending := false;
      for host in
        select lower(link[1])
        from regexp_matches(text_body, '(?:https?://|www\.)([[:alnum:]._-]+)', 'g') as link
      loop
        host := regexp_replace(host, '^www\.', '');
        -- A domain allows itself and its subdomains, so `youtube.com` covers
        -- `m.youtube.com` without a second entry.
        if not exists (
          select 1 from unnest(coalesce(rule.allowed_domains, array[]::text[])) as allowed(domain)
          where host = lower(btrim(allowed.domain))
             or host like '%.' || lower(btrim(allowed.domain))
        ) then
          offending := true;
          exit;
        end if;
      end loop;
      if offending then
        return query select rule.id, rule.name, rule.action_block, rule.timeout_seconds, rule.alert_channel_id;
        return;
      end if;

    elsif rule.kind = 'duplicate_spam' then
      select count(*) into duplicates
      from public.posts
      where posts.author_id = author
        and not posts.is_deleted
        and posts.created_at > now() - make_interval(secs => rule.duplicate_window_seconds)
        and lower(btrim(coalesce(posts.body, ''))) = lower(btrim(text_body));
      -- The message being checked is not in `posts` yet, so it is the +1.
      if duplicates + 1 >= rule.duplicate_count then
        return query select rule.id, rule.name, rule.action_block, rule.timeout_seconds, rule.alert_channel_id;
        return;
      end if;
    end if;
  end loop;

  return;
end;
$$;

-- Match, then record: an alert row always, a timeout case when the rule asks
-- for one, and a notification to everyone who can act on it.
--
-- Returns whether the message should be stopped, so phase 8's
-- `community_send_message` can call this once, before its insert, and have the
-- alert survive the block. Until then only the non-blocking half runs, from
-- the AFTER INSERT trigger below.
create or replace function private.automod_evaluate(author uuid, channel uuid, body text, post uuid default null)
returns table (blocked boolean, reason text, matched_rule uuid)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  hit record;
  case_id uuid;
begin
  select * into hit from private.automod_match(author, channel, body) limit 1;
  if hit.rule_id is null then
    return query select false, null::text, null::uuid;
    return;
  end if;

  insert into public.community_automod_alerts (rule_id, rule_name, subject_id, channel_id, post_id, blocked, body_excerpt)
  values (hit.rule_id, hit.rule_name, author, channel, post, hit.action_block, left(coalesce(body, ''), 2000));

  if hit.timeout_seconds is not null then
    insert into public.community_mod_cases
      (subject_id, actor_id, kind, reason, duration_seconds, expires_at, source, automod_rule_id, channel_id, post_id)
    values (
      author, null, 'timeout',
      'AutoMod rule "' || hit.rule_name || '"',
      hit.timeout_seconds,
      now() + make_interval(secs => hit.timeout_seconds),
      'automod', hit.rule_id, channel, post
    )
    returning id into case_id;
  end if;

  insert into public.community_moderation_events (post_id, channel_id, actor_id, action, reason)
  values (post, channel, null, 'automod_block',
          'AutoMod rule "' || hit.rule_name || '"' ||
          case when hit.action_block then ' blocked a message' else ' flagged a message' end);

  -- Everyone who could act on this hears about it. `community_permissions`
  -- resolves role grants the same way every policy does, so this cannot drift
  -- from who the Members section says can moderate.
  insert into public.notifications (user_id, type, title, body, action_url)
  select profile.id,
         'community_automod_alert',
         'AutoMod ' || case when hit.action_block then 'blocked' else 'flagged' end || ' a message',
         'Rule "' || hit.rule_name || '"' || case when case_id is not null then ' and issued a timeout.' else '.' end,
         '/creator/settings?section=automod'
  from public.profiles profile
  where not profile.is_suspended
    and profile.id <> author
    and 'moderate_members' = any (public.community_permissions(profile.id));

  return query select hit.action_block, 'That message was stopped by AutoMod.'::text, hit.rule_id;
end;
$$;

-- ------------------------------------------------------- posting enforcement

-- Replaces the blocked-word block with an AutoMod lookup. Everything else in
-- this function is carried over verbatim from 20260912020000 so the rollback
-- can restore it by name.
--
-- Block only: this runs BEFORE INSERT, and the raise it performs would discard
-- anything it had written.
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

-- The recording half, after the row exists so the alert can reference it. A
-- post that reaches here already passed the block check above.
create or replace function private.automod_record_post()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform private.automod_evaluate(new.author_id, new.channel_id, new.body, new.id);
  return new;
end;
$$;

drop trigger if exists posts_automod_record on public.posts;
create trigger posts_automod_record
after insert on public.posts
for each row execute function private.automod_record_post();

-- ----------------------------------------------------------------- the RPCs

-- One writer for the whole rule. A jsonb argument parsed into scalar columns
-- with per-field validation, rather than fourteen positional parameters that
-- change shape every time a kind is added.
create or replace function public.community_automod_rule_save(rule jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  target_id uuid;
  rule_kind text;
  rule_name text;
  existing_count integer;
begin
  if actor is null or not public.community_has('manage_community') then
    raise exception 'You do not have permission to change AutoMod.' using errcode = '42501';
  end if;

  target_id := nullif(rule->>'id', '')::uuid;
  rule_kind := rule->>'kind';
  rule_name := btrim(coalesce(rule->>'name', ''));

  if rule_kind is null or rule_kind not in ('keyword', 'preset', 'mention_spam', 'link_filter', 'duplicate_spam') then
    raise exception 'That is not an AutoMod rule kind.';
  end if;
  if char_length(rule_name) < 2 or char_length(rule_name) > 60 then
    raise exception 'A rule name must be between 2 and 60 characters.';
  end if;

  if target_id is null then
    select count(*) into existing_count from public.community_automod_rules;
    if existing_count >= 25 then
      raise exception 'This community already has the maximum of 25 AutoMod rules.';
    end if;
  end if;

  insert into public.community_automod_rules as target (
    id, name, kind, enabled,
    keywords, match_mode, preset_key, mention_limit, allowed_domains,
    duplicate_count, duplicate_window_seconds,
    action_block, alert_channel_id, timeout_seconds, created_by
  )
  values (
    coalesce(target_id, gen_random_uuid()),
    rule_name,
    rule_kind,
    coalesce((rule->>'enabled')::boolean, true),
    case when rule_kind = 'keyword' then (
      select array_agg(btrim(entry))
      from jsonb_array_elements_text(coalesce(rule->'keywords', '[]'::jsonb)) as entry
      where btrim(entry) <> ''
    ) end,
    case when rule_kind in ('keyword', 'preset') then coalesce(rule->>'matchMode', 'word') end,
    case when rule_kind = 'preset' then rule->>'presetKey' end,
    case when rule_kind = 'mention_spam' then (rule->>'mentionLimit')::integer end,
    case when rule_kind = 'link_filter' then coalesce((
      select array_agg(lower(btrim(entry)))
      from jsonb_array_elements_text(coalesce(rule->'allowedDomains', '[]'::jsonb)) as entry
      where btrim(entry) <> ''
    ), array[]::text[]) end,
    case when rule_kind = 'duplicate_spam' then (rule->>'duplicateCount')::integer end,
    case when rule_kind = 'duplicate_spam' then (rule->>'duplicateWindowSeconds')::integer end,
    coalesce((rule->>'actionBlock')::boolean, true),
    nullif(rule->>'alertChannelId', '')::uuid,
    nullif(rule->>'timeoutSeconds', '')::integer,
    actor
  )
  on conflict (id) do update
  set name = excluded.name,
      kind = excluded.kind,
      enabled = excluded.enabled,
      keywords = excluded.keywords,
      match_mode = excluded.match_mode,
      preset_key = excluded.preset_key,
      mention_limit = excluded.mention_limit,
      allowed_domains = excluded.allowed_domains,
      duplicate_count = excluded.duplicate_count,
      duplicate_window_seconds = excluded.duplicate_window_seconds,
      action_block = excluded.action_block,
      alert_channel_id = excluded.alert_channel_id,
      timeout_seconds = excluded.timeout_seconds
  returning target.id into target_id;

  return target_id;
end;
$$;

create or replace function public.community_automod_rule_delete(rule_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if (select auth.uid()) is null or not public.community_has('manage_community') then
    raise exception 'You do not have permission to change AutoMod.' using errcode = '42501';
  end if;
  delete from public.community_automod_rules where id = community_automod_rule_delete.rule_id;
end;
$$;

create or replace function public.community_automod_rule_toggle(rule_id uuid, enabled boolean)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if (select auth.uid()) is null or not public.community_has('manage_community') then
    raise exception 'You do not have permission to change AutoMod.' using errcode = '42501';
  end if;
  update public.community_automod_rules
  set enabled = community_automod_rule_toggle.enabled
  where id = community_automod_rule_toggle.rule_id;
end;
$$;

-- The whole exemption set for a rule in one call, because Next 16 dispatches
-- server actions sequentially and a checkbox-at-a-time version would queue.
create or replace function public.community_automod_exemption_set(
  rule_id uuid,
  role_ids uuid[] default array[]::uuid[],
  channel_ids uuid[] default array[]::uuid[]
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if (select auth.uid()) is null or not public.community_has('manage_community') then
    raise exception 'You do not have permission to change AutoMod.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.community_automod_rules
    where id = community_automod_exemption_set.rule_id
  ) then
    raise exception 'That AutoMod rule no longer exists.';
  end if;

  delete from public.community_automod_exemptions exemption
  where exemption.rule_id = community_automod_exemption_set.rule_id;

  insert into public.community_automod_exemptions (rule_id, role_id)
  select community_automod_exemption_set.rule_id, entry
  from unnest(coalesce(role_ids, array[]::uuid[])) as entry
  on conflict do nothing;

  insert into public.community_automod_exemptions (rule_id, channel_id)
  select community_automod_exemption_set.rule_id, entry
  from unnest(coalesce(channel_ids, array[]::uuid[])) as entry
  on conflict do nothing;
end;
$$;

-- The "test a sentence" box. Reads the compiled patterns directly rather than
-- calling `automod_match`, because the caller is almost always the influencer
-- — who is exempt from every rule, so a tester routed through the real
-- evaluator would answer "no match" to everything and teach the operator that
-- their rules do not work.
create or replace function public.community_automod_test(body text)
returns table (rule_id uuid, rule_name text, would_block boolean)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  rule public.community_automod_rules%rowtype;
begin
  if (select auth.uid()) is null or not public.community_has('manage_community') then
    raise exception 'You do not have permission to read AutoMod.' using errcode = '42501';
  end if;

  for rule in
    select * from public.community_automod_rules
    where enabled and kind in ('keyword', 'preset')
    order by created_at
  loop
    if rule.compiled_pattern is not null and coalesce(body, '') ~* rule.compiled_pattern then
      return query select rule.id, rule.name, rule.action_block;
      return;
    end if;
  end loop;
  return;
end;
$$;

-- --------------------------------------------- convert the blocked word list

do $$
declare
  phrases text[];
  mode text;
  phrase_match text;
begin
  select array_agg(lower(btrim(phrase))) into phrases from public.community_blocked_words;
  if phrases is null or array_length(phrases, 1) is null then
    raise notice 'conversion: no blocked phrases, so no rule was created';
  else
    select blocked_word_mode, blocked_word_match into mode, phrase_match
    from public.community_settings limit 1;

    insert into public.community_automod_rules (name, kind, enabled, keywords, match_mode, action_block)
    values ('Blocked words', 'keyword', true, phrases, coalesce(phrase_match, 'word'), coalesce(mode, 'block') = 'block')
    on conflict do nothing;

    raise notice 'conversion: % phrase(s) moved into the rule "Blocked words"', array_length(phrases, 1);
  end if;
end $$;

drop table if exists public.community_blocked_words;

-- The bound shrinks to what is left on the row: slow mode moved to the channel
-- in phase 3 and the two blocked-word columns are gone above.
alter table public.community_settings drop constraint if exists community_settings_moderation_bounds;
alter table public.community_settings
  drop column if exists blocked_word_mode,
  drop column if exists blocked_word_match;

alter table public.community_settings add constraint community_settings_moderation_bounds check (
  char_length(coalesce(tagline, '')) <= 140
  and char_length(coalesce(welcome_message, '')) <= 2000
  and char_length(coalesce(rules, '')) <= 10000
  and edit_window_minutes between 0 and 10080
);

-- ------------------------------------------------------------------- grants

-- Every table here is written by definer functions only. Supabase's default
-- privileges hand DML to anon and authenticated on any new public table, so
-- these revokes are not redundant with the missing policies.
revoke insert, update, delete, truncate on public.community_automod_rules from anon, authenticated;
revoke insert, update, delete, truncate on public.community_automod_exemptions from anon, authenticated;
revoke insert, update, delete, truncate on public.community_automod_alerts from anon, authenticated;
revoke insert, update, delete, truncate on public.community_automod_presets from anon, authenticated;

grant select on public.community_automod_rules, public.community_automod_exemptions,
                public.community_automod_alerts, public.community_automod_presets to authenticated;
grant all on public.community_automod_rules, public.community_automod_exemptions,
             public.community_automod_alerts, public.community_automod_presets to service_role;

-- `from public, anon` in one statement: revoking PUBLIC does not remove the
-- grant Supabase's ALTER DEFAULT PRIVILEGES hands directly to anon.
revoke execute on function private.automod_assert_keywords(text[]) from public, anon, authenticated;
revoke execute on function private.automod_rule_compile() from public, anon, authenticated;
revoke execute on function private.automod_preset_recompile() from public, anon, authenticated;
revoke execute on function private.automod_match(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function private.automod_evaluate(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function private.automod_record_post() from public, anon, authenticated;
revoke execute on function private.assert_post_content_allowed() from public, anon, authenticated;

revoke execute on function public.community_compile_keyword_pattern(text[], text) from public, anon;
revoke execute on function public.community_automod_rule_save(jsonb) from public, anon;
revoke execute on function public.community_automod_rule_delete(uuid) from public, anon;
revoke execute on function public.community_automod_rule_toggle(uuid, boolean) from public, anon;
revoke execute on function public.community_automod_exemption_set(uuid, uuid[], uuid[]) from public, anon;
revoke execute on function public.community_automod_test(text) from public, anon;

grant execute on function public.community_compile_keyword_pattern(text[], text) to authenticated, service_role;
grant execute on function public.community_automod_rule_save(jsonb) to authenticated, service_role;
grant execute on function public.community_automod_rule_delete(uuid) to authenticated, service_role;
grant execute on function public.community_automod_rule_toggle(uuid, boolean) to authenticated, service_role;
grant execute on function public.community_automod_exemption_set(uuid, uuid[], uuid[]) to authenticated, service_role;
grant execute on function public.community_automod_test(text) to authenticated, service_role;

-- PostgREST caches the schema; without this the API keeps answering "column
-- does not exist" for everything above. See Cross-Project Lessons 40.
notify pgrst, 'reload schema';
