-- Composer and reaction rules, enforced in the database.
--
-- Provably a no-op on the data as it stands, which is the point: verified
-- before applying that no post exceeds 10,000 characters (the longest is 41),
-- that every post is staff-authored, and that every reaction already uses one
-- of the twelve emoji seeded below.
--
-- Scalar columns rather than a jsonb blob. A misspelled jsonb key reads as
-- NULL, `coalesce(..., true)` silently disables the rule, and nothing errors —
-- which is exactly how a setting becomes decorative. A misspelled column is a
-- hard 42703 the first time it runs.

-- ------------------------------------------------------------------- columns

alter table public.community_settings
  add column if not exists reaction_emojis text[] not null
    default array['👍','❤️','🔥','💡','👏','🎉','🚀','👀','😮','😢','💯','🙏'],
  add column if not exists max_body_length integer not null default 10000,
  add column if not exists allow_links boolean not null default true,
  add column if not exists allow_attachments boolean not null default true,
  add column if not exists max_attachment_bytes integer not null default 20971520,
  add column if not exists allowed_attachment_types text[] not null
    default array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'];

-- Since PG11 an ADD COLUMN ... NOT NULL DEFAULT <constant> is catalogue-only,
-- so none of the above rewrites the table and no backfill UPDATE is needed.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'community_settings_composer_bounds') then
    alter table public.community_settings add constraint community_settings_composer_bounds check (
      cardinality(reaction_emojis) between 1 and 24
      and array_position(reaction_emojis, '') is null
      and max_body_length between 200 and 10000
      -- The bucket's own ceiling is 20MB; a larger number here would be a
      -- promise storage refuses to keep.
      and max_attachment_bytes between 1024 and 20971520
      and cardinality(allowed_attachment_types) between 1 and 12
    );
  end if;
end $$;

-- -------------------------------------------------------- hard ceiling on body

-- NOT VALID first, then VALIDATE: the two-step takes a weaker lock than a
-- single ALTER, which would hold ACCESS EXCLUSIVE for a full scan.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'posts_body_length_check') then
    alter table public.posts
      add constraint posts_body_length_check check (char_length(body) <= 10000) not valid;
    alter table public.posts validate constraint posts_body_length_check;
  end if;
end $$;

-- ---------------------------------------------------------- content enforcement

-- In `private`, which `authenticated` has no USAGE on, so the rule cannot be
-- called or inspected through PostgREST.
create or replace function private.assert_post_content_allowed()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  rules public.community_settings%rowtype;
  author_is_staff boolean;
begin
  select * into rules from public.community_settings limit 1;
  if not found then
    return new;  -- settings missing: fall open rather than take the community down
  end if;

  if char_length(coalesce(new.body, '')) > rules.max_body_length then
    raise exception 'Messages are limited to % characters here.', rules.max_body_length;
  end if;

  -- Link and attachment rules are moderation aimed at members. Staff are exempt
  -- so the influencer cannot lock themselves out of their own announcements.
  -- Today every post is staff-authored, so these are inert until per-channel
  -- posting policy ships.
  select exists (
    select 1 from public.profiles
    where id = new.author_id and platform_role in ('moderator','influencer','super_admin')
  ) into author_is_staff;

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

drop trigger if exists posts_assert_content on public.posts;
create trigger posts_assert_content
  before insert or update of body, image_url on public.posts
  for each row execute function private.assert_post_content_allowed();

-- ------------------------------------------------------------------ reactions

-- WITH CHECK carries the emoji predicate; USING deliberately does not. Removing
-- an emoji from the set must be non-destructive: reactions already placed still
-- display and can still be taken back, they just cannot be added again.
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
    -- `= any (subquery)` would be read as the set form and fail on a text[]
    -- column (42883). Matching inside an EXISTS keeps `any` applied to the
    -- array itself.
    and exists (
      select 1 from public.community_settings cs where reactions.emoji = any (cs.reaction_emojis)
    )
  );

-- ------------------------------------------------- composer limits for clients

-- The composer must read its limits rather than hard-code them, or the client
-- rejects what the database allows and vice versa.
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
