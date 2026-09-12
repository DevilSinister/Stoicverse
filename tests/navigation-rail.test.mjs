import assert from "node:assert/strict";
import test from "node:test";

import { accountHref, activeRailId, buildRail, RAIL_GROUP_ORDER } from "../src/lib/navigation/rail.ts";

/**
 * `rail.ts` is zero-import so its branching can be executed here rather than
 * asserted as source text. What is worth testing is the part that used to be
 * wrong in `buildAppNav`: who sees what, and where a creator's copy of a
 * shared destination actually lives.
 */

test("the rail is flat — every item is a peer, and groups only draw dividers", () => {
  const rail = buildRail({ routeBase: "/creator", isMaster: true });

  // Nothing may claim a parent. A nested item would be a different product.
  for (const item of rail) {
    assert.ok(!("parent" in item) && !("children" in item), `${item.id} must be a peer, not nested`);
    assert.ok(RAIL_GROUP_ORDER.includes(item.group), `${item.id} has an unknown group`);
  }

  // Courses and Events are top-level destinations beside Community, not
  // sub-navigation underneath it.
  const ids = rail.map((item) => item.id);
  for (const id of ["dashboard", "community", "courses", "events"]) {
    assert.ok(ids.includes(id), `${id} must be its own rail icon`);
  }

  // Ids are unique, because the active check keys on them.
  assert.equal(new Set(ids).size, ids.length);
});

test("a member sees the spaces and none of the management cluster", () => {
  const ids = buildRail({ routeBase: "/dashboard" }).map((item) => item.id);

  assert.deepEqual(ids, ["dashboard", "community", "courses", "events", "notifications", "settings"]);
  for (const creatorOnly of ["members", "analytics", "revenue"]) {
    assert.ok(!ids.includes(creatorOnly), `a member must not see ${creatorOnly}`);
  }
});

test("a creator gets the management cluster, and their own copies of the shared spaces", () => {
  const rail = buildRail({ routeBase: "/creator" });
  const href = (id) => rail.find((item) => item.id === id)?.href;

  assert.equal(href("dashboard"), "/creator");
  assert.equal(href("courses"), "/creator/courses");
  assert.equal(href("events"), "/creator/events");
  // One community for everyone — the resolver decides what they may do there.
  assert.equal(href("community"), "/channels");

  for (const id of ["members", "analytics", "revenue"]) {
    assert.equal(rail.find((item) => item.id === id)?.group, "manage");
  }
});

test("Master Zone appears only for a master, and a creator is not one by default", () => {
  assert.ok(!buildRail({ routeBase: "/dashboard" }).some((item) => item.id === "master"));
  // The trap this encodes: master is a tier gate (`member_tiers.is_master`),
  // not a role one, so an influencer without the row is refused by
  // `requireInfluencerMasterWorkspace` and must not be offered the icon.
  assert.ok(!buildRail({ routeBase: "/creator" }).some((item) => item.id === "master"));

  const member = buildRail({ routeBase: "/dashboard", isMaster: true });
  const creator = buildRail({ routeBase: "/creator", isMaster: true });
  assert.equal(member.find((item) => item.id === "master")?.href, "/master");
  assert.equal(creator.find((item) => item.id === "master")?.href, "/creator/master");
});

test("the avatar points at an account page the viewer can actually reach", () => {
  assert.equal(accountHref({ routeBase: "/dashboard" }), "/dashboard/settings");
  // `proxy.ts` bounces an influencer off /dashboard/*, so sending a creator
  // there would be a redirect loop dressed as a link.
  assert.equal(accountHref({ routeBase: "/creator" }), "/creator/account");
});

test("the active item is the longest match, and home does not light up on everything", () => {
  const creator = buildRail({ routeBase: "/creator", isMaster: true });

  assert.equal(activeRailId("/creator", creator), "dashboard");
  // The one that a prefix test gets wrong: every creator route starts with
  // `/creator`, so home must be exact-match only.
  assert.equal(activeRailId("/creator/analytics", creator), "analytics");
  assert.equal(activeRailId("/creator/members/turnover", creator), "members");
  assert.equal(activeRailId("/channels/2f8c9e11-0000-4000-8000-000000000000", creator), "community");
  assert.equal(activeRailId("/login", creator), null);

  const member = buildRail({ routeBase: "/dashboard" });
  assert.equal(activeRailId("/dashboard", member), "dashboard");
  assert.equal(activeRailId("/dashboard/courses/abc", member), "courses");
  // `/dashboard/settings` is both the Settings icon and the avatar's target;
  // the icon is what lights, because the avatar is not in the list.
  assert.equal(activeRailId("/dashboard/settings", member), "settings");
});
