-- Rollback for 20260912000000_community_global_composer_constants.
--
-- Restores the six per-community composer columns at their migration defaults
-- (their live values were exactly those defaults when this was applied), the
-- composer bounds CHECK, the `community_composer_rules()` RPC, the reaction
-- policy and content trigger as 20260911010000 / 20260911030000 defined them,
-- and the bucket's 20 MB / six-type limits. Reactions placed as custom emoji
-- tokens or as emoji outside the twelve, if any exist by then, will simply be
-- unrepeatable — the USING clause never referenced the set, so they still
-- display and can still be removed.

alter table public.community_settings
  add column if not exists reaction_emojis text[] not null
    default array['👍','❤️','🔥','💡','👏','🎉','🚀','👀','😮','😢','💯','🙏'],
  add column if not exists max_body_length integer not null default 10000,
  add column if not exists allow_links boolean not null default true,
  add column if not exists allow_attachments boolean not null default true,
  add column if not exists max_attachment_bytes integer not null default 20971520,
  add column if not exists allowed_attachment_types text[] not null
    default array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'community_settings_composer_bounds') then
    alter table public.community_settings add constraint community_settings_composer_bounds check (
      cardinality(reaction_emojis) between 1 and 24
      and array_position(reaction_emojis, '') is null
      and max_body_length between 200 and 10000
      and max_attachment_bytes between 1024 and 20971520
      and cardinality(allowed_attachment_types) between 1 and 12
    );
  end if;
end $$;

create or replace function public.community_composer_rules()
returns table (
  reaction_emojis text[],
  max_body_length integer,
  allow_links boolean,
  allow_attachments boolean,
  max_attachment_bytes integer,
  allowed_attachment_types text[]
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  select c.reaction_emojis, c.max_body_length, c.allow_links, c.allow_attachments,
         c.max_attachment_bytes, c.allowed_attachment_types
  from public.community_settings c limit 1;
$$;

revoke execute on function public.community_composer_rules() from public;
revoke execute on function public.community_composer_rules() from anon;
grant execute on function public.community_composer_rules() to authenticated;

update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']::text[]
where id = 'community-posts';

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
    and exists (
      select 1 from public.community_settings cs where reactions.emoji = any (cs.reaction_emojis)
    )
  );

drop function if exists public.community_reaction_token_is_valid(text);

-- Verbatim from 20260911030000.
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
