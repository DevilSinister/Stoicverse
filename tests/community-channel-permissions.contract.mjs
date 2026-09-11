import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { CHANNEL_TYPES, formatSlowMode, parseSlowMode } from "../src/lib/community-settings/model.ts";
import {
  CHANNEL_PERMISSION_KEYS,
  isEmptyOverride,
  parseOverrideGrid,
  resolveChannelPermissions,
} from "../src/lib/community-settings/permissions.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const MIGRATION = "supabase/migrations/20260912020000_community_channel_permissions.sql";
const ROLLBACK = "supabase/rollback/20260912020000_community_channel_permissions.down.sql";

/** The migration with every comment line removed, for assertions about statements. */
async function statements() {
  const sql = await read(MIGRATION);
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

test("posts carries exactly one INSERT policy and it is permission-driven", async () => {
  const sql = await statements();

  // The whole phase exists for this line.
  assert.match(sql, /drop policy if exists posts_staff_insert on public\.posts;/);
  assert.match(sql, /create policy posts_member_insert\s*\non public\.posts\s*\nfor insert/);
  assert.match(sql, /public\.community_has\('send_messages', channel_id\)/);

  const inserts = [...sql.matchAll(/create policy (\w+)\s*\non public\.posts\s*\nfor insert/g)];
  assert.equal(inserts.length, 1, "posts must carry exactly one INSERT policy");
  assert.equal(inserts[0][1], "posts_member_insert");
});

test("no policy this migration writes falls back to a platform role", async () => {
  const sql = await statements();

  // A single is_staff() left behind is a surface where permissions do not apply.
  const created = sql.match(/create policy[\s\S]*?;\n/g) ?? [];
  assert.ok(created.length >= 8, `expected the policy switch, found ${created.length} policies`);
  for (const body of created) {
    assert.doesNotMatch(body, /is_staff\(\)/, `a policy still gates on is_staff(): ${body.slice(0, 90)}`);
    assert.doesNotMatch(body, /is_influencer\(\)/, `a policy still gates on is_influencer(): ${body.slice(0, 90)}`);
  }
});

test("an override targets exactly one thing and cannot allow and deny the same key", async () => {
  const sql = await statements();

  assert.match(sql, /check \(num_nonnulls\(channel_id, category_id\) = 1\)/);
  assert.match(sql, /check \(not \(allow && deny\)\)/);
  // Community-scoped keys are not overridable: `ban_members` in one channel and
  // not another is not something anyone should be able to express.
  assert.match(sql, /check \(allow <@ public\.community_channel_permission_keys\(\)\)/);
  assert.match(sql, /check \(deny <@ public\.community_channel_permission_keys\(\)\)/);

  assert.match(
    sql,
    /unique index if not exists channel_permission_overrides_channel_role_idx[\s\S]*?where channel_id is not null/,
  );
  assert.match(
    sql,
    /unique index if not exists channel_permission_overrides_category_role_idx[\s\S]*?where category_id is not null/,
  );
});

test("the resolver applies denies before allows, @everyone before roles", async () => {
  const sql = await statements();

  // Order is the whole contract. The four assignments must appear in the
  // sequence the TypeScript mirror implements.
  const block = sql.slice(sql.indexOf("perms := base;"));
  const everyoneDeny = block.indexOf("everyone_deny");
  const everyoneAllow = block.indexOf("everyone_allow");
  const roleDeny = block.indexOf("role_deny");
  const roleAllow = block.indexOf("role_allow");

  assert.ok(everyoneDeny > -1 && everyoneAllow > everyoneDeny, "@everyone allow must follow @everyone deny");
  assert.ok(roleDeny > everyoneAllow, "role denies must follow the @everyone level");
  assert.ok(roleAllow > roleDeny, "role allows must follow role denies");
});

test("a synced channel reads its category's overrides and never both", async () => {
  const sql = await statements();

  // One case expression decides the source. Two independent lookups would let a
  // channel pick up its category's rules and its own at the same time.
  assert.match(
    sql,
    /case when channel_row\.permissions_synced\s*\n\s*then override\.category_id = channel_row\.category_id\s*\n\s*else override\.channel_id = channel_row\.id end/,
  );
});

test("legacy tier and role gates are converted, not silently dropped", async () => {
  const sql = await statements();

  assert.match(sql, /where channel\.legacy_type = 'master'/);
  assert.match(sql, /where channel\.min_tier > 1/);
  assert.match(sql, /where not \('member' = any\(channel\.allowed_roles\)\)/);
  // A converted channel must stop following its category, or the conversion is
  // written and then ignored.
  assert.match(sql, /set permissions_synced = false/);
});

test("channel types lose master and gain rules, in both layers", async () => {
  const sql = await statements();

  assert.match(sql, /check \(type in \('text', 'announcements', 'events', 'rules'\)\)/);
  assert.match(sql, /update public\.channels set type = 'text' where type = 'master';/);
  assert.deepEqual([...CHANNEL_TYPES], ["text", "announcements", "events", "rules"]);
});

test("slow mode moves to the channel and the community column is dropped", async () => {
  const sql = await statements();

  assert.match(sql, /check \(slow_mode_seconds between 0 and 21600\)/);
  assert.match(sql, /alter table public\.community_settings drop column if exists slow_mode_seconds;/);
  // Seeded from the value that was in force, so nobody's pacing changes.
  assert.match(
    sql,
    /set slow_mode_seconds = coalesce\(\(select slow_mode_seconds from public\.community_settings limit 1\), 0\)/,
  );
});

test("the overrides table has no DML policy and is revoked besides", async () => {
  const sql = await statements();

  const policies = [
    ...sql.matchAll(/create policy (\w+)\s*\non public\.channel_permission_overrides\s*\nfor (\w+)/g),
  ];
  assert.deepEqual(
    policies.map((match) => match[2]),
    ["select"],
  );
  assert.match(
    sql,
    /revoke insert, update, delete, truncate on public\.channel_permission_overrides from anon, authenticated;/,
  );
});

test("every function this migration grants is revoked from PUBLIC and anon first", async () => {
  const sql = await statements();

  for (const match of sql.matchAll(/grant execute on function (public|private)\.(\w+)\(/g)) {
    const name = `${match[1]}\\.${match[2]}`;
    assert.match(
      sql,
      new RegExp(`revoke execute on function ${name}\\([^)]*\\) from public, anon`),
      `${match[1]}.${match[2]} is granted without first revoking from PUBLIC and anon`,
    );
  }
});

test("the rollback restores posts_staff_insert and refuses to run under phase 4", async () => {
  const rollback = await read(ROLLBACK);

  assert.match(rollback, /refusing to roll back: phase 4/);
  assert.match(rollback, /create policy posts_staff_insert/);
  assert.match(rollback, /public\.is_staff\(\)/);
  assert.match(rollback, /drop table if exists public\.channel_permission_overrides;/);
  // `legacy_type` is the only reason `master` is recoverable.
  assert.match(rollback, /update public\.channels set type = 'master' where legacy_type = 'master';/);
  assert.match(rollback, /DATA LOSS/);
});

test("parseOverrideGrid keeps Neutral out of both arrays", () => {
  const grid = { view_channel: "allow", send_messages: "deny", add_reactions: "neutral", not_a_key: "allow" };
  const { allow, deny } = parseOverrideGrid(grid);

  assert.deepEqual(allow, ["view_channel"]);
  assert.deepEqual(deny, ["send_messages"]);
  // Neutral is the absence of an entry, and an unknown key is dropped exactly
  // as the CHECK constraint drops it.
  assert.ok(!allow.includes("add_reactions") && !deny.includes("add_reactions"));
  assert.equal(allow.length + deny.length, 2);
});

test("an all-Neutral grid is an empty override, which is how a row gets deleted", () => {
  const grid = Object.fromEntries(CHANNEL_PERMISSION_KEYS.map((key) => [key, "neutral"]));
  assert.ok(isEmptyOverride(parseOverrideGrid(grid)));
  assert.ok(!isEmptyOverride(parseOverrideGrid({ ...grid, view_channel: "deny" })));
});

test("a private channel is @everyone denied view_channel plus a role allow", () => {
  const everyone = "everyone";
  const base = ["view_channel", "read_message_history", "add_reactions"];

  // Denied for a member holding no other role...
  assert.deepEqual(
    resolveChannelPermissions({
      base,
      everyoneRoleId: everyone,
      memberRoleIds: [],
      overrides: [{ roleId: everyone, allow: [], deny: ["view_channel"] }],
    }),
    [],
  );

  // ...and open for one holding the allowed role.
  const allowed = resolveChannelPermissions({
    base,
    everyoneRoleId: everyone,
    memberRoleIds: ["inner"],
    overrides: [
      { roleId: everyone, allow: [], deny: ["view_channel"] },
      { roleId: "inner", allow: ["view_channel"], deny: [] },
    ],
  });
  assert.ok(allowed.includes("view_channel"));
  assert.ok(allowed.includes("read_message_history"));
});

test("a rules channel strips the send permissions from everyone but a manager", () => {
  const everyone = "everyone";
  const base = ["view_channel", "read_message_history", "send_messages", "create_threads"];

  const member = resolveChannelPermissions({
    base,
    everyoneRoleId: everyone,
    memberRoleIds: [],
    overrides: [],
    channelType: "rules",
  });
  assert.ok(member.includes("read_message_history"));
  assert.ok(!member.includes("send_messages"));
  assert.ok(!member.includes("create_threads"));

  const manager = resolveChannelPermissions({
    base: [...base, "manage_channels"],
    everyoneRoleId: everyone,
    memberRoleIds: [],
    overrides: [],
    channelType: "rules",
  });
  assert.ok(manager.includes("send_messages"));
});

test("slow mode parses to its bounds and reads as a duration", () => {
  assert.equal(parseSlowMode("0"), 0);
  assert.equal(parseSlowMode(21600), 21600);
  assert.throws(() => parseSlowMode(21601), /0 seconds \(off\) and 6 hours/);
  assert.throws(() => parseSlowMode(-1), /0 seconds \(off\) and 6 hours/);
  assert.throws(() => parseSlowMode("soon"), /0 seconds \(off\) and 6 hours/);

  assert.equal(formatSlowMode(0), "Off");
  assert.equal(formatSlowMode(30), "30s");
  assert.equal(formatSlowMode(600), "10m");
  assert.equal(formatSlowMode(21600), "6h");
});
