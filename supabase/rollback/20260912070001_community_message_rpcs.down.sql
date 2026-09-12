-- Rollback for 20260912070001_community_message_rpcs.sql.
--
-- Drops the eleven RPCs the /channels page reads and writes through, and puts
-- `private.automod_record_post` and `public.community_channel_directory` back
-- to the bodies phase 5 and phase 3 left.
--
-- No data is lost by this file itself: it drops functions only. Messages sent
-- through `community_send_message` stay exactly where they are, and the legacy
-- composer's direct-insert path is untouched. Run
-- 20260912070000_community_messages.down.sql after this one to undo the schema.

drop function if exists public.community_send_message(uuid, text, uuid, uuid, jsonb, text);
drop function if exists public.community_channel_messages(uuid, timestamptz, uuid, integer, uuid);
drop function if exists public.community_channel_pins(uuid);
drop function if exists public.community_thread_create(uuid, text);
drop function if exists public.community_thread_set(uuid, boolean, boolean);
drop function if exists public.community_mark_read(uuid, uuid);
drop function if exists public.community_set_channel_notification(uuid, text, timestamptz);
drop function if exists public.community_search_messages(text, uuid, timestamptz, integer);
drop function if exists public.community_member_profile(uuid);
drop function if exists public.community_member_directory();
drop function if exists public.community_viewer_state();

-- Phase 5's body: evaluate every insert, with no "already done" guard, because
-- without `community_send_message` nothing evaluates ahead of an insert.
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

revoke execute on function private.automod_record_post() from public, anon, authenticated;

-- Phase 3's body: `has_unread` and `mention_count` hard-coded, because
-- `channel_read_states` is dropped by the schema rollback that follows.
create or replace function public.community_channel_directory()
returns table (
  category_id uuid, category_name text, category_description text, category_sort_order integer,
  channel_id uuid, channel_name text, channel_type text, channel_description text,
  channel_sort_order integer, min_tier integer, is_locked boolean, can_send boolean,
  slow_mode_seconds integer, permissions_synced boolean, unlock_tier integer,
  has_unread boolean, mention_count integer
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
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
           ) as ch_unlock_tier
    from public.channel_categories category
    join public.channels channel on channel.category_id = category.id
    where not category.is_archived and not channel.is_archived and channel.is_active
  )
  select cat_id, cat_name, cat_description, cat_sort_order,
         ch_id, ch_name, ch_type,
         case when 'view_channel' = any(perms) then ch_description else null end,
         ch_sort_order, ch_min_tier,
         not ('view_channel' = any(perms)),
         'send_messages' = any(perms),
         ch_slow_mode, ch_synced, ch_unlock_tier,
         false,
         0
  from visible
  where 'view_channel' = any(perms)
     or (ch_visibility = 'locked' and ch_unlock_tier is not null)
  order by cat_sort_order, ch_sort_order;
$$;

notify pgrst, 'reload schema';
