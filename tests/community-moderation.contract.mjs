import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CASE_KINDS,
  REPORT_REASONS,
  REPORT_STATUSES,
  SANCTION_LIMITS,
  formatDuration,
  parseModerationReason,
  parseTimeoutDuration,
} from "../src/lib/community-settings/model.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const MIGRATION = "supabase/migrations/20260912030000_community_moderation_cases.sql";
const ROLLBACK = "supabase/rollback/20260912030000_community_moderation_cases.down.sql";

async function statements() {
  const sql = await read(MIGRATION);
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

/** The body between `function public.<name>(` and the closing `$$;`. */
function functionBody(sql, name) {
  const start = sql.indexOf(`function public.${name}(`);
  assert.ok(start > -1, `${name} is not in the migration`);
  const end = sql.indexOf("$$;", start);
  return sql.slice(start, end);
}

test("a ban is community-scoped and touches neither suspension nor the subscription", async () => {
  const sql = await statements();
  const body = functionBody(sql, "community_ban_member");

  // The whole point of a community ban is that it is not an account
  // suspension: the member keeps the courses and events they paid for, and
  // ending a subscription stays a separate, deliberate act.
  assert.doesNotMatch(body, /is_suspended/);
  assert.doesNotMatch(body, /memberships/);
  assert.match(body, /assert_can_sanction\(actor, target, 'ban_members'\)/);
});

test("one live ban per member, and a timeout is the only kind that expires", async () => {
  const sql = await statements();

  assert.match(
    sql,
    /unique index if not exists community_mod_cases_one_active_ban_idx[\s\S]*?where kind = 'ban' and revoked_at is null/,
  );
  // A biconditional, not an implication: a ban cannot carry an expiry nothing
  // reads, and a timeout cannot be issued that never ends.
  assert.match(sql, /check \(\(kind = 'timeout'\) = \(expires_at is not null\)\)/);
  assert.match(sql, /check \(duration_seconds is null or duration_seconds between 60 and 2419200\)/);
});

test("the gate gains banned and timeout, ordered by how much access each costs", async () => {
  const sql = await statements();
  const gate = sql.slice(sql.indexOf("function private.community_gate("));

  const suspended = gate.indexOf("'suspended'");
  const banned = gate.indexOf("'banned'");
  const timedOut = gate.indexOf("'timeout'");
  assert.ok(suspended > -1 && banned > suspended, "suspension must outrank a community ban");
  assert.ok(timedOut > banned, "a ban must outrank a timeout");

  // A lifted or expired sanction is not a sanction.
  assert.match(gate, /kind = 'ban' and revoked_at is null/);
  assert.match(gate, /kind = 'timeout' and revoked_at is null and expires_at > now\(\)/);
});

test("the case and report tables have no DML policy and are revoked besides", async () => {
  const sql = await statements();

  for (const table of ["community_mod_cases", "community_message_reports"]) {
    const policies = [
      ...sql.matchAll(new RegExp(`create policy (\\w+)\\s*\\non public\\.${table}\\s*\\nfor (\\w+)`, "g")),
    ];
    assert.deepEqual(
      policies.map((match) => match[2]),
      ["select"],
      `${table} carries a policy that is not a SELECT`,
    );
    assert.match(
      sql,
      new RegExp(`revoke insert, update, delete, truncate on public\\.${table} from anon, authenticated;`),
    );
  }
});

test("a member reads what was done to them, but never a moderator's private note", async () => {
  const sql = await statements();
  assert.match(sql, /subject_id = \(select auth\.uid\(\)\) and kind <> 'note'/);
});

test("the audit CHECK covers every action the new RPCs write", async () => {
  const sql = await statements();
  const check = sql.match(/community_moderation_events_action_check\s*\n?\s*check \(action in \(([\s\S]*?)\)\)/);
  assert.ok(check, "the action CHECK is not recognisable");

  // Every `action` literal the migration inserts must be in the CHECK, or the
  // RPC that writes it fails at runtime rather than here.
  for (const match of sql.matchAll(/'(bulk_delete|warn|timeout|untimeout|ban|unban|report_resolved)'/g)) {
    assert.match(check[1], new RegExp(`'${match[1]}'`), `${match[1]} is written but not permitted`);
  }
});

test("every sanction goes through one hierarchy check that spares the owner", async () => {
  const sql = await statements();

  const shared = sql.slice(sql.indexOf("function private.assert_can_sanction("));
  assert.match(shared, /target_platform in \('influencer', 'super_admin'\)/);
  assert.match(shared, /community_highest_position\(target\) >= public\.community_highest_position\(actor\)/);
  assert.match(shared, /actor = target/);

  for (const rpc of ["community_warn_member", "community_timeout_member", "community_ban_member"]) {
    assert.match(functionBody(sql, rpc), /assert_can_sanction/, `${rpc} does not use the shared guard`);
  }
});

test("reports are rate limited and cannot be filed on an invisible message", async () => {
  const sql = await statements();

  assert.match(sql, />= 20 then/);
  assert.match(sql, /unique \(post_id, reporter_id\)/);
  const report = functionBody(sql, "community_report_message");
  assert.match(report, /community_has\('view_channel', target\.channel_id\)/);
  assert.match(report, /target\.author_id = reporter/);
});

test("bulk delete records each message separately, with the body as it was", async () => {
  const sql = await statements();
  const body = functionBody(sql, "community_bulk_delete_messages");

  // "They deleted forty messages" is not a record of anything.
  assert.match(body, /'bulk_delete', clean_reason, target\.body/);
  assert.match(body, /cardinality\(post_ids\) > 100/);
  assert.match(body, /rules\.delete_requires_reason and clean_reason is null/);
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

test("the migration reloads the schema cache", async () => {
  const sql = await statements();
  // Two new tables and a changed function signature. Without this the API keeps
  // answering for the old schema — the phase 3 incident.
  assert.match(sql, /notify pgrst, 'reload schema';/);
});

test("the rollback says what it destroys and refuses to run under phase 5", async () => {
  const rollback = await read(ROLLBACK);

  assert.match(rollback, /refusing to roll back: phase 5/);
  assert.match(rollback, /DATA LOSS/);
  assert.match(rollback, /drop table if exists public\.community_mod_cases;/);
  // Going back leaves the restored CHECK no room for the person-scoped
  // actions, so the rollback has to say that it deletes them.
  assert.match(rollback, /delete from public\.community_moderation_events/);
});

test("the server actions relay database messages rather than inventing their own", async () => {
  const actions = await read("src/app/community/moderation-actions.ts");

  // P0001 is this project's passthrough for text written for the reader; a
  // hand-written fallback that swallowed it would hide the real reason.
  assert.match(actions, /postgresMessage/);
  assert.doesNotMatch(actions, /\.error\.message/);
  for (const rpc of [
    "community_warn_member",
    "community_timeout_member",
    "community_ban_member",
    "community_bulk_delete_messages",
    "community_report_resolve",
  ]) {
    assert.match(actions, new RegExp(rpc), `${rpc} has no action behind it`);
  }
});

test("the model mirrors the database vocabulary exactly", () => {
  assert.deepEqual([...CASE_KINDS], ["warn", "timeout", "untimeout", "ban", "unban", "note"]);
  assert.deepEqual([...REPORT_REASONS], ["spam", "harassment", "hate", "sexual", "scam", "other"]);
  assert.deepEqual([...REPORT_STATUSES], ["open", "resolved", "dismissed"]);
  assert.equal(SANCTION_LIMITS.duration.min, 60);
  assert.equal(SANCTION_LIMITS.duration.max, 2419200);
});

test("a timeout is bounded at both ends", () => {
  assert.equal(parseTimeoutDuration(60), 60);
  assert.equal(parseTimeoutDuration("2419200"), 2419200);
  assert.throws(() => parseTimeoutDuration(59), /1 minute and 28 days/);
  assert.throws(() => parseTimeoutDuration(2419201), /1 minute and 28 days/);
  assert.throws(() => parseTimeoutDuration("a while"), /1 minute and 28 days/);
});

test("a reason is required where the database requires one, and optional where it does not", () => {
  assert.equal(parseModerationReason("  spamming the channel  "), "spamming the channel");
  assert.throws(() => parseModerationReason(""), /between 3 and 500/);
  assert.throws(() => parseModerationReason("no"), /between 3 and 500/);
  assert.throws(() => parseModerationReason("x".repeat(501)), /between 3 and 500/);
  // Undoing a sanction needs no justification; the record of the undo is enough.
  assert.equal(parseModerationReason("", { required: false }), null);
  assert.equal(parseModerationReason(undefined, { required: false }), null);
});

test("a duration reads as the unit a person would say", () => {
  assert.equal(formatDuration(60), "1 minute");
  assert.equal(formatDuration(600), "10 minutes");
  assert.equal(formatDuration(3600), "1 hour");
  assert.equal(formatDuration(86400), "1 day");
  assert.equal(formatDuration(604800), "7 days");
});
