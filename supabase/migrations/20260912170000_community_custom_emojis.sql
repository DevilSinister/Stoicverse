-- Phase 6 — custom emoji.
--
-- A community emoji is an image with a name, usable in a message body as
-- `<:name:uuid>` and as a reaction token of the same shape. The id is in the
-- token, not just the name, for one reason: renaming an emoji must not rewrite
-- every message that used it, and deleting one must not silently change what
-- an old message says. An unknown id renders as `:name:` and stays readable.
--
-- Two rules enforced here rather than in the page:
--
--   * **A hundred, and no more.** Counted by a trigger. A CHECK constraint
--     cannot count the rows of the table it is on.
--   * **Restricted emoji are restricted everywhere.** An emoji with no rows in
--     `community_emoji_roles` is for anyone holding `use_custom_emojis`; one
--     with rows is for those roles only, and the same function answers that
--     question for a message body and for a reaction. Two copies of that rule
--     would be one copy and one bug.

-- ------------------------------------------------------------------ table

create table if not exists public.community_emojis (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name ~ '^[a-z0-9_]{2,32}$'),
  image_path text not null,
  mime_type text not null check (mime_type in ('image/png', 'image/webp', 'image/gif')),
  animated boolean not null default false,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_emoji_roles (
  emoji_id uuid not null references public.community_emojis(id) on delete cascade,
  role_id uuid not null references public.community_roles(id) on delete cascade,
  primary key (emoji_id, role_id)
);

alter table public.community_emojis enable row level security;
alter table public.community_emoji_roles enable row level security;

-- Everyone signed in may read the set: the picker, the renderer and the
-- reaction row all need to turn an id into a name and an image.
drop policy if exists community_emojis_read on public.community_emojis;
create policy community_emojis_read on public.community_emojis
  for select to authenticated using (true);

drop policy if exists community_emoji_roles_read on public.community_emoji_roles;
create policy community_emoji_roles_read on public.community_emoji_roles
  for select to authenticated using (true);

-- Writes go through the RPCs below, which check `manage_emojis` and keep the
-- storage object and the row together. Table grants are not a boundary in this
-- project — Supabase's default privileges hand every public table to `anon`
-- and `authenticated` — so the revoke is what closes the direct path.
revoke insert, update, delete, truncate on public.community_emojis from public, anon, authenticated;
revoke insert, update, delete, truncate on public.community_emoji_roles from public, anon, authenticated;

-- ---------------------------------------------------------------- the cap

create or replace function private.assert_emoji_cap()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if (select count(*) from public.community_emojis) > 100 then
    raise exception 'This community already has 100 emoji. Delete one to add another.'
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

revoke execute on function private.assert_emoji_cap() from public, anon, authenticated;

drop trigger if exists community_emojis_cap on public.community_emojis;
create trigger community_emojis_cap
  after insert on public.community_emojis
  for each statement execute function private.assert_emoji_cap();

-- ------------------------------------------------------------- usable-by

-- May this person use this emoji, here?
--
-- One function for both paths. A body and a reaction ask the same question,
-- and an emoji that a role restriction keeps out of a message but lets into a
-- reaction is a restriction that does not exist.
create or replace function public.community_emoji_usable(emoji uuid, member uuid, channel uuid default null)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with resolved as (select public.community_permissions(member, channel) as keys)
  select exists (
    select 1
    from public.community_emojis e, resolved
    where e.id = emoji
      and 'use_custom_emojis' = any(resolved.keys)
      and (
        -- Whoever may manage the emoji may use all of them. The owner holds no
        -- row in community_role_members, so a role restriction shut them out
        -- of the emoji they had just restricted - a rule nobody could test
        -- without granting themselves the role it was meant to check.
        'manage_emojis' = any(resolved.keys)
        -- No rows at all means "everyone who may use custom emoji".
        or not exists (select 1 from public.community_emoji_roles r where r.emoji_id = e.id)
        or exists (
          select 1
          from public.community_emoji_roles r
          join public.community_role_members m on m.role_id = r.role_id and m.user_id = member
          where r.emoji_id = e.id
        )
      )
  );
$$;

revoke execute on function public.community_emoji_usable(uuid, uuid, uuid) from public, anon;
grant execute on function public.community_emoji_usable(uuid, uuid, uuid) to authenticated;


-- --------------------------------------------- the length rule that refused

-- `reactions_emoji_check` capped the column at 32 characters, and a custom
-- emoji token is `<:name:uuid>` - 41 to 71. So a custom reaction has been
-- impossible since the column was created, whatever
-- `community_reaction_token_is_valid` said about it: two rules on one column,
-- disagreeing, with the stricter one winning silently.
--
-- Replaced by the validator itself, which is IMMUTABLE and therefore legal in
-- a CHECK. One rule now, in one place, and it is the one the policy already
-- applies. Every existing row passes it - verified before this was written.
alter table public.reactions drop constraint if exists reactions_emoji_check;

alter table public.reactions
  add constraint reactions_emoji_check check (public.community_reaction_token_is_valid(emoji));

-- ------------------------------------------------------------- reactions

-- A reaction carrying a custom emoji passes the same test as a body.
--
-- A trigger rather than a policy clause: the policy already asks whether the
-- token is *shaped* like an emoji, and shape is all a regex can answer.
-- Whether this person may use this particular one reads three tables.
create or replace function private.assert_reaction_emoji_usable()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  used uuid;
begin
  if new.emoji !~ '^<:[a-z0-9_]{2,32}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>$' then
    return new;
  end if;

  used := substring(new.emoji from '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')::uuid;
  if not public.community_emoji_usable(used, new.user_id, new.channel_id) then
    raise exception 'You cannot use that emoji.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function private.assert_reaction_emoji_usable() from public, anon, authenticated;

drop trigger if exists reactions_emoji_usable on public.reactions;
create trigger reactions_emoji_usable
  before insert on public.reactions
  for each row execute function private.assert_reaction_emoji_usable();

-- ------------------------------------------------------------------ RPCs

create or replace function public.community_emoji_create(
  emoji_name text,
  path text,
  mime text,
  is_animated boolean default false,
  role_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  new_id uuid;
begin
  if not public.community_has('manage_emojis') then
    raise exception 'You cannot manage emoji.' using errcode = '42501';
  end if;

  insert into public.community_emojis (name, image_path, mime_type, animated, uploaded_by)
  values (lower(btrim(emoji_name)), path, mime, coalesce(is_animated, false), (select auth.uid()))
  returning id into new_id;

  insert into public.community_emoji_roles (emoji_id, role_id)
  select new_id, role_id from unnest(coalesce(role_ids, '{}'::uuid[])) as role_id
  on conflict do nothing;

  return new_id;
end;
$$;

revoke execute on function public.community_emoji_create(text, text, text, boolean, uuid[]) from public, anon;
grant execute on function public.community_emoji_create(text, text, text, boolean, uuid[]) to authenticated;

create or replace function public.community_emoji_update(
  emoji_id uuid,
  emoji_name text,
  role_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.community_has('manage_emojis') then
    raise exception 'You cannot manage emoji.' using errcode = '42501';
  end if;

  update public.community_emojis
     set name = lower(btrim(emoji_name)), updated_at = now()
   where id = emoji_id;
  if not found then
    raise exception 'That emoji is gone.' using errcode = 'no_data_found';
  end if;

  -- Replaced rather than merged: the section sends the whole set it is
  -- showing, and a merge would make unticking a role do nothing.
  delete from public.community_emoji_roles r where r.emoji_id = community_emoji_update.emoji_id;
  insert into public.community_emoji_roles (emoji_id, role_id)
  select community_emoji_update.emoji_id, role_id from unnest(coalesce(role_ids, '{}'::uuid[])) as role_id
  on conflict do nothing;
end;
$$;

revoke execute on function public.community_emoji_update(uuid, text, uuid[]) from public, anon;
grant execute on function public.community_emoji_update(uuid, text, uuid[]) to authenticated;

-- Delete an emoji, and the reactions that used it.
--
-- The reactions go because a reaction is a live pointer: left behind, it would
-- render as a token nothing can resolve, in a row of otherwise ordinary faces.
-- Message bodies are left exactly as they were — rewriting what somebody wrote
-- is not a tidy-up — and the renderer shows an unknown token as `:name:`.
--
-- Returns the storage path so the caller can remove the object. Deleting it
-- here would mean a definer function reaching into storage, and a failure
-- there would take the row with it.
create or replace function public.community_emoji_delete(emoji_id uuid)
returns table (image_path text, reactions_removed int)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  stored_path text;
  removed int;
begin
  if not public.community_has('manage_emojis') then
    raise exception 'You cannot manage emoji.' using errcode = '42501';
  end if;

  select e.image_path into stored_path from public.community_emojis e where e.id = emoji_id;
  if stored_path is null then
    raise exception 'That emoji is gone.' using errcode = 'no_data_found';
  end if;

  with gone as (
    delete from public.reactions
    where emoji like '<:%:' || emoji_id::text || '>'
    returning 1
  )
  select count(*)::int into removed from gone;

  delete from public.community_emojis where id = emoji_id;

  return query select stored_path, removed;
end;
$$;

revoke execute on function public.community_emoji_delete(uuid) from public, anon;
grant execute on function public.community_emoji_delete(uuid) to authenticated;

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-emojis', 'community-emojis', true, 262144, array['image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = true,
      file_size_limit = 262144,
      allowed_mime_types = array['image/png', 'image/webp', 'image/gif'];

drop policy if exists community_emojis_public_read on storage.objects;
create policy community_emojis_public_read on storage.objects
  for select using (bucket_id = 'community-emojis');

drop policy if exists community_emojis_manage_write on storage.objects;
create policy community_emojis_manage_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'community-emojis' and public.community_has('manage_emojis'));

drop policy if exists community_emojis_manage_delete on storage.objects;
create policy community_emojis_manage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'community-emojis' and public.community_has('manage_emojis'));


-- --------------------------------------------------- the send path, reopened

-- `community_send_message` has refused every custom-emoji token since phase 8
-- with "Custom emoji are not available yet." It is recreated here with that
-- line replaced by the real question. Everything else in the function is
-- carried over from 20260912150000 unchanged.

create or replace function public.community_send_message(
  channel uuid,
  body text default null,
  reply_to uuid default null,
  thread uuid default null,
  attachments jsonb default '[]'::jsonb,
  client_nonce text default null
)
returns table (post_id uuid, blocked_reason text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  actor uuid := (select auth.uid());
  gate text;
  thread_row public.threads%rowtype;
  attachment jsonb;
  attachment_count integer;
  new_post uuid;
  verdict record;
  mentioned_role uuid;
  mention_token text;
begin
  if actor is null then
    raise exception 'You are not signed in.' using errcode = '42501';
  end if;

  select private.community_gate(actor) into gate;
  if gate = 'suspended' then
    raise exception 'Your account is suspended.' using errcode = '42501';
  elsif gate = 'banned' then
    raise exception 'You are banned from this community.' using errcode = '42501';
  elsif gate = 'timeout' then
    raise exception 'You are timed out and cannot post right now.' using errcode = '42501';
  end if;

  if thread is not null then
    select * into thread_row from public.threads where id = thread;
    if not found then
      raise exception 'That thread no longer exists.';
    end if;
    if thread_row.channel_id <> channel then
      raise exception 'That thread belongs to a different channel.';
    end if;
    if thread_row.locked then
      raise exception 'That thread is locked.';
    end if;
    if thread_row.archived_at is not null then
      raise exception 'That thread is archived.';
    end if;
    if not public.community_has('send_messages_in_threads', channel) then
      raise exception 'You do not have permission to post in threads here.' using errcode = '42501';
    end if;
  else
    if not public.community_has('send_messages', channel) then
      raise exception 'You do not have permission to post here.' using errcode = '42501';
    end if;
  end if;

  if reply_to is not null and not exists (
    select 1 from public.posts where id = reply_to and channel_id = channel and not is_deleted
  ) then
    raise exception 'The message you are replying to is not in this channel.';
  end if;

  attachment_count := coalesce(jsonb_array_length(attachments), 0);
  if attachment_count > 10 then
    raise exception 'A message can carry at most 10 attachments.';
  end if;
  if attachment_count > 0 then
    if not public.community_has('attach_files', channel) then
      raise exception 'You do not have permission to attach files here.' using errcode = '42501';
    end if;
    for attachment in select * from jsonb_array_elements(attachments) loop
      if (attachment->>'path') is null or btrim(attachment->>'path') = '' then
        raise exception 'An attachment is missing its path.';
      end if;
      if split_part(attachment->>'path', '/', 1) <> actor::text then
        raise exception 'An attachment does not belong to you.' using errcode = '42501';
      end if;
      if (attachment->>'mimeType') not in
         ('image/jpeg', 'image/png', 'image/webp', 'image/gif',
          'video/mp4', 'video/webm',
          'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg',
          'application/pdf') then
        raise exception 'That file type is not allowed here.';
      end if;
      if coalesce((attachment->>'byteSize')::bigint, 0) > 26214400 then
        raise exception 'Attachments are limited to 25 MB each.';
      end if;
    end loop;
  end if;

  if coalesce(btrim(body), '') = '' and attachment_count = 0 then
    raise exception 'A message needs something in it.';
  end if;

  if coalesce(body, '') ~* '(https?://|www\.)' and not public.community_has('embed_links', channel) then
    raise exception 'You do not have permission to post links here.' using errcode = '42501';
  end if;

  if coalesce(body, '') ~ '(^|[^[:alnum:]_])@(everyone|here)([^[:alnum:]_]|$)'
     and not public.community_has('mention_everyone', channel) then
    raise exception 'You do not have permission to mention everyone here.' using errcode = '42501';
  end if;

  for mention_token in
    select token[1]
    from regexp_matches(coalesce(body, ''),
      '<@&([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})>', 'g') as token
  loop
    mentioned_role := mention_token::uuid;
    if exists (select 1 from public.community_roles where id = mentioned_role and not mentionable)
       and not public.community_has('mention_roles', channel) then
      raise exception 'You do not have permission to mention that role.' using errcode = '42501';
    end if;
  end loop;

  -- Custom emoji: shaped like one is not the same as allowed to use this one.
  -- An unknown id fails here too, because sending an emoji that does not exist
  -- would put a token in the body that nothing can ever resolve.
  if exists (
    select 1
    from regexp_matches(coalesce(body, ''),
      '<:[a-z0-9_]{2,32}:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})>', 'g') as token
    where not public.community_emoji_usable((token[1])::uuid, actor, channel)
  ) then
    raise exception 'You cannot use that emoji here.' using errcode = '42501';
  end if;

  select * into verdict from private.automod_evaluate(actor, channel, body, null) limit 1;

  if verdict.blocked then
    return query select null::uuid, verdict.reason;
    return;
  end if;

  perform set_config('stoicverse.automod_done', 'on', true);

  insert into public.posts (channel_id, author_id, body, post_type, reply_to_post_id, thread_id, client_nonce)
  values (channel, actor, nullif(btrim(coalesce(body, '')), ''), 'post', reply_to, thread, client_nonce)
  returning id into new_post;

  perform set_config('stoicverse.automod_done', 'off', true);

  if attachment_count > 0 then
    insert into public.post_attachments
      (post_id, path, mime_type, byte_size, width, height, duration_seconds, sort_order)
    select new_post,
           entry.value->>'path',
           entry.value->>'mimeType',
           nullif(entry.value->>'byteSize', '')::bigint,
           nullif(entry.value->>'width', '')::integer,
           nullif(entry.value->>'height', '')::integer,
           nullif(entry.value->>'durationSeconds', '')::numeric,
           (entry.ordinality - 1)::integer
    from jsonb_array_elements(attachments) with ordinality as entry(value, ordinality);
  end if;

  return query select new_post, null::text;
end;
$$;

-- Recreating a definer resets nothing about its grants only when it is
-- replaced in place, but the pair is written anyway: this is the one function
-- in the project whose signature a later phase is most likely to change, and a
-- drop-and-create there would lose them silently.
revoke execute on function public.community_send_message(uuid, text, uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.community_send_message(uuid, text, uuid, uuid, jsonb, text) to authenticated, service_role;

notify pgrst, 'reload schema';
