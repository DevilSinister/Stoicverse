-- Replace the multi-community marketplace model with one Stoicverse platform.

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;

drop function if exists public.has_community_access(uuid, integer) cascade;
drop function if exists public.is_community_staff(uuid) cascade;
drop function if exists public.is_community_influencer(uuid) cascade;
drop function if exists public.is_super_admin() cascade;
drop function if exists public.on_membership_activated() cascade;

drop table if exists public.community_roles cascade;
drop table if exists public.communities cascade;
drop table if exists public.memberships cascade;
drop table if exists public.payments cascade;
drop table if exists public.channels cascade;
drop table if exists public.posts cascade;
drop table if exists public.reactions cascade;
drop table if exists public.events cascade;
drop table if exists public.tiers cascade;
drop table if exists public.lessons cascade;
drop table if exists public.lesson_progress cascade;
drop table if exists public.member_tiers cascade;
drop table if exists public.review_applications cascade;
drop table if exists public.team_applications cascade;
drop table if exists public.mentorships cascade;
drop table if exists public.notifications cascade;
drop table if exists public.stripe_webhook_events cascade;
drop table if exists public.platform_settings cascade;

alter table public.profiles drop constraint if exists profiles_platform_role_check;
alter table public.profiles add constraint profiles_platform_role_check check (platform_role in ('super_admin', 'influencer', 'moderator', 'member'));
create unique index profiles_one_influencer_idx on public.profiles (platform_role) where platform_role = 'influencer';

create table public.platform_settings (
  id boolean primary key default true check (id),
  community_name text not null default 'Stoicverse',
  influencer_id uuid references public.profiles(id) on delete set null,
  membership_fee numeric(10,2) not null default 10.00 check (membership_fee >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id) values (true);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'cancelled', 'refunded')),
  stripe_customer_id text,
  stripe_payment_intent text,
  amount_paid numeric(10,2) check (amount_paid is null or amount_paid >= 0),
  joined_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
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
  name text not null unique,
  type text not null default 'text' check (type in ('text', 'announcements', 'events', 'master')),
  description text,
  min_tier integer not null default 1 check (min_tier between 1 and 5),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
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
  channel_id uuid not null references public.channels(id),
  created_by uuid not null references public.profiles(id),
  title text not null,
  description text,
  zoom_url text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  min_tier integer not null default 1 check (min_tier between 1 and 5),
  status text not null default 'upcoming' check (status in ('upcoming', 'live', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table public.tiers (
  id uuid primary key default gen_random_uuid(),
  level integer not null unique check (level between 1 and 4),
  title text not null,
  description text,
  required_lesson_count integer not null default 8 check (required_lesson_count > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  tier_id uuid not null references public.tiers(id) on delete cascade,
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

create table public.member_tiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  current_tier integer not null default 1 check (current_tier between 1 and 5),
  is_master boolean not null default false,
  tier_unlocked_at timestamptz,
  master_unlocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_master and current_tier = 5) or (not is_master and current_tier between 1 and 4))
);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  watched_seconds integer not null default 0 check (watched_seconds >= 0),
  completion_percentage numeric(5,2) not null default 0 check (completion_percentage between 0 and 100),
  is_completed boolean not null default false,
  first_started_at timestamptz,
  last_watched_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table public.review_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
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
  stripe_payment_intent text not null unique,
  amount_paid numeric(10,2) not null check (amount_paid >= 0),
  status text not null default 'pending' check (status in ('pending', 'active', 'completed', 'cancelled', 'refunded')),
  assigned_mentor_id uuid references public.profiles(id),
  starts_at timestamptz,
  ends_at timestamptz,
  notes text,
  booking_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
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

create index posts_channel_created_idx on public.posts (channel_id, created_at desc);
create index events_starts_idx on public.events (starts_at);
create index lessons_tier_sort_idx on public.lessons (tier_id, sort_order);
create index lesson_progress_user_idx on public.lesson_progress (user_id, is_completed);
create index notifications_user_read_created_idx on public.notifications (user_id, is_read, created_at desc);

create or replace function public.is_super_admin()
returns boolean language sql stable security invoker set search_path = public, pg_temp
as $$ select exists (select 1 from public.profiles where id = (select auth.uid()) and platform_role = 'super_admin' and not is_suspended); $$;

create or replace function public.is_influencer()
returns boolean language sql stable security invoker set search_path = public, pg_temp
as $$ select exists (select 1 from public.profiles where id = (select auth.uid()) and platform_role = 'influencer' and not is_suspended); $$;

create or replace function public.is_staff()
returns boolean language sql stable security invoker set search_path = public, pg_temp
as $$ select public.is_super_admin() or exists (select 1 from public.profiles where id = (select auth.uid()) and platform_role in ('influencer', 'moderator') and not is_suspended); $$;

create or replace function public.has_active_membership()
returns boolean language sql stable security invoker set search_path = public, pg_temp
as $$ select exists (select 1 from public.memberships where user_id = (select auth.uid()) and status = 'active'); $$;

create or replace function public.on_membership_activated()
returns trigger language plpgsql security invoker set search_path = public, pg_temp
as $$ begin if new.status = 'active' and old.status is distinct from 'active' then insert into public.member_tiers (user_id, current_tier, tier_unlocked_at) values (new.user_id, 1, now()) on conflict (user_id) do nothing; end if; return new; end; $$;

create trigger membership_activated after insert or update of status on public.memberships for each row execute function public.on_membership_activated();

drop trigger if exists profiles_set_updated_at on public.profiles;
do $$ declare table_name text; begin foreach table_name in array array['profiles','platform_settings','memberships','channels','posts','events','tiers','lessons','member_tiers','lesson_progress','review_applications','team_applications','mentorships'] loop execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name); end loop; end; $$;

alter table public.profiles enable row level security;
alter table public.platform_settings enable row level security;
alter table public.memberships enable row level security;
alter table public.payments enable row level security;
alter table public.channels enable row level security;
alter table public.posts enable row level security;
alter table public.reactions enable row level security;
alter table public.events enable row level security;
alter table public.tiers enable row level security;
alter table public.lessons enable row level security;
alter table public.member_tiers enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.review_applications enable row level security;
alter table public.team_applications enable row level security;
alter table public.mentorships enable row level security;
alter table public.notifications enable row level security;
alter table public.stripe_webhook_events enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_staff());
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid()) or public.is_super_admin()) with check (id = (select auth.uid()) or public.is_super_admin());
create policy settings_public_read on public.platform_settings for select to anon, authenticated using (true);
create policy settings_admin_write on public.platform_settings for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy memberships_read on public.memberships for select to authenticated using (user_id = (select auth.uid()) or public.is_staff());
create policy memberships_service_write on public.memberships for all to service_role using (true) with check (true);
create policy payments_read on public.payments for select to authenticated using (user_id = (select auth.uid()) or public.is_super_admin());
create policy payments_service_write on public.payments for all to service_role using (true) with check (true);
create policy channels_read on public.channels for select to authenticated using (is_active and (public.has_active_membership() or public.is_staff()));
create policy channels_influencer_write on public.channels for all to authenticated using (public.is_influencer()) with check (public.is_influencer());
create policy posts_read on public.posts for select to authenticated using (not is_deleted and (public.has_active_membership() or public.is_staff()));
create policy posts_staff_write on public.posts for all to authenticated using (public.is_staff()) with check (public.is_staff() and author_id = (select auth.uid()));
create policy reactions_read on public.reactions for select to authenticated using (public.has_active_membership() or public.is_staff());
create policy reactions_own_write on public.reactions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy events_read on public.events for select to authenticated using (public.has_active_membership() or public.is_staff());
create policy events_influencer_write on public.events for all to authenticated using (public.is_influencer()) with check (public.is_influencer());
create policy tiers_read on public.tiers for select to authenticated using (public.has_active_membership() or public.is_staff());
create policy tiers_influencer_write on public.tiers for all to authenticated using (public.is_influencer()) with check (public.is_influencer());
create policy lessons_read on public.lessons for select to authenticated using ((status = 'published' and public.has_active_membership()) or public.is_staff());
create policy lessons_staff_write on public.lessons for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy member_tiers_read on public.member_tiers for select to authenticated using (user_id = (select auth.uid()) or public.is_staff());
create policy member_tiers_service_write on public.member_tiers for all to service_role using (true) with check (true);
create policy lesson_progress_read on public.lesson_progress for select to authenticated using (user_id = (select auth.uid()) or public.is_staff());
create policy lesson_progress_own_insert on public.lesson_progress for insert to authenticated with check (user_id = (select auth.uid()));
create policy lesson_progress_own_update on public.lesson_progress for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy review_read on public.review_applications for select to authenticated using (user_id = (select auth.uid()) or public.is_influencer());
create policy review_apply on public.review_applications for insert to authenticated with check (user_id = (select auth.uid()) and public.has_active_membership());
create policy review_influencer_update on public.review_applications for update to authenticated using (public.is_influencer()) with check (public.is_influencer());
create policy team_read on public.team_applications for select to authenticated using (user_id = (select auth.uid()) or public.is_influencer());
create policy team_apply on public.team_applications for insert to authenticated with check (user_id = (select auth.uid()) and public.has_active_membership());
create policy team_influencer_update on public.team_applications for update to authenticated using (public.is_influencer()) with check (public.is_influencer());
create policy mentorship_read on public.mentorships for select to authenticated using (user_id = (select auth.uid()) or public.is_staff());
create policy mentorship_service_write on public.mentorships for all to service_role using (true) with check (true);
create policy notifications_own_read on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_service_write on public.notifications for all to service_role using (true) with check (true);
create policy stripe_service_write on public.stripe_webhook_events for all to service_role using (true) with check (true);

revoke update on public.profiles from authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant select on public.platform_settings to anon, authenticated;
grant select on public.profiles, public.memberships, public.payments, public.channels, public.posts, public.reactions, public.events, public.tiers, public.lessons, public.member_tiers, public.lesson_progress, public.review_applications, public.team_applications, public.mentorships, public.notifications to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
grant insert, update, delete on public.reactions to authenticated;
grant insert, update on public.lesson_progress to authenticated;
grant insert on public.review_applications, public.team_applications to authenticated;
grant all on all tables in schema public to service_role;

insert into public.memberships (user_id, status, amount_paid, joined_at)
select id, 'active', 0, now() from public.profiles where lower(full_name) = lower('Sinister')
on conflict (user_id) do update set status = 'active', amount_paid = excluded.amount_paid, joined_at = coalesce(public.memberships.joined_at, excluded.joined_at), updated_at = now();
