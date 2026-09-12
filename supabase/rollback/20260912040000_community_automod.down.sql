-- Rollback for 20260912040000_community_automod.sql.
--
-- Restores `community_blocked_words`, the two `community_settings` columns and
-- the moderation bounds CHECK as 20260911030000 created them, and rewrites
-- `private.assert_post_content_allowed` to the body 20260912020000 left behind
-- — verbatim, because that is the version this phase replaced.
--
-- **This loses data.** Every AutoMod rule, exemption and alert is dropped, and
-- so is every `automod_rule_id` recorded on a moderation case. Rules whose
-- kind is not `keyword` have no representation in the flat phrase list and
-- cannot be converted back at all; a keyword rule's phrases are restored, but
-- its per-rule action and exemptions collapse into the two community-wide
-- settings columns. Run this only to undo a failed apply.

-- ------------------------------------------------- restore the blocked words

create table if not exists public.community_blocked_words (
  id uuid primary key default gen_random_uuid(),
  phrase text not null check (char_length(btrim(phrase)) between 2 and 60),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists community_blocked_words_phrase_idx
  on public.community_blocked_words (lower(btrim(phrase)));

comment on table public.community_blocked_words is
  'Phrases the community does not allow in a message body.';

alter table public.community_blocked_words enable row level security;

drop policy if exists community_blocked_words_staff_read on public.community_blocked_words;
create policy community_blocked_words_staff_read
  on public.community_blocked_words
  for select
  to authenticated
  using (public.community_has('manage_community'));

drop policy if exists community_blocked_words_influencer_write on public.community_blocked_words;
create policy community_blocked_words_influencer_write
  on public.community_blocked_words
  for all
  to authenticated
  using (public.is_influencer() or public.is_super_admin())
  with check (public.is_influencer() or public.is_super_admin());

alter table public.community_settings
  add column if not exists blocked_word_mode text not null default 'block',
  add column if not exists blocked_word_match text not null default 'word';

-- Carry the keyword rules back into the flat list before the tables go. The
-- first enabled keyword rule decides the two community-wide settings, because
-- the old shape could not express more than one answer.
do $$
declare
  source record;
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'community_automod_rules'
  ) then
    insert into public.community_blocked_words (phrase)
    select distinct lower(btrim(keyword))
    from public.community_automod_rules rule,
         lateral unnest(rule.keywords) as keyword
    where rule.kind = 'keyword' and rule.keywords is not null
    on conflict do nothing;

    select match_mode, action_block into source
    from public.community_automod_rules
    where kind = 'keyword' and enabled
    order by created_at
    limit 1;

    if found then
      update public.community_settings
      set blocked_word_match = coalesce(source.match_mode, 'word'),
          blocked_word_mode = case when source.action_block then 'block' else 'flag' end;
    end if;
  end if;
end $$;

-- ------------------------------------------- restore the pre-AutoMod trigger

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
  matched text;
  channel_slow_mode integer;
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

-- ------------------------------------------------------------ drop the phase

drop trigger if exists posts_automod_record on public.posts;
drop index if exists public.posts_author_recent_idx;

drop function if exists private.automod_record_post();
drop function if exists private.automod_evaluate(uuid, uuid, text, uuid);
drop function if exists private.automod_match(uuid, uuid, text);
drop function if exists public.community_automod_test(text);
drop function if exists public.community_automod_exemption_set(uuid, uuid[], uuid[]);
drop function if exists public.community_automod_rule_toggle(uuid, boolean);
drop function if exists public.community_automod_rule_delete(uuid);
drop function if exists public.community_automod_rule_save(jsonb);

alter table public.community_mod_cases drop column if exists automod_rule_id;

drop table if exists public.community_automod_alerts;
drop table if exists public.community_automod_exemptions;
drop table if exists public.community_automod_rules;
drop table if exists public.community_automod_presets;

drop function if exists private.automod_preset_recompile();
drop function if exists private.automod_rule_compile();
drop function if exists private.automod_assert_keywords(text[]);
drop function if exists public.community_compile_keyword_pattern(text[], text);

-- ---------------------------------------------------- restore the old bounds

alter table public.community_settings drop constraint if exists community_settings_moderation_bounds;
alter table public.community_settings add constraint community_settings_moderation_bounds check (
  char_length(coalesce(tagline, '')) <= 140
  and char_length(coalesce(welcome_message, '')) <= 2000
  and char_length(coalesce(rules, '')) <= 10000
  and edit_window_minutes between 0 and 10080
  and blocked_word_mode in ('block', 'flag')
  and blocked_word_match in ('word', 'substring')
);

notify pgrst, 'reload schema';
