-- Rollback for phase 9's legacy cleanup.
--
-- This restores the shapes, and as much of the data as still exists.
--
-- What comes back exactly: the two compat views, the four channel and category
-- columns with their original defaults (every live row held the default, so
-- nothing is approximated), `posts.image_url` repopulated from the first
-- attachment of any post that has one, the directory's `min_tier` column, and
-- the two trigger definitions that named `image_url`.
--
-- What does not: `image_url` is refilled from `post_attachments`, so a post
-- that gained attachments after the forward migration ran will come back
-- pointing at its first attachment rather than at whatever the legacy composer
-- had written. On this database that is one row and the two values were
-- identical, so the distinction is theoretical here and would not be on a
-- database with more history.

begin;

-- --------------------------------------------------- channel tier and roles
alter table public.channels
  add column if not exists min_tier integer not null default 1,
  add column if not exists allowed_roles text[] not null default array['member','moderator','influencer']::text[];

alter table public.channel_categories
  add column if not exists default_min_tier integer not null default 1,
  add column if not exists default_allowed_roles text[] not null default array['member','moderator','influencer']::text[];

drop function if exists public.community_channel_directory();

create function public.community_channel_directory()
returns table(
  category_id uuid, category_name text, category_description text, category_sort_order integer,
  channel_id uuid, channel_name text, channel_type text, channel_description text,
  channel_sort_order integer, min_tier integer, is_locked boolean, can_send boolean,
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
           channel.min_tier as ch_min_tier,
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
         ch_sort_order, ch_min_tier,
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

revoke execute on function public.community_channel_directory() from public;
revoke execute on function public.community_channel_directory() from anon;
grant execute on function public.community_channel_directory() to authenticated;

-- ---------------------------------------------------------- posts.image_url
alter table public.posts add column if not exists image_url text;

update public.posts post
   set image_url = attachment.path
  from (
    select distinct on (post_id) post_id, path
    from public.post_attachments
    order by post_id, position
  ) attachment
 where attachment.post_id = post.id
   and post.image_url is null;

drop trigger if exists posts_assert_content on public.posts;
drop trigger if exists posts_has_content on public.posts;

create trigger posts_assert_content
  before insert or update of body, image_url on public.posts
  for each row execute function private.assert_post_content_allowed();

create constraint trigger posts_has_content
  after insert or update of body, image_url, video_file_id, forwarded_from_post_id, is_deleted
  on public.posts
  deferrable initially deferred
  for each row execute function private.assert_post_has_content();

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
     or new.image_url is not null
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
  or new.image_url     is distinct from old.image_url
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

-- `create or replace` keeps whatever grants a function already had, so on this
-- database these are already revoked. On a clean replay they would not be: a
-- freshly created function carries EXECUTE for PUBLIC. Phase 2 found fourteen
-- definers reachable by `anon` exactly this way, so the migration states it
-- rather than relying on the database it happens to be run against.
revoke execute on function public.guard_post_update() from public;
revoke execute on function private.assert_post_has_content() from public;

drop policy if exists community_posts_visible_read on storage.objects;
create policy community_posts_visible_read on storage.objects
for select to authenticated
using (
  bucket_id = 'community-posts'
  and (
    exists (
      select 1 from public.posts post
      where post.image_url = storage.objects.name
        and not post.is_deleted
        and public.can_view_channel(post.channel_id)
    )
    or exists (
      select 1
      from public.post_attachments attachment
      join public.posts post on post.id = attachment.post_id
      where attachment.path = storage.objects.name
        and not post.is_deleted
        and public.can_view_channel(post.channel_id)
    )
  )
);

-- ---------------------------------------------------------------- roles
create view public.cosmetic_roles with (security_invoker = true) as
  select id, name, color, "position" as priority, created_by, created_at, updated_at
  from public.community_roles;

create view public.cosmetic_role_assignments with (security_invoker = true) as
  select role_id, user_id, assigned_by, assigned_at
  from public.community_role_members;

commit;
