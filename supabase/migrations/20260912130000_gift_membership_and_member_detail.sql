-- Gifting a membership, and the detail the owner needs in order to decide to.
--
-- `memberships.access_source` has allowed 'gifted' since the table was built;
-- nothing has ever written it. This is the path that does.
--
-- Two rules the code below exists to hold:
--
--   * **A gift extends, it never replaces.** Giving somebody a month while
--     they already have three weeks paid for must not take three weeks away.
--   * **A gift never relabels a payment.** If the existing row says `stripe`,
--     it stays `stripe` — overwriting it would erase the fact that somebody
--     actually paid, which is the one thing that column is for.
--
-- Gifting is the owner's alone. `manage_community` is deliberately not enough:
-- handing out paid access is a commercial act rather than a moderation one,
-- and a moderator who can time somebody out should not be able to give away
-- the creator's revenue.

begin;

do $$
begin
  if not exists (select 1 from pg_class where relname = 'memberships' and relnamespace = 'public'::regnamespace) then
    raise exception 'public.memberships is missing';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.memberships'::regclass and conname = 'memberships_access_source_check'
  ) then
    raise exception 'memberships.access_source has no check constraint: this migration assumes it allows gifted';
  end if;
end
$$;

create or replace function public.community_gift_membership(
  target uuid,
  days integer,
  note text default null
)
returns timestamptz
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  new_expiry timestamptz;
begin
  if actor is null then
    raise exception 'You are not signed in.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = actor and platform_role in ('influencer', 'super_admin')
  ) then
    raise exception 'Only the community owner can gift a membership.' using errcode = '42501';
  end if;

  if days is null or days < 1 or days > 3650 then
    raise exception 'A gift runs between 1 and 3650 days.';
  end if;
  if not exists (select 1 from public.profiles where id = target) then
    raise exception 'That member could not be found.';
  end if;

  -- From whichever is later: the end of what they already have, or now. A
  -- lapsed membership starts again today; a live one is extended.
  select greatest(coalesce(max(m.expires_at), now()), now()) + make_interval(days => days)
  into new_expiry
  from public.memberships m where m.user_id = target;

  insert into public.memberships (user_id, status, joined_at, expires_at, access_source, amount_paid)
  values (target, 'active', now(), new_expiry, 'gifted', 0)
  on conflict (user_id) do update
    set status = 'active',
        expires_at = new_expiry,
        access_source = case when public.memberships.access_source = 'stripe'
                             then public.memberships.access_source else 'gifted' end,
        joined_at = coalesce(public.memberships.joined_at, now());

  -- A gift is a thing that happened to somebody's account, so it belongs in
  -- the same log as everything else that does.
  insert into public.community_mod_cases (subject_id, actor_id, kind, reason, source)
  values (target, actor, 'note',
          coalesce(nullif(btrim(coalesce(note, '')), ''), 'Membership gifted for ' || days || ' days'),
          'manual');

  return new_expiry;
end;
$$;

revoke execute on function public.community_gift_membership(uuid, integer, text) from public, anon;
grant execute on function public.community_gift_membership(uuid, integer, text) to authenticated, service_role;

-- ---------------------------------------------------------------- the detail

create or replace function public.community_member_detail(target uuid)
returns table (
  id uuid, full_name text, avatar_url text, joined_at timestamptz, platform_role text,
  membership_status text, membership_expires_at timestamptz, membership_source text,
  amount_paid numeric, message_count bigint, roles jsonb
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  actor_is_owner boolean;
begin
  if actor is null then
    raise exception 'You are not signed in.' using errcode = '42501';
  end if;

  -- `viewer.id`, not `id`: this function's OUT parameters are named after the
  -- columns it returns, so a bare `id` is ambiguous between the parameter and
  -- profiles.id — and Postgres refuses it at call time, not at creation, so it
  -- creates cleanly and then fails for whoever calls it first.
  select exists (
    select 1 from public.profiles viewer
    where viewer.id = actor and viewer.platform_role in ('influencer', 'super_admin')
  ) into actor_is_owner;

  -- Commercial detail belongs to the owner and the moderators. What somebody
  -- paid is not public information inside a community.
  if not actor_is_owner and not public.community_has('moderate_members', null) then
    raise exception 'You do not have permission to see that.' using errcode = '42501';
  end if;

  return query
  select p.id, coalesce(p.full_name, 'Member'), p.avatar_url, p.created_at, p.platform_role,
         m.status, m.expires_at, m.access_source, m.amount_paid,
         (select count(*) from public.posts post where post.author_id = p.id and not post.is_deleted),
         coalesce((
           select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'color', r.color)
                            order by r.position desc)
           from public.community_role_members a
           join public.community_roles r on r.id = a.role_id
           where a.user_id = p.id
         ), '[]'::jsonb)
  from public.profiles p
  left join public.memberships m on m.user_id = p.id
  where p.id = target;
end;
$$;

revoke execute on function public.community_member_detail(uuid) from public, anon;
grant execute on function public.community_member_detail(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
