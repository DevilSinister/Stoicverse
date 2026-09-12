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

test("composer and reaction rules are platform constants with exactly one definition", async () => {
  const [types, actions, model, constants, composer, stream, picker, migration] = await Promise.all([
    read("src/components/community/types.ts"),
    read("src/app/community/actions.ts"),
    read("src/lib/community-settings/model.ts"),
    read("src/lib/community/constants.ts"),
    read("src/components/community/MessageComposer.tsx"),
    read("src/components/community/MessageStream.tsx"),
    read("src/components/community/emoji/EmojiPicker.tsx"),
    read("supabase/migrations/20260912000000_community_global_composer_constants.sql"),
  ]);

  // Three copies of the quick-pick literal once existed. Now it lives in the
  // constants module and nowhere else; the settings model no longer knows it,
  // and its one consumer is the picker's fallback for "Frequently used".
  assert.match(constants, /export const QUICK_REACTIONS/);
  assert.doesNotMatch(model, /REACTION_PALETTE|CommunityComposer|parseComposer/);
  assert.doesNotMatch(types, /"🚀"|REACTION_OPTIONS/);
  assert.doesNotMatch(actions, /"🚀"/);
  assert.match(picker, /QUICK_REACTIONS/);

  // One picker, rendered by both the composer and the reaction bar — no more
  // twelve-button grids of their own.
  for (const source of [composer, stream]) {
    assert.match(source, /<EmojiPicker/);
    assert.doesNotMatch(source, /REACTION_OPTIONS/);
  }

  // The composer reads the constants rather than carrying its own numbers.
  assert.doesNotMatch(composer, /const MAX_BODY = 10_000|20 \* 1024 \* 1024/);
  assert.match(composer, /isAllowedAttachmentType\(candidate\.type\)/, "type is checked in attach(), not accept=");

  // The per-community columns are gone, the dead RPC with them, and the
  // reaction predicate is a format check whose USING clause still ignores it.
  assert.match(migration, /drop column if exists reaction_emojis/);
  assert.match(migration, /drop function if exists public\.community_composer_rules\(\)/);
  assert.match(migration, /file_size_limit = 26214400/);
  const policyStart = migration.indexOf("create policy reactions_own_write");
  const policy = migration.slice(policyStart, migration.indexOf(";", migration.indexOf("with check (", policyStart)));
  const using = policy.slice(policy.indexOf("using ("), policy.indexOf("with check ("));
  const withCheck = policy.slice(policy.indexOf("with check ("));
  assert.match(withCheck, /community_reaction_token_is_valid\(reactions\.emoji\)/);
  assert.doesNotMatch(using, /community_reaction_token_is_valid/);
  // The trigger no longer reads dropped columns.
  const trigger = migration.slice(migration.indexOf("create or replace function private.assert_post_content_allowed"));
  assert.doesNotMatch(trigger, /max_body_length|allow_links|allow_attachments/);
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

test("the 2026-09-11 grant system was a union, never a deny list", async () => {
  // Superseded by phase 2 (20260912010000), which introduces per-channel
  // Allow/Neutral/Deny overrides under a fixed precedence. This keeps asserting
  // what the earlier migration says — that file does not change — and the
  // reasoning below is why the new denies are confined to channel scope.
  const migration = await read("supabase/migrations/20260911020000_community_role_permissions.sql");

  // A union is monotone, so "why can this person do X" always has a one-hop
  // answer. Denies turn it into an ordering problem with no good answer.
  assert.match(migration, /create or replace function public\.community_grant\(grant_key text\)/);
  assert.doesNotMatch(migration, /deny|revoke_grant|permission_denies/i);

  // @all and manage_channels must not be in the moderator baseline.
  const baseline = migration.match(/grant_key in \(([^)]*)\)/);
  assert.ok(baseline, "the moderator baseline is not recognisable");
  assert.doesNotMatch(baseline[1], /mention_all/);
  assert.doesNotMatch(baseline[1], /manage_channels/);

  // Every function here pins its search_path. The security advisor flagged both
  // immutable ones for a mutable path on apply, and one of them backs a CHECK
  // constraint. Count the pins against the function definitions.
  const definitions = migration.match(/create or replace function/g) ?? [];
  const pinned = migration.match(/set search_path to 'public', 'pg_temp'/g) ?? [];
  assert.equal(pinned.length, definitions.length);
});

test("the enforcing mention regex has exactly one definition", async () => {
  const migration = await read("supabase/migrations/20260911020000_community_role_permissions.sql");

  // Two copies in the database and you get posts accepted that notify nobody,
  // or refused that would have notified everybody. Both the notifier and the
  // write-time gate must call the shared function.
  assert.match(migration, /create or replace function public\.community_mention_kind/);
  assert.match(migration, /kind text := public\.community_mention_kind\(body_text\)/);
  assert.match(migration, /mention := public\.community_mention_kind\(new\.body\)/);

  // The @all literal appears once: inside community_mention_kind itself. The
  // notifier keeps a per-tier match because it interpolates each member's tier,
  // but it must not carry a second @all pattern.
  const atAll = migration.match(/@all\(\[\^\[:alnum:\]_\]\|\$\)/g) ?? [];
  assert.equal(atAll.length, 1);
});

test("blocked words are literal phrases, never user-supplied regex", async () => {
  const migration = await read("supabase/migrations/20260911030000_community_moderation_engine.sql");

  // A user regex evaluated on every insert is a denial-of-service aimed at
  // your own database, so the phrase is escaped before it reaches a match.
  assert.match(migration, /regexp_replace\(btrim\(phrase\)/);
  assert.match(migration, /char_length\(btrim\(phrase\)\) between 2 and 60/);
  // Staff-only read: the definer trigger still checks posts against rows the
  // member cannot see, which is the point.
  assert.match(migration, /create policy community_blocked_words_staff_read/);
  assert.match(migration, /using \(public\.is_staff\(\)\)/);
});

test("slow mode takes an advisory lock, or two concurrent posts both pass", async () => {
  const migration = await read("supabase/migrations/20260911030000_community_moderation_engine.sql");

  // Without the lock both inserts read the same max(created_at) and both clear
  // the check.
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /tg_op = 'INSERT'/);
  // The edit window is an UPDATE-only rule.
  assert.match(migration, /tg_op = 'UPDATE'/);
  assert.match(migration, /slow_mode_seconds between 0 and 21600/);
});

test("the keyword matcher agrees with the SQL on both modes", async () => {
  // Blocked words became AutoMod rules in 20260912040000, so the mirror this
  // asserts moved from model.ts to automod.ts along with them. The invariant
  // did not change: both sides use the same word-boundary class.
  const [migration, automod] = await Promise.all([
    read("supabase/migrations/20260912040000_community_automod.sql"),
    read("src/lib/community-settings/automod.ts"),
  ]);

  // Word mode uses [^[:alnum:]_] boundaries in SQL, and the JS mirror rewrites
  // the POSIX class rather than reaching for , which would treat accented
  // letters differently and make the "test a sentence" box disagree with what
  // happens on save.
  assert.match(migration, /\[\^\[:alnum:\]_\]/);
  assert.match(automod, /\[\^\[:alnum:\]_\]/);
  assert.match(automod, /replaceAll\("\[:alnum:\]", "0-9A-Za-z"\)/);
});
