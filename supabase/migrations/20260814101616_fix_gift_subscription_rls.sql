-- Gift creation needs to return the audit payment identifier. That RETURNING
-- clause is subject to the member-facing payments SELECT policy when the RPC
-- runs as its invoker, causing a valid influencer gift to fail under RLS.
-- Run this tightly scoped entry point as its owner instead. The trigger still
-- validates the acting influencer and target before membership access changes.
create or replace function public.gift_member_subscription(
  target_user_id uuid,
  gift_duration_months smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_id uuid;
begin
  if (select auth.uid()) is null or not public.is_influencer() then
    raise exception 'Influencer access is required' using errcode = '42501';
  end if;

  if target_user_id = (select auth.uid()) then
    raise exception 'This account cannot receive gifted access' using errcode = '42501';
  end if;

  if gift_duration_months not in (1, 3, 6, 12) then
    raise exception 'Gift duration must be 1, 3, 6, or 12 months' using errcode = '22023';
  end if;

  insert into public.payments (
    user_id, product_type, amount, currency, status, source,
    granted_by, duration_months, paid_at
  ) values (
    target_user_id, 'membership', 0, 'usd', 'succeeded', 'gifted',
    (select auth.uid()), gift_duration_months, now()
  ) returning id into payment_id;

  return payment_id;
end;
$$;

revoke all on function public.gift_member_subscription(uuid, smallint) from public, anon;
grant execute on function public.gift_member_subscription(uuid, smallint) to authenticated, service_role;
