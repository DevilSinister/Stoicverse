import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("community identity is its own table, never a widening of platform_settings", async () => {
  const migration = await read("supabase/migrations/20260911000000_community_settings_identity.sql");

  assert.match(migration, /create table if not exists public\.community_settings/);
  // platform_settings is anon-readable and holds membership_fee and
  // influencer_id. The only write this migration makes to it is through a
  // definer function that touches one column.
  assert.doesNotMatch(migration, /on public\.platform_settings/);
  assert.match(migration, /update public\.platform_settings set community_name/);
});

test("the settings singleton can be read and updated but never created or destroyed", async () => {
  const migration = await read("supabase/migrations/20260911000000_community_settings_identity.sql");

  assert.match(migration, /create policy community_settings_member_read/);
  assert.match(migration, /create policy community_settings_influencer_update/);
  // Absence is denial, and the explicit revoke is required because Supabase's
  // default privileges re-grant DML on every public table regardless.
  assert.doesNotMatch(migration, /create policy community_settings_\w*insert/);
  assert.doesNotMatch(migration, /create policy community_settings_\w*delete/);
  assert.match(migration, /revoke insert, delete on public\.community_settings from anon, authenticated;/);
  assert.match(migration, /id\s+boolean primary key default true check \(id\)/);
});

test("the branding projection is a definer function, not a policy on the table", async () => {
  const migration = await read("supabase/migrations/20260911000000_community_settings_identity.sql");

  assert.match(migration, /create or replace function public\.community_branding\(\)/);
  assert.match(migration, /security definer/);
  assert.match(migration, /grant execute on function public\.community_branding\(\) to anon, authenticated;/);
  // A SELECT policy for anon would publish every column, including any added later.
  assert.doesNotMatch(migration, /to anon\s*\n?\s*using \(true\)/);
});

test("renaming the community is gated, bounded, and reaches one column", async () => {
  const migration = await read("supabase/migrations/20260911000000_community_settings_identity.sql");

  assert.match(migration, /create or replace function public\.set_community_name\(new_name text\)/);
  assert.match(migration, /public\.is_influencer\(\) or public\.is_super_admin\(\)/);
  assert.match(migration, /between 2 and 60 characters/);
  // From PUBLIC, not only from anon: functions grant EXECUTE to PUBLIC by
  // default and anon inherits it, so the anon-only revoke is a no-op that reads
  // like a gate. The security advisor caught this on apply.
  assert.match(migration, /revoke execute on function public\.set_community_name\(text\) from public;/);
  assert.match(migration, /revoke execute on function public\.set_community_name\(text\) from anon;/);
});

test("every migration in this feature ships a committed rollback", async () => {
  const rollback = await read("supabase/rollback/20260911000000_community_settings_identity.down.sql");

  assert.match(rollback, /drop table if exists public\.community_settings;/);
  assert.match(rollback, /drop function if exists public\.set_community_name\(text\);/);
  // Dropping a bucket deletes its objects, including an uploaded logo.
  assert.doesNotMatch(rollback, /delete from storage\.buckets/);
});

test("the validator's bounds are the database's bounds", async () => {
  const [migration, model] = await Promise.all([
    read("supabase/migrations/20260911000000_community_settings_identity.sql"),
    read("src/lib/community-settings/model.ts"),
  ]);

  // A limit that drifts turns a legible message into a raw 23514 check violation.
  assert.match(migration, /char_length\(tagline\) <= 140/);
  assert.match(model, /tagline: \{ max: 140 \}/);
  assert.match(migration, /char_length\(welcome_message\) <= 2000/);
  assert.match(model, /welcomeMessage: \{ max: 2000 \}/);
  assert.match(migration, /char_length\(rules\) <= 10000/);
  assert.match(model, /rules: \{ max: 10000 \}/);
  // The bucket ceiling and the client-side check must agree.
  assert.match(migration, /2097152/);
  assert.match(model, /logoBytes: 2 \* 1024 \* 1024/);
});

test("composer rules are database predicates, not client-side suggestions", async () => {
  const migration = await read("supabase/migrations/20260911010000_community_composer_rules.sql");

  // The emoji set belongs in WITH CHECK only. In USING it would hide reactions
  // already placed the moment an emoji was turned off, and stop members taking
  // their own reaction back.
  assert.match(migration, /with check \(/);
  const withCheck = migration.slice(migration.indexOf("with check ("));
  assert.match(withCheck, /reactions\.emoji = any \(cs\.reaction_emojis\)/);
  const using = migration.slice(migration.indexOf("for all"), migration.indexOf("with check ("));
  assert.doesNotMatch(using, /reaction_emojis/);

  // Length, links and attachments are a trigger in `private`, which
  // `authenticated` has no USAGE on.
  assert.match(migration, /create or replace function private\.assert_post_content_allowed/);
  assert.match(migration, /before insert or update of body, image_url on public\.posts/);
  // The hard ceiling is added NOT VALID then validated, so it never holds
  // ACCESS EXCLUSIVE for a full scan.
  assert.match(migration, /check \(char_length\(body\) <= 10000\) not valid/);
  assert.match(migration, /validate constraint posts_body_length_check/);
});

test("the emoji palette has exactly one definition", async () => {
  const [types, actions, model] = await Promise.all([
    read("src/components/community/types.ts"),
    read("src/app/community/actions.ts"),
    read("src/lib/community-settings/model.ts"),
  ]);

  // Three copies of this literal existed; a creator disabling an emoji would
  // have been overruled by whichever copy the caller happened to read.
  assert.match(model, /export const REACTION_PALETTE/);
  assert.doesNotMatch(types, /"🚀"/);
  assert.doesNotMatch(actions, /"🚀"/);
  assert.match(types, /REACTION_PALETTE as REACTION_OPTIONS/);
});

test("identity writes hard-fail and name the outstanding migration", async () => {
  const actions = await read("src/app/creator/settings/actions.ts");

  // Reads degrade to defaults; a write that silently no-ops would lose what the
  // creator typed.
  assert.match(actions, /20260911000000/);
  assert.match(actions, /set_community_name/);

  // Every Supabase error goes through postgresMessage, which drops all but the
  // one SQLSTATE we raise deliberately. `.error.message` is the shape of a
  // passthrough leak — column, constraint and policy names reaching the client.
  // The validator's own thrown message is a different thing and is meant to be
  // read, so this asserts the qualified form rather than the bare word.
  assert.match(actions, /postgresMessage/);
  assert.doesNotMatch(actions, /\.error\.message/);
});
