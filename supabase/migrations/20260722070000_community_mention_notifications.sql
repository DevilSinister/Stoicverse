-- Mention notifications are issued by the database so they cannot be forged
-- or skipped by a client-side post submission.
create or replace function public.notify_community_mentions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  body_text text := coalesce(new.body, '');
  action text := '/dashboard/community?channel=' || new.channel_id;
begin
  if body_text !~* '(^|[^[:alnum:]_])@(all|tier-[1-5])([^[:alnum:]_]|$)' then
    return new;
  end if;

  insert into public.notifications(user_id, type, title, body, action_url)
  select profile.id,
         'community_mention',
         case when body_text ~* '(^|[^[:alnum:]_])@all([^[:alnum:]_]|$)' then 'You were mentioned in the community' else 'Your tier was mentioned in the community' end,
         left(body_text, 240),
         action
  from public.profiles profile
  join public.memberships membership on membership.user_id = profile.id and membership.status = 'active'
  join public.member_tiers tier on tier.user_id = profile.id
  where not profile.is_suspended
    and profile.id <> new.author_id
    and (
      body_text ~* '(^|[^[:alnum:]_])@all([^[:alnum:]_]|$)'
      or body_text ~* ('(^|[^[:alnum:]_])@tier-' || case when tier.is_master then 5 else tier.current_tier end || '([^[:alnum:]_]|$)')
    );

  return new;
end;
$$;

drop trigger if exists posts_notify_mentions on public.posts;
create trigger posts_notify_mentions
after insert on public.posts
for each row execute function public.notify_community_mentions();
