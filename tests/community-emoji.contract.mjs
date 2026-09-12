import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { CUSTOM_EMOJI_LIMITS, emojiToken, isAllowedEmojiType, parseEmojiName } from "../src/lib/community/emojis.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const MIGRATION = "supabase/migrations/20260912170000_community_custom_emojis.sql";
const ROLLBACK = "supabase/rollback/20260912170000_community_custom_emojis.down.sql";

test("the limits are the ones the database and the bucket enforce", async () => {
  const sql = await read(MIGRATION);

  assert.match(
    sql,
    new RegExp(`name ~ '\\^\\[a-z0-9_\\]\\{${CUSTOM_EMOJI_LIMITS.name.min},${CUSTOM_EMOJI_LIMITS.name.max}\\}\\$'`),
  );
  assert.match(sql, new RegExp(`file_size_limit = ${CUSTOM_EMOJI_LIMITS.bytes}`));
  assert.match(sql, new RegExp(`'community-emojis', true, ${CUSTOM_EMOJI_LIMITS.bytes}`));
  for (const type of CUSTOM_EMOJI_LIMITS.types) assert.match(sql, new RegExp(`'${type.replace("/", "\\/")}'`));
  assert.match(sql, new RegExp(`> ${CUSTOM_EMOJI_LIMITS.slots} then`), "the cap trigger uses the same number");
});

test("the cap is a trigger, because a CHECK cannot count the rows of its own table", async () => {
  const sql = await read(MIGRATION);
  assert.match(sql, /create or replace function private\.assert_emoji_cap/);
  assert.match(sql, /after insert on public\.community_emojis\s*\n\s*for each statement/);
});

test("one function answers usability for a body and for a reaction", async () => {
  const sql = await read(MIGRATION);
  // The send path and the reactions trigger must both ask the same question.
  const usableDefinitions = [...sql.matchAll(/create or replace function public\.community_emoji_usable/g)];
  assert.equal(usableDefinitions.length, 1, "one definition");
  assert.match(sql, /not public\.community_emoji_usable\(\(token\[1\]\)::uuid, actor, channel\)/, "the body asks it");
  assert.match(sql, /not public\.community_emoji_usable\(used, new\.user_id, new\.channel_id\)/, "the reaction asks it");

  // And whoever manages the emoji is never shut out of one they restricted.
  assert.match(sql, /'manage_emojis' = any\(resolved\.keys\)/);
});

test("the send path no longer refuses every custom emoji", async () => {
  const sql = await read(MIGRATION);
  assert.match(sql, /create or replace function public\.community_send_message/);
  // The phrase still appears in this file, in the comment explaining what was
  // replaced. What must be gone is the `raise` — an assertion that only knew
  // the phrase would have gone red for a comment and, worse, would have gone
  // green the day somebody reworded the exception.
  assert.doesNotMatch(sql, /raise exception 'Custom emoji are not available yet/, "the refusal no longer raises");
  // And the rollback puts it back, or rolling back would leave tokens that
  // resolve against a table that is no longer there.
  const down = await read(ROLLBACK);
  assert.match(down, /raise exception 'Custom emoji are not available yet/);
});

test("the reaction column is governed by one rule, not two", async () => {
  const sql = await read(MIGRATION);
  // A custom token is 41 to 71 characters; the old CHECK capped the column at
  // 32, so it refused every one of them whatever the validator said.
  assert.match(sql, /alter table public\.reactions drop constraint if exists reactions_emoji_check/);
  assert.match(sql, /check \(public\.community_reaction_token_is_valid\(emoji\)\)/);
  assert.ok(emojiToken({ id: "0f2a4d1e-8b6c-4d3e-9a1b-2c3d4e5f6a7b", name: "ok" }).length > 32);
});

test("the rollback takes the reactions before the table they point at", async () => {
  const down = await read(ROLLBACK);
  const reactionsGone = down.indexOf("delete from public.reactions");
  const tableGone = down.indexOf("drop table if exists public.community_emojis");
  assert.ok(reactionsGone >= 0 && reactionsGone < tableGone, "reactions first");
  // Bodies are left alone: they are what somebody wrote.
  assert.doesNotMatch(down, /update public\.posts/);
});

test("a name is cleaned into one the database will take, or refused", () => {
  assert.equal(parseEmojiName("Stoic Owl"), "stoic_owl");
  assert.equal(parseEmojiName("  stoic-owl  "), "stoic_owl");
  assert.equal(parseEmojiName("ST0IC_0WL"), "st0ic_0wl");
  assert.equal(parseEmojiName("owl!!!"), "owl");

  assert.throws(() => parseEmojiName("a"), /2 to 32 characters/);
  assert.throws(() => parseEmojiName(""), /2 to 32 characters/);
  assert.throws(() => parseEmojiName("!!!"), /2 to 32 characters/);
  assert.throws(() => parseEmojiName("x".repeat(33)), /2 to 32 characters/);

  assert.equal(isAllowedEmojiType("image/png"), true);
  assert.equal(isAllowedEmojiType("image/svg+xml"), false, "SVG can carry script; the bucket refuses it");
});

test("the token carries the id, so a rename never rewrites a message", () => {
  const id = "0f2a4d1e-8b6c-4d3e-9a1b-2c3d4e5f6a7b";
  assert.equal(emojiToken({ id, name: "stoic_owl" }), `<:stoic_owl:${id}>`);
  // The same shape the reaction validator and the send path both match on.
  assert.match(
    emojiToken({ id, name: "stoic_owl" }),
    /^<:[a-z0-9_]{2,32}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>$/,
  );
});
