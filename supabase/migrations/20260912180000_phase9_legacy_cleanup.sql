-- Phase 9: the legacy cleanup.
--
-- Everything here is a thing that stopped being read before it stopped
-- existing, and each one survived because something still pointed at it.
--
--   * `cosmetic_roles` / `cosmetic_role_assignments` — compat views created in
--     phase 2 so the member workspace and creator member list kept working
--     while roles moved to `community_roles`. Both callers read the real
--     tables now.
--
--   * `posts.image_url` — the legacy composer's single attachment. Phase 8
--     replaced it with `post_attachments`, but the legacy message list still
--     read the column, so it could not go. That surface was deleted in this
--     phase's first commit.
--
--   * `channels.min_tier` / `allowed_roles` and the matching category
--     defaults — access moved to per-channel role and member overrides in
--     phase 3. From that point these columns were written by the creator form
--     and read by nothing that enforced anything, which is worse than absent:
--     the settings page showed a working control for a rule that did not
--     exist. `visibility_mode` is deliberately kept — it decides locked-and-
--     listed versus not listed, which is a real and separate question.
--
-- Data checked before writing this, on the live database:
--   * one post carries `image_url`, and its value is byte-identical to that
--     post's `post_attachments.path`. Dropping the column loses nothing.
--   * both channels hold `min_tier = 1` and the full `allowed_roles` list, so
--     every value being dropped is already the default.

begin;

-- ---------------------------------------------------------------- roles
-- Plain passthrough views. `cosmetic_roles` was `community_roles` with
-- `position` aliased to `priority`; the assignment view was a straight column
-- subset of `community_role_members`.
drop view if exists public.cosmetic_role_assignments;
drop view if exists public.cosmetic_roles;

-- ---------------------------------------------------------- posts.image_url
-- The storage read policy allowed an object if a visible post pointed at it
-- through either `image_url` or `post_attachments`. Only the second branch is
-- reachable now, and the first would not compile once the column is gone.
drop policy if exists community_posts_visible_read on storage.objects;
create policy community_posts_visible_read on storage.objects
for select to authenticated
using (
  bucket_id = 'community-posts'
  and exists (
    select 1
    from public.post_attachments attachment
    join public.posts post on post.id = attachment.post_id
    where attachment.path = storage.objects.name
      and not post.is_deleted
      and public.can_view_channel(post.channel_id)
  )
);

-- An edit is still an edit when it changes the body, the video or a forward.
-- Dropping `image_url` from the comparison is the whole change here.
create or replace function public.guard_post_update()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    return new;
  end if;

  if new.body          is distinct from old.body
  or new.video_file_id is distinct from old.video_file_id then
    if old.author_id is distinct from actor then
      raise exception 'Only the author can edit this message';
    end if;
    insert into public.community_moderation_events
      (post_id, channel_id, actor_id, subject_id, action, previous_body)
    values (old.id, old.channel_id, actor, old.author_id, 'edit', old.body);
  end if;

  if new.is_pinned is distinct from old.is_pinned then
    if not public.community_has('pin_messages', old.channel_id) then
      raise exception 'You do not have permission to pin messages here.';
    end if;
    insert into public.community_moderation_events
      (post_id, channel_id, actor_id, subject_id, action)
    values (old.id, old.channel_id, actor, old.author_id,
            case when new.is_pinned then 'pin' else 'unpin' end);
  end if;

  if new.is_deleted and not old.is_deleted then
    if old.author_id is distinct from actor
       and not public.community_has('manage_messages', old.channel_id) then
      raise exception 'You do not have permission to delete this message.';
    end if;
    insert into public.community_moderation_events
      (post_id, channel_id, actor_id, subject_id, action, reason, previous_body)
    values (old.id, old.channel_id, actor, old.author_id, 'delete',
            nullif(btrim(coalesce(current_setting('app.moderation_reason', true), '')), ''),
            old.body);
  end if;

  return new;
end;
$function$;

-- "A message needs something in it." An attachment row is what an image is
-- now, and the deferred check below is the only shape that can ask after the
-- attachments have been written.
create or replace function private.assert_post_has_content()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.is_deleted then
    return null;
  end if;

  if new.body is not null
     or new.video_file_id is not null
     or new.forwarded_from_post_id is not null then
    return null;
  end if;

  if exists (select 1 from public.post_attachments where post_id = new.id) then
    return null;
  end if;

  raise exception 'A message needs something in it.';
end;
$function$;

-- `create or replace` keeps whatever grants a function already had, so on this
-- database these are already revoked. On a clean replay they would not be: a
-- freshly created function carries EXECUTE for PUBLIC. Phase 2 found fourteen
-- definers reachable by `anon` exactly this way, so the migration states it
-- rather than relying on the database it happens to be run against.
revoke execute on function public.guard_post_update() from public;
revoke execute on function private.assert_post_has_content() from public;

-- Both triggers name `image_url` in their UPDATE OF list, so the column cannot
-- be dropped while they stand. Dropped and recreated rather than CASCADEd -
-- CASCADE would take the triggers away and leave nothing asserting content.
drop trigger if exists posts_assert_content on public.posts;
drop trigger if exists posts_has_content on public.posts;

alter table public.posts drop column if exists image_url;

create trigger posts_assert_content
  before insert or update of body on public.posts
  for each row execute function private.assert_post_content_allowed();

create constraint trigger posts_has_content
  after insert or update of body, video_file_id, forwarded_from_post_id, is_deleted
  on public.posts
  deferrable initially deferred
  for each row execute function private.assert_post_has_content();

-- ------------------------------------------------- channel tier and roles
-- `min_tier` leaves the directory's signature, so this is a drop and create
-- rather than a replace. Nothing read the column from it: the one caller that
-- did — the dashboard search route — reads `unlock_tier`, which is derived
-- from the overrides and is what the locked-channel hint should always have
-- been describing.
drop function if exists public.community_channel_directory();

create function public.community_channel_directory()
returns table(
  category_id uuid, category_name text, category_description text, category_sort_order integer,
  channel_id uuid, channel_name text, channel_type text, channel_description text,
  channel_sort_order integer, is_locked boolean, can_send boolean,
  slow_mode_seconds integer, permissions_synced boolean, unlock_tier integer,
  has_unread boolean, mention_count integer
)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
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
         ch_sort_order,
         not ('view_channel' = any(perms)),
         'send_messages' = any(perms),
         ch_slow_mode, ch_synced, ch_unlock_tier,
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
$function$;

-- Phase 2 revoked PUBLIC on every new function and found fourteen still
-- callable by `anon`. A recreated function comes back with the default grant,
-- so it is taken away again here.
revoke execute on function public.community_channel_directory() from public;
revoke execute on function public.community_channel_directory() from anon;
grant execute on function public.community_channel_directory() to authenticated;

alter table public.channels
  drop column if exists min_tier,
  drop column if exists allowed_roles;

alter table public.channel_categories
  drop column if exists default_min_tier,
  drop column if exists default_allowed_roles;

commit;
