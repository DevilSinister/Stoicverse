-- Avoid a public SECURITY DEFINER endpoint. The caller does not need to read
-- the payment row: generate its audit ID before the RLS-authorized INSERT.
create or replace function public.gift_member_subscription(
  target_user_id uuid,
  gift_duration_months smallint
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  payment_id uuid := gen_random_uuid();
begin
  if gift_duration_months not in (1, 3, 6, 12) then
    raise exception 'Gift duration must be 1, 3, 6, or 12 months' using errcode = '22023';
  end if;

  insert into public.payments (
    id, user_id, product_type, amount, currency, status, source,
    granted_by, duration_months, paid_at
  ) values (
    payment_id, target_user_id, 'membership', 0, 'usd', 'succeeded', 'gifted',
    (select auth.uid()), gift_duration_months, now()
  );

  return payment_id;
end;
$$;

revoke all on function public.gift_member_subscription(uuid, smallint) from public, anon;
grant execute on function public.gift_member_subscription(uuid, smallint) to authenticated, service_role;
