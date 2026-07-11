-- Allow the initial single-community launch to sell platform access before a community owner is provisioned.
alter table public.memberships alter column community_id drop not null;

create unique index memberships_one_platform_membership_idx
  on public.memberships (user_id)
  where community_id is null;

create or replace function public.on_membership_activated()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' and new.community_id is not null then
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
