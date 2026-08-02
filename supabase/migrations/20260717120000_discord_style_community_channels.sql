-- Categories organize channels. Access defaults are copied into new channels so
-- changing a category later never silently changes an existing channel's policy.
create table public.channel_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text,
  sort_order integer not null default 0 check (sort_order >= 0),
  default_min_tier integer not null default 1 check (default_min_tier between 1 and 5),
  default_allowed_roles text[] not null default array['member','moderator','influencer']::text[] check (default_allowed_roles <@ array['member','moderator','influencer']::text[] and cardinality(default_allowed_roles) > 0),
  default_visibility_mode text not null default 'locked' check (default_visibility_mode in ('locked','hidden')),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

alter table public.channels add column if not exists category_id uuid references public.channel_categories(id) on delete restrict;
alter table public.channels add column if not exists allowed_roles text[] not null default array['member','moderator','influencer']::text[];
alter table public.channels add column if not exists visibility_mode text not null default 'locked';
alter table public.channels add column if not exists is_archived boolean not null default false;
alter table public.channels add constraint channels_allowed_roles_check check (allowed_roles <@ array['member','moderator','influencer']::text[] and cardinality(allowed_roles) > 0);
alter table public.channels add constraint channels_visibility_mode_check check (visibility_mode in ('locked','hidden'));

insert into public.channel_categories (name, sort_order)
select 'Community', 0
where not exists (select 1 from public.channel_categories where name = 'Community');

update public.channels channel
set category_id = category.id,
    allowed_roles = array['member','moderator','influencer']::text[],
    visibility_mode = 'locked',
    is_archived = not channel.is_active
from public.channel_categories category
where category.name = 'Community'
  and channel.category_id is null;

alter table public.channels alter column category_id set not null;
create index channel_categories_order_idx on public.channel_categories(sort_order) where not is_archived;
create index channels_category_order_idx on public.channels(category_id, sort_order) where not is_archived;

create trigger channel_categories_set_updated_at before update on public.channel_categories for each row execute function public.set_updated_at();
alter table public.channel_categories enable row level security;

-- Tier and role are independent access paths. Staff can only enter channels
-- their role has been allowed to view; super admins retain platform access.
create or replace function public.can_view_channel(target_channel_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.channels channel
    join public.channel_categories category on category.id = channel.category_id
    left join public.profiles profile on profile.id = (select auth.uid())
    left join public.member_tiers tier on tier.user_id = profile.id
    where channel.id = target_channel_id
      and not channel.is_archived and channel.is_active and not category.is_archived
      and (
        profile.platform_role = 'super_admin'
        or (
          profile.platform_role in ('moderator','influencer')
          and profile.platform_role = any(channel.allowed_roles)
        )
        or (
          profile.platform_role = 'member'
          and 'member' = any(channel.allowed_roles)
          and public.is_active_member()
          and coalesce(case when tier.is_master then 5 else tier.current_tier end, 0) >= channel.min_tier
        )
      )
  );
$$;

-- This directory returns only the safe metadata needed by a sidebar. Hidden
-- channels are omitted, while locked channels disclose only name + threshold.
create or replace function public.community_channel_directory()
returns table (
  category_id uuid, category_name text, category_description text, category_sort_order integer,
  channel_id uuid, channel_name text, channel_type text, channel_description text,
  channel_sort_order integer, min_tier integer, is_locked boolean
)
language sql stable security definer set search_path = public, pg_temp as $$
  select category.id, category.name, category.description, category.sort_order,
    channel.id, channel.name, channel.type,
    case when public.can_view_channel(channel.id) then channel.description else null end,
    channel.sort_order, channel.min_tier, not public.can_view_channel(channel.id)
  from public.channel_categories category
  join public.channels channel on channel.category_id = category.id
  join public.profiles profile on profile.id = (select auth.uid())
  left join public.member_tiers tier on tier.user_id = profile.id
  where not category.is_archived and not channel.is_archived and channel.is_active
    and (
      public.can_view_channel(channel.id)
      or (
        profile.platform_role = 'member'
        and 'member' = any(channel.allowed_roles)
        and channel.visibility_mode = 'locked'
        and public.is_active_member()
        and coalesce(case when tier.is_master then 5 else tier.current_tier end, 0) < channel.min_tier
      )
    )
  order by category.sort_order, channel.sort_order;
$$;

drop policy if exists channels_read on public.channels;
create policy channels_read on public.channels for select to authenticated using (public.is_influencer() or public.is_super_admin() or public.can_view_channel(id));
drop policy if exists channels_influencer_write on public.channels;
create policy channels_influencer_write on public.channels for all to authenticated using (public.is_influencer() or public.is_super_admin()) with check (public.is_influencer() or public.is_super_admin());
create policy channel_categories_read on public.channel_categories for select to authenticated using (public.is_influencer() or public.is_super_admin());
create policy channel_categories_influencer_write on public.channel_categories for all to authenticated using (public.is_influencer() or public.is_super_admin()) with check (public.is_influencer() or public.is_super_admin());

drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select to authenticated using (not is_deleted and public.can_view_channel(channel_id));
drop policy if exists posts_staff_write on public.posts;
drop policy if exists posts_staff_insert on public.posts;
create policy posts_staff_insert on public.posts for insert to authenticated with check (author_id = (select auth.uid()) and public.is_staff() and public.can_view_channel(channel_id));
drop policy if exists posts_staff_update on public.posts;
create policy posts_staff_update on public.posts for update to authenticated using (public.is_staff() and public.can_view_channel(channel_id)) with check (public.is_staff() and public.can_view_channel(channel_id));

drop policy if exists reactions_read on public.reactions;
create policy reactions_read on public.reactions for select to authenticated using (
  exists (select 1 from public.posts post where post.id = post_id and not post.is_deleted and public.can_view_channel(post.channel_id))
);
drop policy if exists reactions_own_write on public.reactions;
create policy reactions_own_write on public.reactions for all to authenticated using (
  user_id = (select auth.uid())
  and exists (select 1 from public.posts post where post.id = post_id and not post.is_deleted and public.can_view_channel(post.channel_id))
) with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.posts post where post.id = post_id and not post.is_deleted and public.can_view_channel(post.channel_id))
);

revoke all on function public.can_view_channel(uuid), public.community_channel_directory() from public, anon;
grant execute on function public.can_view_channel(uuid), public.community_channel_directory() to authenticated, service_role;
grant select, insert, update, delete on public.channel_categories to authenticated;
