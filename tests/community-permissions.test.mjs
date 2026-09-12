import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CHANNEL_PERMISSION_KEYS,
  ESCALATING_PERMISSIONS,
  PERMISSION_CATALOG,
  PERMISSION_KEYS,
  canGrant,
  canManageRole,
  diffPermissions,
  newlyEscalating,
  normalizePermissions,
  overrideStateFor,
  resolveChannelPermissions,
} from "../src/lib/community-settings/permissions.ts";
import {
  SETTINGS_SECTIONS,
  isSettingsSection,
  parseSettingsQuery,
  settingsHref,
  visibleSections,
} from "../src/lib/community-settings/sections.ts";

test("the catalog covers every key exactly once and channel keys are a subset", () => {
  assert.equal(new Set(PERMISSION_KEYS).size, PERMISSION_KEYS.length);
  assert.deepEqual(Object.keys(PERMISSION_CATALOG).sort(), [...PERMISSION_KEYS].sort());
  for (const key of CHANNEL_PERMISSION_KEYS) assert.ok(PERMISSION_KEYS.includes(key), key);
  for (const key of PERMISSION_KEYS) {
    const meta = PERMISSION_CATALOG[key];
    assert.ok(meta.label.length > 2, key);
    assert.ok(meta.detail.endsWith("."), `${key} detail is a sentence`);
  }
  // The dangerous six, and nothing that @everyone could sensibly hold.
  assert.deepEqual(
    [...ESCALATING_PERMISSIONS].sort(),
    ["administrator", "ban_members", "manage_channels", "manage_community", "manage_roles", "mention_everyone"],
  );
  for (const key of ESCALATING_PERMISSIONS) assert.equal(PERMISSION_CATALOG[key].appliesToEveryone, false, key);
});

test("normalizePermissions drops unknown keys and duplicates in catalog order", () => {
  assert.deepEqual(normalizePermissions(["send_messages", "nope", "view_channel", "send_messages", 3]), [
    "view_channel",
    "send_messages",
  ]);
});

test("you cannot grant what you lack, and administrator implies everything", () => {
  const mod = { isOwner: false, permissions: new Set(["manage_roles", "send_messages"]), highestPosition: 6 };
  assert.equal(canGrant(mod, "send_messages"), true);
  assert.equal(canGrant(mod, "ban_members"), false);
  assert.equal(canGrant({ ...mod, permissions: new Set(["administrator"]) }, "ban_members"), true);
  assert.equal(canGrant({ ...mod, isOwner: true, permissions: new Set() }, "administrator"), true);
});

test("roles are managed strictly from above", () => {
  const mod = { isOwner: false, permissions: new Set(["manage_roles"]), highestPosition: 6 };
  assert.equal(canManageRole(mod, { position: 5, systemKey: "tier_5" }), true);
  assert.equal(canManageRole(mod, { position: 6, systemKey: "moderator" }), false, "equal position is not above");
  assert.equal(canManageRole(mod, { position: 7, systemKey: null }), false);
  assert.equal(canManageRole(mod, { position: 0, systemKey: "everyone" }), true);
  assert.equal(canManageRole({ ...mod, permissions: new Set() }, { position: 1, systemKey: null }), false);
  assert.equal(canManageRole({ ...mod, isOwner: true }, { position: 99, systemKey: null }), true);
});

test("only newly added escalating grants need the typed confirmation", () => {
  assert.deepEqual(newlyEscalating(["ban_members"], ["ban_members", "send_messages"]), []);
  assert.deepEqual(newlyEscalating([], ["administrator", "send_messages"]), ["administrator"]);
  assert.deepEqual(diffPermissions(["a", "send_messages"], ["send_messages", "pin_messages"]), {
    added: ["pin_messages"],
    removed: ["a"],
  });
});

test("channel resolution follows Discord precedence for every shared fixture", async () => {
  const fixtures = JSON.parse(
    await readFile(new URL("./fixtures/permission-resolution.json", import.meta.url), "utf8"),
  );
  for (const scenario of fixtures.cases) {
    const result = resolveChannelPermissions({
      base: scenario.base,
      everyoneRoleId: fixtures.everyoneRoleId,
      memberRoleIds: scenario.memberRoleIds,
      overrides: scenario.overrides,
      channelType: scenario.channelType,
    });
    if (scenario.expectedAll) {
      assert.deepEqual(result, [...PERMISSION_KEYS], scenario.name);
    } else {
      assert.deepEqual(result, scenario.expected, scenario.name);
    }
  }
});

test("tri-state reads deny before allow", () => {
  const override = { roleId: "r", allow: ["send_messages"], deny: ["attach_files"] };
  assert.equal(overrideStateFor(override, "send_messages"), "allow");
  assert.equal(overrideStateFor(override, "attach_files"), "deny");
  assert.equal(overrideStateFor(override, "pin_messages"), "neutral");
  assert.equal(overrideStateFor(undefined, "pin_messages"), "neutral");
});

test("the section registry is the only section list and filters by permission", () => {
  assert.equal(new Set(SETTINGS_SECTIONS.map((section) => section.id)).size, SETTINGS_SECTIONS.length);
  for (const section of SETTINGS_SECTIONS) assert.ok(PERMISSION_KEYS.includes(section.requires), section.id);

  const influencer = visibleSections({ isInfluencer: true, permissions: new Set() }).map((section) => section.id);
  assert.ok(influencer.includes("overview") && influencer.includes("audit"));
  // Emoji became a built section in phase 6; `members` is still the one that
  // is not, and it is what now carries the property this line is for.
  assert.ok(influencer.includes("emoji"), "emoji is built as of phase 6");
  assert.ok(!influencer.includes("members"), "unbuilt sections never render, even for the owner");

  const auditor = visibleSections({
    isInfluencer: false,
    permissions: new Set(["view_audit_log", "moderate_members"]),
  }).map((section) => section.id);
  // Reports became a built section in phase 4. Members still is not, so this
  // keeps asserting that an unbuilt section stays invisible to someone who
  // holds its permission — which is the property that matters, not the count.
  assert.deepEqual(auditor, ["reports", "audit"], "a held permission reveals only built sections");
  assert.ok(!auditor.includes("members"), "members is not built yet and must not render");

  assert.deepEqual(visibleSections({ isInfluencer: false, permissions: new Set(["send_messages"]) }), []);
  assert.equal(isSettingsSection("roles"), true);
  assert.equal(isSettingsSection("composer"), false);
});

test("settings queries are validated server-side and legacy sections alias forward", () => {
  const visible = visibleSections({ isInfluencer: true, permissions: new Set() });
  assert.equal(parseSettingsQuery({ section: "identity" }, visible).section, "overview");
  assert.equal(parseSettingsQuery({ section: "moderation" }, visible).section, "safety");
  assert.equal(parseSettingsQuery({ section: "nope" }, visible).section, "overview");
  assert.equal(parseSettingsQuery({ section: ["roles", "audit"] }, visible).section, "roles");

  const onlyAudit = visibleSections({ isInfluencer: false, permissions: new Set(["view_audit_log"]) });
  assert.equal(parseSettingsQuery({ section: "roles" }, onlyAudit).section, "audit", "falls to the first visible");

  const parsed = parseSettingsQuery(
    {
      section: "channels",
      channel: "0f2a4d1e-8b6c-4d3e-9a1b-2c3d4e5f6a7b",
      role: "not-a-uuid",
      tab: "permissions",
      cursor: "x".repeat(65),
    },
    visible,
  );
  assert.equal(parsed.channelId, "0f2a4d1e-8b6c-4d3e-9a1b-2c3d4e5f6a7b");
  assert.equal(parsed.roleId, undefined);
  assert.equal(parsed.tab, "permissions");
  assert.equal(parsed.cursor, undefined);

  assert.equal(
    settingsHref("/creator/settings", "channels", { channelId: "abc", tab: "permissions" }),
    "/creator/settings?section=channels&channel=abc&tab=permissions",
  );
});
