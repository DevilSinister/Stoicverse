import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DEFAULT_COMMUNITY_SAFETY,
  parseSafety,
  SAFETY_LIMITS,
  VERIFICATION_LEVELS,
} from "../src/lib/community-settings/model.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const MIGRATION = "supabase/migrations/20260912160000_community_safety_gates.sql";
const ROLLBACK = "supabase/rollback/20260912160000_community_safety_gates.down.sql";

test("the safety bounds are the ones the database enforces", async () => {
  const sql = await read(MIGRATION);

  assert.match(
    sql,
    new RegExp(
      `verification_minutes between ${SAFETY_LIMITS.verificationMinutes.min} and ${SAFETY_LIMITS.verificationMinutes.max}`,
    ),
  );
  assert.match(
    sql,
    new RegExp(`join_rate_limit between ${SAFETY_LIMITS.joinRateLimit.min} and ${SAFETY_LIMITS.joinRateLimit.max}`),
  );
  assert.match(
    sql,
    new RegExp(
      `join_rate_window_minutes between ${SAFETY_LIMITS.joinRateWindowMinutes.min} and ${SAFETY_LIMITS.joinRateWindowMinutes.max}`,
    ),
  );
  assert.match(
    sql,
    new RegExp(`lockdown_minutes between ${SAFETY_LIMITS.lockdownMinutes.min} and ${SAFETY_LIMITS.lockdownMinutes.max}`),
  );

  for (const level of VERIFICATION_LEVELS) {
    assert.match(sql, new RegExp(`'${level.value}'`), `${level.value} is a level the CHECK allows`);
  }

  // The shipped defaults have to be the off position. A migration that turned
  // a gate on as it applied would lock a live community out of its own
  // channels before anybody had chosen anything.
  assert.equal(DEFAULT_COMMUNITY_SAFETY.verificationLevel, "none");
  assert.equal(DEFAULT_COMMUNITY_SAFETY.joinRateLimit, 0);
  assert.match(sql, /verification_level text not null default 'none'/);
  assert.match(sql, /join_rate_limit int not null default 0/);
});

test("the rules channel is checked by a trigger, because a CHECK cannot read another table", async () => {
  const sql = await read(MIGRATION);
  assert.match(sql, /create or replace function private\.assert_rules_channel/);
  assert.match(sql, /before insert or update of rules_channel_id on public\.community_settings/);
  assert.doesNotMatch(sql, /check \([^)]*rules_channel_id/i, "a CHECK on rules_channel_id could never see channels.type");
});

test("raid protection can never refuse a membership", async () => {
  const sql = await read(MIGRATION);
  const body = sql.slice(
    sql.indexOf("function private.enforce_join_rate"),
    sql.indexOf("drop trigger if exists memberships_enforce_join_rate"),
  );

  // The whole body sits inside its own exception block, and no arm raises:
  // this trigger hangs off the table Stripe writes through.
  assert.match(body, /exception\s+when others then/);
  assert.doesNotMatch(body, /raise exception/);
  assert.match(sql, /after insert or update of status on public\.memberships/);
});

test("the gate never holds the people who would have to lift it", async () => {
  const sql = await read(MIGRATION);
  const gate = sql.slice(
    sql.indexOf("function private.community_gate"),
    sql.indexOf("function public.community_accept_rules"),
  );

  // The owner's arm must come before the three soft gates, and must return
  // null — which ends the CASE rather than falling through to them.
  const ownerArm = gate.indexOf("platform_role in ('influencer', 'super_admin')");
  assert.ok(ownerArm > 0, "the owner is exempted");
  assert.ok(ownerArm < gate.indexOf("'lockdown'"), "the exemption is read before lockdown");
  assert.ok(ownerArm < gate.indexOf("'rules'"), "the exemption is read before the rules gate");
  assert.match(gate, /then null::text/);

  // And a sanction still outranks everything soft.
  assert.ok(gate.indexOf("'banned'") < ownerArm, "a ban is checked before the exemption");
});

test("the access-state function is recreated with its grants, not replaced", async () => {
  const sql = await read(MIGRATION);
  // Its return type gains three columns, so `create or replace` is not an
  // option — and a fresh `create` loses the grants the old one had.
  assert.match(sql, /drop function if exists public\.community_access_state\(\)/);
  assert.match(sql, /rules_version int,/);
  assert.match(sql, /rules_accepted boolean,/);
  assert.match(sql, /verification_until timestamptz/);
  assert.match(sql, /revoke execute on function public\.community_access_state\(\) from public, anon/);
  assert.match(sql, /grant execute on function public\.community_access_state\(\) to authenticated/);
});

test("every new function pins its search_path, and every callable one is taken from public", async () => {
  const sql = await read(MIGRATION);
  const created = [...sql.matchAll(/create (?:or replace )?function (public|private)\.(\w+)/g)].map((match) => match[2]);
  assert.ok(created.length >= 7, `expected the phase's functions, saw ${created.length}`);

  const pins = [...sql.matchAll(/set search_path to 'public', 'pg_temp'/g)].length;
  assert.equal(pins, created.length, "one pinned search_path per function");

  // Only the callable ones need a revoke: trigger functions are not called by
  // name, and `private` is in nobody's search path.
  for (const name of ["community_accept_rules", "community_rules_acceptance_count", "community_clear_lockdown"]) {
    assert.match(sql, new RegExp(`revoke execute on function public\\.${name}\\(\\) from public, anon`), name);
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\(\\) to authenticated`), name);
  }
});

test("the rollback undoes the gate before the columns it reads", async () => {
  const down = await read(ROLLBACK);

  const gateRestored = down.indexOf("function private.community_gate");
  const columnsDropped = down.indexOf("drop column if exists verification_level");
  assert.ok(gateRestored >= 0 && columnsDropped > gateRestored, "the gate stops reading them first");

  // A CHECK cannot be added while rows violate it.
  assert.ok(
    down.indexOf("delete from public.community_moderation_events") <
      down.lastIndexOf("community_moderation_events_action_check"),
    "rows written under the new actions go before the narrower CHECK returns",
  );
  assert.match(down, /drop table if exists public\.community_rules_acceptances/);
});

test("parseSafety refuses what the database would refuse", () => {
  const good = {
    verificationLevel: "accepted_rules",
    verificationMinutes: "0",
    joinRateLimit: "20",
    joinRateWindowMinutes: "10",
    lockdownMinutes: "30",
    rulesChannelId: " 0f2a4d1e-8b6c-4d3e-9a1b-2c3d4e5f6a7b ",
    editWindowMinutes: "15",
    deleteRequiresReason: "on",
  };

  assert.deepEqual(parseSafety(good), {
    verificationLevel: "accepted_rules",
    verificationMinutes: 0,
    joinRateLimit: 20,
    joinRateWindowMinutes: 10,
    lockdownMinutes: 30,
    rulesChannelId: "0f2a4d1e-8b6c-4d3e-9a1b-2c3d4e5f6a7b",
    editWindowMinutes: 15,
    deleteRequiresReason: true,
  });

  assert.equal(parseSafety({ ...good, rulesChannelId: "" }).rulesChannelId, null);
  assert.equal(parseSafety({ ...good, deleteRequiresReason: undefined }).deleteRequiresReason, false);

  assert.throws(() => parseSafety({ ...good, verificationLevel: "invite_only" }), /three ways/);
  assert.throws(() => parseSafety({ ...good, joinRateLimit: "501" }), /between 0 \(off\) and 500/);
  assert.throws(() => parseSafety({ ...good, joinRateWindowMinutes: "0" }), /between 1 and 60/);
  assert.throws(() => parseSafety({ ...good, lockdownMinutes: "4" }), /between 5 minutes and 24 hours/);
  assert.throws(() => parseSafety({ ...good, editWindowMinutes: "10081" }), /0 minutes \(never expires\)/);
  assert.throws(() => parseSafety({ ...good, editWindowMinutes: "" }), /0 minutes \(never expires\)/);

  // A wait of zero is a level that is switched on and does nothing.
  assert.throws(
    () => parseSafety({ ...good, verificationLevel: "member_age", verificationMinutes: "0" }),
    /same as leaving the community open/,
  );
  assert.equal(
    parseSafety({ ...good, verificationLevel: "member_age", verificationMinutes: "10" }).verificationMinutes,
    10,
  );
});
