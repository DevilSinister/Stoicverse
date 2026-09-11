import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CHANNEL_PERMISSION_KEYS,
  PERMISSION_KEYS,
  canGrant,
  canManageRole,
  resolveChannelPermissions,
} from "../src/lib/community-settings/permissions.ts";
import { SYSTEM_ROLE_KEYS, parseRoleInput } from "../src/lib/community-settings/role-model.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const MIGRATION = "supabase/migrations/20260912010000_community_roles_and_permissions.sql";
const ROLLBACK = "supabase/rollback/20260912010000_community_roles_and_permissions.down.sql";

/** The array literal inside a `returns text[]` helper, as a list of keys. */
function sqlKeyList(migration, functionName) {
  const body = migration.slice(migration.indexOf(`create or replace function public.${functionName}()`));
  const literal = body.slice(body.indexOf("select array["), body.indexOf("]::text[]"));
  return [...literal.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
}

test("the SQL permission vocabulary is the TypeScript one, in the same order", async () => {
  const migration = await read(MIGRATION);

  // A key in one and not the other is a grant that silently never applies:
  // either the CHECK refuses it, or the interface never offers it.
  assert.deepEqual(sqlKeyList(migration, "community_permission_keys"), [...PERMISSION_KEYS]);
  assert.deepEqual(sqlKeyList(migration, "community_channel_permission_keys"), [...CHANNEL_PERMISSION_KEYS]);
  assert.equal(PERMISSION_KEYS.length, 24);
  assert.equal(CHANNEL_PERMISSION_KEYS.length, 17);
});

test("the tables are renamed and the old names survive only as read-only views", async () => {
  const migration = await read(MIGRATION);

  assert.match(migration, /alter table public\.cosmetic_roles rename to community_roles;/);
  assert.match(migration, /alter table public\.cosmetic_role_assignments rename to community_role_members;/);

  // security_invoker, so the view cannot become a way around the new policies.
  assert.match(migration, /create view public\.cosmetic_roles\s*\nwith \(security_invoker = true\)/);
  assert.match(migration, /create view public\.cosmetic_role_assignments\s*\nwith \(security_invoker = true\)/);
  assert.match(migration, /revoke all on public\.cosmetic_roles from anon, authenticated;/);
  assert.match(migration, /grant select on public\.cosmetic_roles, public\.cosmetic_role_assignments to authenticated;/);
});

test("permissions are constrained to the catalog and positions are uniquely deferrable", async () => {
  const migration = await read(MIGRATION);

  assert.match(migration, /check \(permissions <@ public\.community_permission_keys\(\)\)/);
  // Deferred, because a reorder is one UPDATE that necessarily passes through
  // states where two roles share a position.
  assert.match(migration, /unique \("position"\) deferrable initially deferred/);

  const systemKeys = migration.match(/check \(system_key is null or system_key in \(([^)]*)\)\)/s);
  assert.ok(systemKeys, "the system_key CHECK is not recognisable");
  for (const key of SYSTEM_ROLE_KEYS) assert.match(systemKeys[1], new RegExp(`'${key}'`));
});

test("role membership follows tiers, memberships and the platform role", async () => {
  const migration = await read(MIGRATION);

  // Both tables matter: a tier change with no membership grants nothing, and a
  // membership change with no tier re-read would leave a lapsed member holding
  // their tier role.
  assert.match(migration, /after insert or update of current_tier, is_master on public\.member_tiers/);
  assert.match(migration, /after insert or update of status, expires_at on public\.memberships/);
  assert.match(migration, /after insert or update of platform_role, is_suspended on public\.profiles/);

  // The backfill is asserted, not assumed.
  assert.match(migration, /post-check: % members hold an active membership and a tier/);
  assert.match(migration, /post-check: % active moderators/);
});

test("the role tables have no DML policy and are revoked besides", async () => {
  const migration = await read(MIGRATION);

  assert.match(migration, /create policy community_roles_read/);
  assert.match(migration, /create policy community_role_members_read/);
  // Absence of a policy is not absence of a grant: Supabase's default
  // privileges hand DML to authenticated on every public table.
  // Scoped to a policy's ON clause: the storage policies for the role-icon
  // bucket are named community_role_icons_* and are not policies on these tables.
  const roleTablePolicies = [
    ...migration.matchAll(/create policy (\w+)\s+on public\.(community_roles|community_role_members)\s+for (\w+)/g),
  ];
  assert.deepEqual(
    roleTablePolicies.map((match) => match[3]),
    ["select", "select"],
    "the role tables carry a policy that is not a SELECT",
  );
  assert.match(
    migration,
    /revoke insert, update, delete, truncate on public\.community_roles from anon, authenticated;/,
  );
  assert.match(
    migration,
    /revoke insert, update, delete, truncate on public\.community_role_members from anon, authenticated;/,
  );
});

test("the resolver is never handed to authenticated, only its two wrappers are", async () => {
  const migration = await read(MIGRATION);

  // community_permissions takes an arbitrary subject: a member asking what a
  // stranger may do would learn their membership state.
  assert.match(migration, /grant execute on function public\.community_permissions\(uuid, uuid\) to service_role;/);
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.community_permissions\(uuid, uuid\) to authenticated/,
  );
  assert.match(migration, /grant execute on function public\.community_has\(text, uuid\) to authenticated/);
  assert.match(migration, /grant execute on function public\.community_my_permissions\(uuid\) to authenticated/);
});

test("every function pins its search_path, and every grant revokes PUBLIC and anon first", async () => {
  const migration = await read(MIGRATION);

  // Both roles, every time. Revoking PUBLIC alone leaves the grant Supabase's
  // ALTER DEFAULT PRIVILEGES makes directly to anon on every new function in
  // `public`; revoking anon alone leaves PostgreSQL's PUBLIC grant. The
  // security advisor found fourteen of these callable by anon over
  // /rest/v1/rpc when only PUBLIC had been revoked.
  const grants = migration.match(/grant execute on function public\.\w+/g) ?? [];
  assert.ok(grants.length > 0);
  for (const match of migration.matchAll(/grant execute on function (public|private)\.(\w+)\(/g)) {
    const name = `${match[1]}\\.${match[2]}`;
    assert.match(
      migration,
      new RegExp(`revoke execute on function ${name}\\([^)]*\\) from public, anon`),
      `${match[1]}.${match[2]} is granted without first revoking from PUBLIC and anon`,
    );
  }

  const definitions = migration.match(/^create or replace function/gm) ?? [];
  const pinned = migration.match(/^set search_path to ('public', 'pg_temp'|'')$/gm) ?? [];
  assert.equal(pinned.length, definitions.length);
});

test("the legacy grant surface keeps answering the same way", async () => {
  const migration = await read(MIGRATION);

  // private.assert_post_content_allowed still calls community_grant, so the
  // shim has to map every legacy key or mention gating silently opens.
  for (const [legacy, modern] of [
    ["post", "send_messages"],
    ["pin", "pin_messages"],
    ["delete_others", "manage_messages"],
    ["mention_all", "mention_everyone"],
    ["mention_tier", "mention_roles"],
    ["bypass_slow_mode", "bypass_slowmode"],
  ]) {
    assert.match(migration, new RegExp(`when '${legacy}' then '${modern}'`));
  }
});

test("the seeded Moderator role withholds the three escalating grants", async () => {
  const migration = await read(MIGRATION);

  // Replaces the old MODERATOR_BASELINE unit test: the baseline is a seeded
  // role now, not a constant. @everyone reaches every member at once, channel
  // management reshapes what everyone sees, and a ban ends access someone paid
  // for. All three stay the influencer's to grant explicitly.
  const seed = migration.slice(migration.indexOf("('Moderator'"), migration.indexOf("on conflict (system_key)"));
  assert.match(seed, /'moderate_members'/);
  assert.match(seed, /'manage_messages'/);
  assert.doesNotMatch(seed, /'mention_everyone'/);
  assert.doesNotMatch(seed, /'manage_channels'/);
  assert.doesNotMatch(seed, /'ban_members'/);

  // @everyone is read, react and nothing else.
  const everyone = migration.slice(migration.indexOf("('@everyone'"), migration.indexOf("('Tier 1'"));
  assert.doesNotMatch(everyone, /'send_messages'/);
  assert.doesNotMatch(everyone, /'administrator'/);
});

test("phase 2 changes no policy on posts", async () => {
  const migration = await read(MIGRATION);

  // The posts policy switch is phase 3, deliberately alone, because it is the
  // change that can break member posting outright. Statements only: the header
  // comment names posts_staff_insert to say precisely that it is left alone.
  const statements = migration
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  assert.doesNotMatch(statements, /policy[\s\S]{0,80}on public\.posts/);
  assert.doesNotMatch(statements, /posts_staff_insert|posts_member_insert/);
});

test("the rollback restores the legacy shape and refuses to run under phase 3", async () => {
  const rollback = await read(ROLLBACK);

  assert.match(rollback, /refusing to roll back: phase 3/);
  assert.match(rollback, /alter table public\.community_roles rename to cosmetic_roles;/);
  assert.match(rollback, /create or replace function public\.is_valid_permission_config\(config jsonb\)/);
  assert.match(rollback, /create policy cosmetic_roles_creator_insert/);
  // The lossiness is stated in the file, not only in a commit message.
  assert.match(rollback, /DATA LOSS/);
});

test("canGrant refuses what the viewer does not hold, and administrator implies all", () => {
  const plain = { isOwner: false, permissions: new Set(["manage_roles"]), highestPosition: 3 };
  assert.equal(canGrant(plain, "manage_roles"), true);
  assert.equal(canGrant(plain, "ban_members"), false);

  const admin = { isOwner: false, permissions: new Set(["administrator"]), highestPosition: 3 };
  assert.equal(canGrant(admin, "ban_members"), true);
  assert.equal(canGrant({ isOwner: true, permissions: new Set(), highestPosition: 0 }, "ban_members"), true);
});

test("roles are managed strictly from above, and @everyone is the exception", () => {
  const viewer = { isOwner: false, permissions: new Set(["manage_roles"]), highestPosition: 3 };
  assert.equal(canManageRole(viewer, { position: 2, systemKey: null }), true);
  assert.equal(canManageRole(viewer, { position: 3, systemKey: null }), false, "equal position is not enough");
  assert.equal(canManageRole(viewer, { position: 4, systemKey: null }), false);
  assert.equal(canManageRole(viewer, { position: 0, systemKey: "everyone" }), true);

  const bystander = { isOwner: false, permissions: new Set(["send_messages"]), highestPosition: 9 };
  assert.equal(canManageRole(bystander, { position: 1, systemKey: null }), false);
});

test("the resolver applies denies before allows, and no view_channel means nothing", () => {
  const base = ["view_channel", "read_message_history", "send_messages"];
  const everyoneRoleId = "everyone";

  // A role allow must win over the @everyone deny that precedes it.
  assert.equal(
    resolveChannelPermissions({
      base,
      everyoneRoleId,
      memberRoleIds: ["mod"],
      overrides: [
        { roleId: everyoneRoleId, allow: [], deny: ["send_messages"] },
        { roleId: "mod", allow: ["send_messages"], deny: [] },
      ],
    }).includes("send_messages"),
    true,
  );

  // ...and a role deny must win over the @everyone allow that precedes it.
  assert.equal(
    resolveChannelPermissions({
      base,
      everyoneRoleId,
      memberRoleIds: ["mod"],
      overrides: [
        { roleId: everyoneRoleId, allow: ["send_messages"], deny: [] },
        { roleId: "mod", allow: [], deny: ["send_messages"] },
      ],
    }).includes("send_messages"),
    false,
  );

  assert.deepEqual(
    resolveChannelPermissions({
      base,
      everyoneRoleId,
      memberRoleIds: [],
      overrides: [{ roleId: everyoneRoleId, allow: [], deny: ["view_channel"] }],
    }),
    [],
  );
});

test("a role colour is measured against the member list, not the page background", () => {
  // #0D1C2D is the member-list surface. A near-black role name clears no floor.
  assert.throws(() => parseRoleInput({ name: "Shadow", color: "#111827", permissions: [] }), /at least 3:1/);
  assert.equal(parseRoleInput({ name: "Brass", color: "#C8A24A", permissions: [] }).color, "#C8A24A");
});

test("parseRoleInput drops unknown grants rather than failing the whole save", () => {
  const parsed = parseRoleInput({
    name: "Guide",
    color: "#38BDF8",
    permissions: ["send_messages", "not_a_permission", "send_messages"],
  });
  assert.deepEqual(parsed.permissions, ["send_messages"]);
});

test("an emoji and an uploaded icon cannot both be set", () => {
  assert.throws(
    () => parseRoleInput({ name: "Guide", color: "#38BDF8", iconEmoji: "X", iconPath: "a.png", permissions: [] }),
    /not both/,
  );
});
