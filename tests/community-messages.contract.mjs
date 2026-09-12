import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { MESSAGE_PAGE_SIZE, SEARCH_QUERY_LIMITS, THREAD_NAME_LIMITS } from "../src/lib/community/constants.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const SCHEMA = "supabase/migrations/20260912070000_community_messages.sql";
const RPCS = "supabase/migrations/20260912070001_community_message_rpcs.sql";
const SCHEMA_DOWN = "supabase/rollback/20260912070000_community_messages.down.sql";
const RPCS_DOWN = "supabase/rollback/20260912070001_community_message_rpcs.down.sql";

test("a thread post keeps its parent channel, so every channel policy still applies", async () => {
  const schema = await read(SCHEMA);
  // `threads.channel_id` exists, but the post's own channel_id is what the
  // policies read. If a migration ever stopped setting it, threads would
  // become a hole in every channel override.
  assert.match(schema, /thread_id uuid references public\.threads\(id\) on delete cascade/);
  assert.match(schema, /Thread posts keep the parent channel_id/);

  const rpcs = await read(RPCS);
  // The send RPC inserts the channel it was given, never the thread's.
  assert.match(
    rpcs,
    /insert into public\.posts \(channel_id, author_id, body, post_type, reply_to_post_id, thread_id, client_nonce\)/,
  );
});

test("a reply cannot leave its channel", async () => {
  const schema = await read(SCHEMA);
  // Otherwise a reply excerpt would carry a message out of a channel the
  // reader cannot see.
  assert.match(schema, /function private\.assert_reply_same_channel/);
  assert.match(schema, /create trigger posts_assert_reply_channel/);
  const rpcs = await read(RPCS);
  assert.match(rpcs, /The message you are replying to is not in this channel/);
});

test("the reaction cap takes an advisory lock, or two concurrent inserts both pass", async () => {
  const schema = await read(SCHEMA);
  const cap = schema.slice(schema.indexOf("function private.reactions_cap_distinct"));
  assert.match(cap, /pg_advisory_xact_lock\(hashtext\(new\.post_id::text\)\)/);
  assert.match(cap, /distinct_count >= 20/);
  assert.match(cap, /errcode = 'P0001'/);
});

test("reactions carry channel_id and it is not nullable", async () => {
  const schema = await read(SCHEMA);
  // The page filters its realtime subscription on this column. Without it a
  // reaction in any channel wakes every open channel.
  assert.match(schema, /add column if not exists channel_id uuid references public\.channels\(id\)/);
  assert.match(schema, /alter table public\.reactions alter column channel_id set not null/);
  // The backfill has to be asserted before the not-null, or the ALTER is what
  // discovers the gap.
  const backfillAt = schema.indexOf("set channel_id = post.channel_id");
  const assertAt = schema.indexOf("reaction(s) still have no channel_id");
  const notNullAt = schema.indexOf("alter column channel_id set not null");
  assert.ok(backfillAt > -1 && backfillAt < assertAt, "backfill first");
  assert.ok(assertAt < notNullAt, "assert the backfill worked, then set not null");
});

test("one thread per message, enforced by the database rather than the RPC", async () => {
  const schema = await read(SCHEMA);
  // A double-submit must not be able to create two threads on one message.
  assert.match(schema, /root_post_id uuid not null unique references public\.posts\(id\)/);
});

test("the old mention notifier is gone, not merely bypassed", async () => {
  const schema = await read(SCHEMA);
  assert.match(schema, /drop trigger if exists posts_notify_mentions on public\.posts/);
  assert.match(schema, /drop function if exists public\.notify_community_mentions\(\)/);
  assert.match(schema, /drop function if exists public\.community_mention_kind\(text\)/);
  // A left-behind trigger would double-notify on every mention.
  assert.match(schema, /create trigger posts_mentions_sync/);
});

test("mentions are matched as real uuids, not as any 36 characters", async () => {
  const schema = await read(SCHEMA);
  // `[0-9a-fA-F-]{36}` would match a malformed string and then fail the ::uuid
  // cast, turning a typo in a message into a failed insert.
  assert.equal(/\[0-9a-fA-F-\]\{36\}\)>/.test(schema), false);
  assert.match(schema, /<@\(\[0-9a-fA-F\]\{8\}-\[0-9a-fA-F\]\{4\}-/);
});

test("AutoMod runs once when a message goes through the send RPC", async () => {
  const rpcs = await read(RPCS);
  // Phase 5's AFTER INSERT trigger would otherwise record a second alert, a
  // second notification and a second timeout case for the same message.
  assert.match(rpcs, /current_setting\('stoicverse\.automod_done', true\)/);
  const evaluateAt = rpcs.indexOf("private.automod_evaluate(actor, channel, body, null)");
  const flagAt = rpcs.indexOf("set_config('stoicverse.automod_done', 'on', true)");
  const insertAt = rpcs.indexOf("insert into public.posts (channel_id, author_id");
  const resetAt = rpcs.indexOf("set_config('stoicverse.automod_done', 'off', true)");
  assert.ok(evaluateAt > -1 && evaluateAt < flagAt, "evaluate before raising the flag");
  assert.ok(flagAt < insertAt, "the flag is up before the insert the trigger sees");
  assert.ok(insertAt < resetAt, "and lowered straight after, so a second call is evaluated normally");
});

test("the send RPC repeats every check the insert policy was making", async () => {
  const rpcs = await read(RPCS);
  const send = rpcs.slice(
    rpcs.indexOf("function public.community_send_message"),
    rpcs.indexOf("function public.community_channel_messages"),
  );
  // A definer bypasses `posts_member_insert`, so this function is the boundary.
  assert.match(send, /security definer/);
  assert.match(send, /community_has\('send_messages', channel\)/);
  assert.match(send, /community_has\('send_messages_in_threads', channel\)/);
  assert.match(send, /community_has\('attach_files', channel\)/);
  assert.match(send, /community_has\('embed_links', channel\)/);
  assert.match(send, /community_has\('mention_everyone', channel\)/);
  assert.match(send, /community_has\('mention_roles', channel\)/);
  // And the gate, which the resolver reflects but does not explain.
  assert.match(send, /private\.community_gate\(actor\)/);
  assert.match(send, /banned/);
  assert.match(send, /timeout/);
});

test("an attachment has to belong to the person sending it", async () => {
  const rpcs = await read(RPCS);
  // The upload policy writes into `<uid>/<channel>/`; without this a member
  // could attach somebody else's upload by path.
  assert.match(rpcs, /split_part\(attachment->>'path', '\/', 1\) <> actor::text/);
  assert.match(rpcs, /An attachment does not belong to you/);
});

test("search escapes the query and stays inside visible channels", async () => {
  const rpcs = await read(RPCS);
  const search = rpcs.slice(
    rpcs.indexOf("function public.community_search_messages"),
    rpcs.indexOf("function public.community_member_profile"),
  );
  // A member typing `%` must search for a percent sign, not match everything.
  assert.match(search, /replace\(replace\(replace\(cleaned/);
  assert.match(search, /community_visible_channel_ids\(\)/);
});

test("message paging is keyset and clamped", async () => {
  const rpcs = await read(RPCS);
  const messages = rpcs.slice(
    rpcs.indexOf("function public.community_channel_messages"),
    rpcs.indexOf("function public.community_channel_pins"),
  );
  // An offset walk re-reads everything the member already scrolled past.
  assert.match(messages, /order by post\.created_at desc, post\.id desc/);
  assert.match(messages, /post\.created_at = before_created_at and post\.id < before_id/);
  assert.match(messages, /least\(greatest\(coalesce\(page_size, 50\), 1\), 100\)/);
  assert.equal(/\boffset\b/i.test(messages), false);
});

test("the client mirrors the database bounds", async () => {
  const rpcs = await read(RPCS);
  const schema = await read(SCHEMA);
  assert.equal(MESSAGE_PAGE_SIZE, 50);
  assert.match(rpcs, new RegExp(`coalesce\\(page_size, ${MESSAGE_PAGE_SIZE}\\)`));
  assert.match(
    rpcs,
    new RegExp(
      `char_length\\(cleaned\\) < ${SEARCH_QUERY_LIMITS.min} or char_length\\(cleaned\\) > ${SEARCH_QUERY_LIMITS.max}`,
    ),
  );
  assert.match(
    schema,
    new RegExp(`char_length\\(btrim\\(name\\)\\) between ${THREAD_NAME_LIMITS.min} and ${THREAD_NAME_LIMITS.max}`),
  );
});

test("unread is not the same as never opened", async () => {
  const rpcs = await read(RPCS);
  // A channel nobody has opened would otherwise light up for every member on
  // the day they join.
  assert.match(rpcs, /ch_last_read is not null and exists/);
});

test("the member path reads RPCs, never the staff-gated base tables", async () => {
  const loader = await read("src/lib/community/messages.ts");
  assert.equal(/\.from\("posts"\)/.test(loader), false);
  assert.equal(/\.from\("post_attachments"\)/.test(loader), false);
  assert.equal(/\.from\("threads"\)/.test(loader), false);
  assert.match(loader, /rpc\("community_channel_messages"/);
  assert.match(loader, /rpc\("community_viewer_state"/);
});

test("both rollbacks exist and say what they cannot restore", async () => {
  const schemaDown = await read(SCHEMA_DOWN);
  const rpcsDown = await read(RPCS_DOWN);

  // Thread posts cascade from `threads`. Dropping the table without detaching
  // them first would delete the messages inside every thread.
  const detachAt = schemaDown.indexOf("set thread_id = null");
  const dropAt = schemaDown.indexOf("drop table if exists public.threads");
  assert.ok(detachAt > -1 && detachAt < dropAt, "thread posts are detached before the table is dropped");

  assert.match(schemaDown, /This loses data/);
  assert.match(schemaDown, /image_url = attachment\.path/);
  assert.match(schemaDown, /sort_order > 0/);
  // The pre-phase-8 trigger and its helper both have to come back, or posting
  // would call a function this rollback dropped.
  assert.match(schemaDown, /create or replace function public\.community_mention_kind/);
  assert.match(schemaDown, /create or replace function public\.notify_community_mentions/);
  assert.match(schemaDown, /create trigger posts_notify_mentions/);

  assert.match(rpcsDown, /drop function if exists public\.community_send_message/);
  assert.match(rpcsDown, /create or replace function private\.automod_record_post/);
  // Restored without the guard, because nothing evaluates ahead of the insert
  // once the send RPC is gone.
  assert.equal(/stoicverse\.automod_done/.test(rpcsDown), false);
});
