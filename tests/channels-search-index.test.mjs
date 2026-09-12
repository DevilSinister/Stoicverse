import assert from "node:assert/strict";
import test from "node:test";

import {
  localCandidates,
  LOCAL_RESULTS_PER_KIND,
  rankLocal,
  scoreName,
} from "../src/lib/channels/search-index.ts";

const channels = [
  { id: "c1", name: "general", categoryId: "g1", categoryName: "General" },
  { id: "c2", name: "general-chat", categoryId: "g1", categoryName: "General" },
  { id: "c3", name: "release notes", categoryId: "g2", categoryName: "Announcements" },
  { id: "c4", name: "gel", categoryId: "g2", categoryName: "Announcements" },
];

const members = [
  { id: "m1", fullName: "Ada Lovelace", topRoleName: "Moderator" },
  { id: "m2", fullName: "Grace Hopper", topRoleName: null },
];

test("an exact name beats a prefix, and a prefix beats a substring", () => {
  assert.equal(scoreName("general", "general"), 300);
  assert.ok(scoreName("general", "gen") > scoreName("general-chat", "gen"), "the shorter prefix wins");
  assert.ok(scoreName("general", "gen") > scoreName("the general", "gen"), "a prefix beats a substring");
  assert.equal(scoreName("general", "zzz"), null);
  assert.equal(scoreName("general", ""), null, "an empty query matches nothing, not everything");
});

test("a word inside a longer name still answers", () => {
  // Neither an exact match, a prefix, nor — for a single word — a substring
  // somebody would think to look for.
  assert.ok(scoreName("release notes", "notes") !== null);
  assert.ok(scoreName("release_notes", "notes") !== null, "underscores separate words too");
  assert.ok(scoreName("releasenotes", "notes") !== null, "and a plain substring still counts");
});

test("`gel` does not outrank `general` for the query `gen`", () => {
  // The reason this is three tiers and not a fuzzy distance: a fuzzy matcher
  // will happily rank a short unrelated name above the one somebody meant.
  const ranked = rankLocal(localCandidates(channels, members), "gen");
  const names = ranked.filter((result) => result.kind === "channel").map((result) => result.name);
  assert.equal(names[0], "general");
  assert.ok(!names.includes("gel"), "gel does not contain gen at all");
});

test("categories come from the channels, once each", () => {
  const candidates = localCandidates(channels, members);
  const categories = candidates.filter((candidate) => candidate.kind === "category");
  assert.deepEqual(
    categories.map((category) => category.name).sort(),
    ["Announcements", "General"],
    "two categories across four channels, not four",
  );
  assert.equal(new Set(categories.map((category) => category.id)).size, categories.length);
});

test("every kind is searched, and each is capped on its own", () => {
  const many = Array.from({ length: 12 }, (_, index) => ({
    id: `c${index}`,
    name: `general-${index}`,
    categoryId: "g1",
    categoryName: "General",
  }));
  const ranked = rankLocal(localCandidates(many, [{ id: "m", fullName: "General Person", topRoleName: null }]), "gen");

  const channelHits = ranked.filter((result) => result.kind === "channel");
  const memberHits = ranked.filter((result) => result.kind === "member");
  assert.equal(channelHits.length, LOCAL_RESULTS_PER_KIND, "channels are capped");
  // The point of capping per kind: twelve matching channels must not push the
  // one matching person off the list, because they may be who was meant.
  assert.equal(memberHits.length, 1, "the member survives a flood of channels");
});

test("a member is found by either part of their name", () => {
  const candidates = localCandidates(channels, members);
  assert.equal(rankLocal(candidates, "ada")[0]?.name, "Ada Lovelace");
  assert.equal(rankLocal(candidates, "hopper")[0]?.name, "Grace Hopper", "a surname is a word boundary");
  assert.equal(rankLocal(candidates, "LOVELACE")[0]?.name, "Ada Lovelace", "matching ignores case");
});

test("an empty query returns nothing at all", () => {
  const candidates = localCandidates(channels, members);
  assert.deepEqual(rankLocal(candidates, ""), []);
  assert.deepEqual(rankLocal(candidates, "   "), []);
});
