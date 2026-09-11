-- Undo for 20260911030000_community_moderation_engine.
--
-- Dropping community_blocked_words destroys the phrase list; nothing else holds
-- it. The audit rows written in 'flag' mode are NOT removed — they are part of
-- the record, and the action check is narrowed only after they are gone.

drop trigger if exists posts_assert_content on public.posts;
drop function if exists private.assert_post_content_allowed();

alter table public.posts drop constraint if exists posts_body_length_check;

drop policy if exists community_blocked_words_influencer_write on public.community_blocked_words;
drop policy if exists community_blocked_words_staff_read on public.community_blocked_words;
drop table if exists public.community_blocked_words;

-- Narrowing the vocabulary fails while any 'flag' row survives, which is the
-- intended protection: delete those rows deliberately, never as a side effect.
do $$
begin
  if not exists (select 1 from public.community_moderation_events where action = 'flag') then
    alter table public.community_moderation_events drop constraint if exists community_moderation_events_action_check;
    alter table public.community_moderation_events
      add constraint community_moderation_events_action_check
      check (action in ('edit', 'delete', 'pin', 'unpin'));
  else
    raise notice 'Kept the flag action: % audit row(s) still use it.',
      (select count(*) from public.community_moderation_events where action = 'flag');
  end if;
end $$;

alter table public.community_settings drop constraint if exists community_settings_moderation_bounds;

alter table public.community_settings
  drop column if exists slow_mode_seconds,
  drop column if exists edit_window_minutes,
  drop column if exists delete_requires_reason,
  drop column if exists blocked_word_mode,
  drop column if exists blocked_word_match;
