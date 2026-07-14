-- Keep cancelled events visible to members for 24 hours from the actual
-- cancellation, rather than from their originally scheduled end time.
alter table public.events
  add column if not exists cancelled_at timestamptz;

-- `updated_at` is the best available historical timestamp for cancellations
-- made before this migration was installed.
update public.events
set cancelled_at = updated_at
where status = 'cancelled'
  and cancelled_at is null;

create or replace function public.set_event_cancelled_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    new.cancelled_at = now();
  elsif new.status is distinct from 'cancelled' and old.status = 'cancelled' then
    new.cancelled_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists events_set_cancelled_at on public.events;
create trigger events_set_cancelled_at
before update of status on public.events
for each row execute function public.set_event_cancelled_at();
