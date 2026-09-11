-- Community identity: branding, welcome and rules.
--
-- Branding deliberately does NOT go in public.platform_settings, for three
-- independent reasons:
--
--   1. Row-level security has no column granularity. Letting the influencer
--      update that row would also let them write membership_fee and
--      influencer_id — the pointer to who the influencer is. Table grants
--      cannot fix it: Supabase's default privileges have already re-granted
--      UPDATE on every public table to authenticated.
--   2. settings_public_read is TO anon USING (true). Anything added there is
--      published to the open internet.
--   3. Different owner, different lifecycle.
--
-- The one field that must stay in platform_settings is community_name, because
-- it is already there and two names would drift. Column granularity for it is
-- achieved the way this project already does it elsewhere — a SECURITY DEFINER
-- function that touches exactly one column.
--
-- Every raise here uses plpgsql's default SQLSTATE P0001, which PostgreSQL
-- itself essentially never emits, so the client may show the message verbatim
-- while every other error code stays in the server log.

-- ------------------------------------------------------------------- settings

create table if not exists public.community_settings (
  id              boolean primary key default true check (id),
  tagline         text check (tagline is null or char_length(tagline) <= 140),
  logo_path       text,
  accent_color    text not null default '#10B981'
                    check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  welcome_message text check (welcome_message is null or char_length(welcome_message) <= 2000),
  rules           text check (rules is null or char_length(rules) <= 10000),
  show_welcome    boolean not null default true,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id) on delete set null
);

comment on table public.community_settings is
  'Singleton. Influencer-owned community identity. Kept out of platform_settings because that row is anon-readable and holds membership_fee and influencer_id.';
comment on column public.community_settings.rules is
  'Rendered as pre-wrapped plain text. There is no markdown renderer on the member surface, so markdown here would display as literal syntax.';

-- The row must exist from here: there is no INSERT policy, deliberately, so
-- nothing can create a second singleton or replace this one.
insert into public.community_settings (id) values (true) on conflict (id) do nothing;

alter table public.community_settings enable row level security;

drop policy if exists community_settings_member_read on public.community_settings;
create policy community_settings_member_read
  on public.community_settings
  for select
  to authenticated
  using (true);

drop policy if exists community_settings_influencer_update on public.community_settings;
create policy community_settings_influencer_update
  on public.community_settings
  for update
  to authenticated
  using (public.is_influencer() or public.is_super_admin())
  with check (public.is_influencer() or public.is_super_admin());

-- No INSERT and no DELETE policy. Absence is denial, and an explicit revoke is
-- required as well because default privileges re-grant DML regardless.
revoke insert, delete on public.community_settings from anon, authenticated;

create or replace function public.touch_community_settings()
returns trigger
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
begin
  new.id := true;              -- the singleton cannot be renumbered
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

drop trigger if exists community_settings_touch on public.community_settings;
create trigger community_settings_touch
  before update on public.community_settings
  for each row execute function public.touch_community_settings();

-- ------------------------------------------------- public branding projection

-- A SELECT policy would publish every column to anon, including anything added
-- later. This projects exactly the four fields the signed-out marketing surface
-- needs and nothing else.
create or replace function public.community_branding()
returns table (community_name text, tagline text, logo_path text, accent_color text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select p.community_name, c.tagline, c.logo_path, c.accent_color
  from public.community_settings c
  cross join lateral (select community_name from public.platform_settings limit 1) p;
$$;

grant execute on function public.community_branding() to anon, authenticated;

-- ------------------------------------------------------------- community name

-- platform_settings is super-admin-only and anon-readable. This lets the
-- influencer change the one column that is theirs, without widening the row
-- policy to membership_fee and influencer_id.
create or replace function public.set_community_name(new_name text)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  trimmed text := btrim(coalesce(new_name, ''));
begin
  if not (public.is_influencer() or public.is_super_admin()) then
    raise exception 'Only the influencer can rename this community.';
  end if;

  if char_length(trimmed) < 2 or char_length(trimmed) > 60 then
    raise exception 'The community name must be between 2 and 60 characters.';
  end if;

  update public.platform_settings set community_name = trimmed, updated_at = now();
  return trimmed;
end;
$$;

-- From PUBLIC, not just from anon. Functions grant EXECUTE to PUBLIC by
-- default and anon inherits it, so revoking from anon alone leaves the function
-- on the unauthenticated REST surface. The security advisor flags exactly this.
revoke execute on function public.set_community_name(text) from public;
revoke execute on function public.set_community_name(text) from anon;
grant execute on function public.set_community_name(text) to authenticated;

-- --------------------------------------------------------------------- bucket

-- Public read: the logo renders in the app shell on every page for every
-- member, and a private bucket would mean a signed-URL round trip per render.
-- 2MB against the 20MB of community-posts, because this is a header mark.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-branding', 'community-branding', true, 2097152,
        array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists community_branding_influencer_write on storage.objects;
create policy community_branding_influencer_write
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'community-branding' and public.is_influencer())
  with check (bucket_id = 'community-branding' and public.is_influencer());
