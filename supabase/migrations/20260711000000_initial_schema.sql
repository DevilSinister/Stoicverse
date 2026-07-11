-- Ask Stoic initial Supabase schema.
-- Auth users live in auth.users; application data lives in public.

create extension if not exists pgcrypto;

create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  platform_role text not null default 'member' check (platform_role in ('super_admin', 'influencer', 'member')),
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.profiles(id),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  logo_url text,
  cover_url text,
  membership_fee numeric(10,2) not null default 10.00 check (membership_fee >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  role text not null check (role in ('influencer', 'moderator', 'member')),
  assigned_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (user_id, community_id)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'cancelled', 'refunded')),
  stripe_customer_id text,
  stripe_payment_intent text,
  amount_paid numeric(10,2) check (amount_paid is null or amount_paid >= 0),
  joined_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, community_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  community_id uuid references public.communities(id),
  product_type text not null check (product_type in ('membership', 'mentorship')),
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'usd' check (char_length(currency) = 3),
  stripe_payment_intent text not null unique,
  stripe_event_id text not null unique,
  status text not null check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  type text not null default 'text' check (type in ('text', 'announcements', 'events', 'master')),
  description text,
  min_tier integer not null default 0 check (min_tier between 0 and 5),
  visible_to text[] not null default array['member','moderator','influencer']::text[],
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, name)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text,
  image_url text,
  video_file_id text,
  post_type text not null default 'post' check (post_type in ('post', 'announcement', 'event')),
  is_pinned boolean not null default false,
  is_deleted boolean not null default false,
  pinned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (body is not null or image_url is not null or video_file_id is not null)
);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 32),
  created_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null references public.channels(id),
  created_by uuid not null references public.profiles(id),
  title text not null,
  description text,
  zoom_url text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  min_tier integer not null default 0 check (min_tier between 0 and 5),
  status text not null default 'upcoming' check (status in ('upcoming', 'live', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table public.tiers (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  level integer not null check (level between 1 and 4),
  title text not null,
  description text,
  required_lesson_count integer not null default 8 check (required_lesson_count > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, level)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  tier_id uuid not null references public.tiers(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null,
  description text,
  video_file_id text not null,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  completion_threshold numeric(5,2) not null default 85.0 check (completion_threshold between 0 and 100),
  sort_order integer not null default 0,
  release_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  watched_seconds integer not null default 0 check (watched_seconds >= 0),
  completion_percentage numeric(5,2) not null default 0.0 check (completion_percentage between 0 and 100),
  is_completed boolean not null default false,
  first_started_at timestamptz,
  last_watched_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table public.member_tiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  current_tier integer not null default 1 check (current_tier between 1 and 5),
  is_master boolean not null default false,
  tier_unlocked_at timestamptz,
  master_unlocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, community_id),
  check ((is_master and current_tier = 5) or (not is_master and current_tier between 1 and 4))
);

create table public.review_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'under_review', 'accepted', 'rejected', 'scheduled', 'completed', 'approved_for_team')),
  answers jsonb,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  zoom_url text,
  call_scheduled_at timestamptz,
  decision_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  review_application_id uuid references public.review_applications(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  answers jsonb,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mentorships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  stripe_payment_intent text not null unique,
  amount_paid numeric(10,2) not null check (amount_paid >= 0),
  status text not null default 'pending' check (status in ('pending', 'active', 'completed', 'cancelled', 'refunded')),
  assigned_mentor_id uuid references public.profiles(id),
  starts_at timestamptz,
  ends_at timestamptz,
  notes text,
  booking_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('tier_unlocked', 'master_unlocked', 'payment_confirmed', 'new_lesson', 'new_event', 'review_application_update', 'team_application_update', 'mentorship_confirmed', 'mentorship_assigned', 'account_warning')),
  title text not null,
  body text,
  action_url text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  payload jsonb,
  processed boolean not null default false,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index communities_influencer_idx on public.communities (influencer_id);
create index community_roles_user_idx on public.community_roles (user_id);
create index community_roles_community_idx on public.community_roles (community_id);
create index memberships_user_idx on public.memberships (user_id);
create index memberships_community_status_idx on public.memberships (community_id, status);
create index payments_user_idx on public.payments (user_id);
create index payments_community_idx on public.payments (community_id);
create index channels_community_sort_idx on public.channels (community_id, sort_order);
create index posts_channel_created_idx on public.posts (channel_id, created_at desc);
create index posts_community_idx on public.posts (community_id);
create index posts_pinned_idx on public.posts (channel_id, is_pinned) where is_pinned = true;
create index reactions_post_idx on public.reactions (post_id);
create index events_community_starts_idx on public.events (community_id, starts_at);
create index tiers_community_sort_idx on public.tiers (community_id, sort_order);
create index lessons_tier_sort_idx on public.lessons (tier_id, sort_order);
create index lessons_community_status_idx on public.lessons (community_id, status, release_at);
create index lesson_progress_user_idx on public.lesson_progress (user_id, community_id);
create index lesson_progress_lesson_idx on public.lesson_progress (lesson_id);
create index member_tiers_user_idx on public.member_tiers (user_id, community_id);
create index review_applications_community_status_idx on public.review_applications (community_id, status);
create index review_applications_user_idx on public.review_applications (user_id);
create index team_applications_community_status_idx on public.team_applications (community_id, status);
create index mentorships_user_idx on public.mentorships (user_id);
create index mentorships_community_idx on public.mentorships (community_id);
create index notifications_user_read_created_idx on public.notifications (user_id, is_read, created_at desc);
create index stripe_webhook_events_created_idx on public.stripe_webhook_events (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['profiles','communities','memberships','channels','posts','events','tiers','lessons','lesson_progress','member_tiers','review_applications','team_applications','mentorships'] loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end;
$$;

create or replace function public.on_membership_activated()
returns trigger
language plpgsql
security invoker
as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    insert into public.member_tiers (user_id, community_id, current_tier, tier_unlocked_at)
    values (new.user_id, new.community_id, 1, now())
    on conflict (user_id, community_id) do nothing;

    insert into public.community_roles (user_id, community_id, role)
    values (new.user_id, new.community_id, 'member')
    on conflict (user_id, community_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger membership_activated
after insert or update of status on public.memberships
for each row execute function public.on_membership_activated();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'New member'))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security invoker
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and platform_role = 'super_admin' and not is_suspended);
$$;

create or replace function public.is_community_staff(target_community_id uuid)
returns boolean
language sql
stable
security invoker
as $$
  select public.is_super_admin() or exists (
    select 1 from public.community_roles
    where user_id = (select auth.uid()) and community_id = target_community_id and role in ('influencer', 'moderator')
  );
$$;

create or replace function public.is_community_influencer(target_community_id uuid)
returns boolean
language sql
stable
security invoker
as $$
  select public.is_super_admin() or exists (
    select 1 from public.community_roles
    where user_id = (select auth.uid()) and community_id = target_community_id and role = 'influencer'
  );
$$;

create or replace function public.has_community_access(target_community_id uuid, required_tier integer default 0)
returns boolean
language sql
stable
security invoker
as $$
  select public.is_community_staff(target_community_id) or exists (
    select 1
    from public.memberships m
    left join public.member_tiers mt on mt.user_id = m.user_id and mt.community_id = m.community_id
    where m.user_id = (select auth.uid())
      and m.community_id = target_community_id
      and m.status = 'active'
      and coalesce(mt.current_tier, 0) >= required_tier
  );
$$;

alter table public.profiles enable row level security;
alter table public.communities enable row level security;
alter table public.community_roles enable row level security;
alter table public.memberships enable row level security;
alter table public.payments enable row level security;
alter table public.channels enable row level security;
alter table public.posts enable row level security;
alter table public.reactions enable row level security;
alter table public.events enable row level security;
alter table public.tiers enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.member_tiers enable row level security;
alter table public.review_applications enable row level security;
alter table public.team_applications enable row level security;
alter table public.mentorships enable row level security;
alter table public.notifications enable row level security;
alter table public.stripe_webhook_events enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_super_admin());
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid()) or public.is_super_admin()) with check (id = (select auth.uid()) or public.is_super_admin());

create policy communities_public_read on public.communities for select to anon, authenticated using (is_active or public.is_super_admin() or influencer_id = (select auth.uid()));
create policy communities_staff_update on public.communities for update to authenticated using (public.is_community_influencer(id)) with check (public.is_community_influencer(id));
create policy communities_admin_insert on public.communities for insert to authenticated with check (public.is_super_admin());
create policy communities_admin_delete on public.communities for delete to authenticated using (public.is_super_admin());

create policy community_roles_read on public.community_roles for select to authenticated using (user_id = (select auth.uid()) or public.is_community_staff(community_id));
create policy community_roles_manage on public.community_roles for all to authenticated using (public.is_community_influencer(community_id)) with check (public.is_community_influencer(community_id));

create policy memberships_read on public.memberships for select to authenticated using (user_id = (select auth.uid()) or public.is_community_staff(community_id));
create policy memberships_service_write on public.memberships for all to service_role using (true) with check (true);

create policy payments_read on public.payments for select to authenticated using (user_id = (select auth.uid()) or public.is_super_admin());
create policy payments_service_write on public.payments for all to service_role using (true) with check (true);

create policy channels_read on public.channels for select to authenticated using (is_active and public.has_community_access(community_id, min_tier) and (public.is_community_staff(community_id) or 'member' = any(visible_to)));
create policy channels_influencer_write on public.channels for all to authenticated using (public.is_community_influencer(community_id)) with check (public.is_community_influencer(community_id));

create policy posts_read on public.posts for select to authenticated using (not is_deleted and public.has_community_access(community_id, (select min_tier from public.channels where id = channel_id)));
create policy posts_staff_insert on public.posts for insert to authenticated with check (public.is_community_staff(community_id) and author_id = (select auth.uid()));
create policy posts_staff_update on public.posts for update to authenticated using (public.is_community_staff(community_id)) with check (public.is_community_staff(community_id));

create policy reactions_read on public.reactions for select to authenticated using (exists (select 1 from public.posts p where p.id = post_id and not p.is_deleted and public.has_community_access(p.community_id)));
create policy reactions_own_write on public.reactions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy events_read on public.events for select to authenticated using (public.has_community_access(community_id, min_tier));
create policy events_influencer_write on public.events for all to authenticated using (public.is_community_influencer(community_id)) with check (public.is_community_influencer(community_id));

create policy tiers_read on public.tiers for select to authenticated using (public.has_community_access(community_id));
create policy tiers_staff_write on public.tiers for all to authenticated using (public.is_community_influencer(community_id)) with check (public.is_community_influencer(community_id));

create policy lessons_read on public.lessons for select to authenticated using ((status = 'published' and (release_at is null or release_at <= now()) and public.has_community_access(community_id, (select level from public.tiers where id = tier_id))) or public.is_community_staff(community_id));
create policy lessons_staff_write on public.lessons for all to authenticated using (public.is_community_staff(community_id)) with check (public.is_community_staff(community_id));

create policy lesson_progress_own_read on public.lesson_progress for select to authenticated using (user_id = (select auth.uid()) or public.is_community_staff(community_id));
create policy lesson_progress_own_insert on public.lesson_progress for insert to authenticated with check (user_id = (select auth.uid()));
create policy lesson_progress_own_update on public.lesson_progress for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy member_tiers_read on public.member_tiers for select to authenticated using (user_id = (select auth.uid()) or public.is_community_staff(community_id));
create policy member_tiers_service_write on public.member_tiers for all to service_role using (true) with check (true);

create policy review_apps_read on public.review_applications for select to authenticated using (user_id = (select auth.uid()) or public.is_community_influencer(community_id));
create policy review_apps_own_insert on public.review_applications for insert to authenticated with check (user_id = (select auth.uid()) and public.has_community_access(community_id, 5));
create policy review_apps_influencer_update on public.review_applications for update to authenticated using (public.is_community_influencer(community_id)) with check (public.is_community_influencer(community_id));

create policy team_apps_read on public.team_applications for select to authenticated using (user_id = (select auth.uid()) or public.is_community_influencer(community_id));
create policy team_apps_own_insert on public.team_applications for insert to authenticated with check (user_id = (select auth.uid()) and public.has_community_access(community_id, 5));
create policy team_apps_influencer_update on public.team_applications for update to authenticated using (public.is_community_influencer(community_id)) with check (public.is_community_influencer(community_id));

create policy mentorships_read on public.mentorships for select to authenticated using (user_id = (select auth.uid()) or public.is_community_staff(community_id));
create policy mentorships_service_write on public.mentorships for all to service_role using (true) with check (true);

create policy notifications_own_read on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_service_insert on public.notifications for insert to service_role with check (true);

create policy stripe_events_service_only on public.stripe_webhook_events for all to service_role using (true) with check (true);

grant usage on schema public to anon, authenticated, service_role;
grant select on public.communities to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.community_roles, public.memberships, public.payments, public.channels, public.posts, public.reactions, public.events, public.tiers, public.lessons, public.lesson_progress, public.member_tiers, public.review_applications, public.team_applications, public.mentorships, public.notifications to authenticated;
grant insert, update, delete on public.reactions to authenticated;
grant insert, update on public.lesson_progress to authenticated;
grant insert on public.review_applications, public.team_applications to authenticated;
grant all on all tables in schema public to service_role;

revoke all on public.stripe_webhook_events from anon, authenticated;
revoke all on public.payments from anon;
