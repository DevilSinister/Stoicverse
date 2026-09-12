import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { AUTOMOD_KINDS, AUTOMOD_LIMITS } from "../src/lib/community-settings/automod.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const MIGRATION = "supabase/migrations/20260912040000_community_automod.sql";
const ROLLBACK = "supabase/rollback/20260912040000_community_automod.down.sql";

test("compiled_pattern is written by the trigger and by nothing else", async () => {
  const migration = await read(MIGRATION);

  // The whole no-regex guarantee rests on this. If an RPC could assign
  // `compiled_pattern`, a moderator could hand the database a pattern to run
  // against every message anyone posts.
  const compileTrigger = migration.slice(migration.indexOf("function private.automod_rule_compile"));
  assert.match(compileTrigger, /new\.compiled_pattern :=/);

  const saveRpc = migration.slice(
    migration.indexOf("function public.community_automod_rule_save"),
    migration.indexOf("function public.community_automod_rule_delete"),
  );
  assert.equal(saveRpc.includes("compiled_pattern"), false);
});

test("the preset table has no DML policy, so only a migration writes it", async () => {
  const migration = await read(MIGRATION);
  assert.match(migration, /create policy community_automod_presets_read/);
  assert.equal(/create policy community_automod_presets_(insert|update|delete|write)/.test(migration), false);
  assert.match(
    migration,
    /revoke insert, update, delete, truncate on public\.community_automod_presets from anon, authenticated;/,
  );
});

test("the owner is exempt from every rule", async () => {
  const migration = await read(MIGRATION);
  const matcher = migration.slice(
    migration.indexOf("function private.automod_match"),
    migration.indexOf("function private.automod_evaluate"),
  );
  // A filter that can silence the owner can lock them out of the settings that
  // would switch it off.
  assert.match(matcher, /platform_role in \('influencer', 'super_admin'\)/);
});

test("matching writes nothing, because the block path raises", async () => {
  const migration = await read(MIGRATION);
  const matcher = migration.slice(
    migration.indexOf("function private.automod_match"),
    migration.indexOf("function private.automod_evaluate"),
  );
  // `automod_match` runs inside a BEFORE INSERT trigger that raises. Anything
  // it wrote would be rolled back by that raise, so it must not write.
  assert.equal(/\binsert into\b/.test(matcher), false);
  assert.equal(/\bupdate public\./.test(matcher), false);
  assert.match(matcher, /^stable$/m);
});

test("the recording half runs after the insert, so an alert can name the post", async () => {
  const migration = await read(MIGRATION);
  assert.match(migration, /create trigger posts_automod_record\nafter insert on public\.posts/);
  const evaluate = migration.slice(
    migration.indexOf("function private.automod_evaluate"),
    migration.indexOf("function private.assert_post_content_allowed"),
  );
  assert.match(evaluate, /insert into public\.community_automod_alerts/);
});

test("every AutoMod kind in the database exists in the TypeScript model", async () => {
  const migration = await read(MIGRATION);
  const kindCheck = migration.match(/kind text not null check \(kind in \(([^)]+)\)\)/);
  assert.ok(kindCheck, "the kind CHECK was not found");
  const sqlKinds = [...kindCheck[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
  assert.deepEqual(sqlKinds.sort(), [...AUTOMOD_KINDS].sort());
});

test("the rule cap and the numeric bounds agree with the model", async () => {
  const migration = await read(MIGRATION);
  assert.match(migration, new RegExp(`existing_count >= ${AUTOMOD_LIMITS.rules}`));
  assert.match(
    migration,
    new RegExp(`mention_limit between ${AUTOMOD_LIMITS.mentionLimit.min} and ${AUTOMOD_LIMITS.mentionLimit.max}`),
  );
  assert.match(
    migration,
    new RegExp(
      `timeout_seconds between ${AUTOMOD_LIMITS.timeoutSeconds.min} and ${AUTOMOD_LIMITS.timeoutSeconds.max}`,
    ),
  );
  assert.match(
    migration,
    new RegExp(
      `duplicate_count between ${AUTOMOD_LIMITS.duplicateCount.min} and ${AUTOMOD_LIMITS.duplicateCount.max}`,
    ),
  );
});

test("a timeout cannot be configured without a block", async () => {
  const migration = await read(MIGRATION);
  assert.match(
    migration,
    /community_automod_rules_timeout_needs_block check \(\s*timeout_seconds is null or action_block/,
  );
});

test("the blocked word list is converted before it is dropped", async () => {
  const migration = await read(MIGRATION);
  const conversion = migration.indexOf("insert into public.community_automod_rules (name, kind, enabled, keywords");
  const drop = migration.indexOf("drop table if exists public.community_blocked_words");
  assert.ok(conversion > 0, "the conversion was not found");
  assert.ok(drop > conversion, "the phrases must move into a rule before the table is dropped");
});

test("the rollback restores what the migration removed", async () => {
  const rollback = await read(ROLLBACK);
  assert.match(rollback, /create table if not exists public\.community_blocked_words/);
  assert.match(rollback, /add column if not exists blocked_word_mode/);
  assert.match(rollback, /add column if not exists blocked_word_match/);
  // The pre-AutoMod trigger body has to come back, or posting would keep
  // calling functions this rollback drops.
  assert.match(rollback, /create or replace function private\.assert_post_content_allowed/);
  assert.match(rollback, /from public\.community_blocked_words/);
  // And it must say plainly what cannot be restored.
  assert.match(rollback, /This loses data/);
});

test("the follow-up that made the audit actor nullable is paired and explained", async () => {
  const migration = await read("supabase/migrations/20260912040001_community_moderation_events_automod_actor.sql");
  const rollback = await read("supabase/rollback/20260912040001_community_moderation_events_automod_actor.down.sql");
  // AutoMod has no actor. Attributing its events to the influencer would put a
  // person's name against something no person did.
  assert.match(migration, /alter column actor_id drop not null/);
  assert.match(rollback, /alter column actor_id set not null/);
  assert.match(rollback, /delete from public\.community_moderation_events where actor_id is null/);
});
