import assert from "node:assert/strict";
import test from "node:test";

import {
  activeTypists,
  groupMembers,
  onlineIdsFrom,
  typingSentence,
  TYPING_TTL_MS,
} from "../src/lib/channels/presence.ts";

const member = (id, fullName, over = {}) => ({
  id,
  fullName,
  topRoleId: null,
  topRoleName: null,
  topRoleColor: null,
  hoisted: false,
  ...over,
});

test("two tabs are still one person online", () => {
  // Presence state is keyed with an array of metas per key, because the same
  // person can be in two windows. A member list that counted metas would show
  // them twice.
  const ids = onlineIdsFrom({
    "u-1": [{ userId: "u-1" }, { userId: "u-1" }],
    "u-2": [{ userId: "u-2" }],
  });
  assert.deepEqual([...ids].sort(), ["u-1", "u-2"]);
});

test("presence state that is empty, missing or malformed yields nobody", () => {
  assert.equal(onlineIdsFrom({}).size, 0);
  assert.equal(onlineIdsFrom(undefined).size, 0);
  // A meta with no userId is not a person.
  assert.equal(onlineIdsFrom({ k: [{}, { userId: undefined }] }).size, 0);
});

test("a hoisted role only earns a heading when somebody holding it is here", () => {
  // A column of empty role headings is worse than no headings at all.
  const members = [
    member("m-1", "Ada", { hoisted: true, topRoleId: "r-mod", topRoleName: "Moderator", topRoleColor: "#0f0" }),
    member("m-2", "Bob", { hoisted: true, topRoleId: "r-vip", topRoleName: "VIP" }),
  ];
  const sections = groupMembers(members, new Set(["m-1"]));
  assert.deepEqual(
    sections.map((s) => s.label),
    ["Moderator", "Offline"],
    "VIP has nobody online, so it gets no heading",
  );
  assert.equal(sections[0].color, "#0f0");
  assert.deepEqual(
    sections[1].members.map((m) => m.fullName),
    ["Bob"],
  );
});

test("offline members are listed once at the bottom, not under every role", () => {
  const members = [
    member("m-1", "Ada", { hoisted: true, topRoleId: "r-mod", topRoleName: "Moderator" }),
    member("m-2", "Bob", { hoisted: true, topRoleId: "r-mod", topRoleName: "Moderator" }),
  ];
  const sections = groupMembers(members, new Set(["m-1"]));
  assert.deepEqual(
    sections.map((s) => s.label),
    ["Moderator", "Offline"],
  );
  assert.deepEqual(
    sections[0].members.map((m) => m.id),
    ["m-1"],
  );
  assert.deepEqual(
    sections[1].members.map((m) => m.id),
    ["m-2"],
  );
});

test("online members without a hoisted role fall into Online", () => {
  const members = [member("m-1", "Zoe"), member("m-2", "Ada")];
  const sections = groupMembers(members, new Set(["m-1", "m-2"]));
  assert.deepEqual(
    sections.map((s) => s.label),
    ["Online"],
  );
  // Sorted by name, case-insensitively.
  assert.deepEqual(
    sections[0].members.map((m) => m.fullName),
    ["Ada", "Zoe"],
  );
});

test("an empty community produces no sections at all", () => {
  assert.deepEqual(groupMembers([], new Set()), []);
});

test("a typing notice expires rather than sitting there stale", () => {
  // Nothing ever arrives to say somebody stopped typing.
  const now = 1_000_000;
  const entries = [
    { userId: "u-1", channelId: "c", name: "Ada", at: now - 1000 },
    { userId: "u-2", channelId: "c", name: "Bob", at: now - TYPING_TTL_MS },
  ];
  assert.deepEqual(
    activeTypists(entries, now, null).map((e) => e.name),
    ["Ada"],
  );
});

test("you never see yourself typing", () => {
  const now = 1_000_000;
  const entries = [{ userId: "me", channelId: "c", name: "Me", at: now }];
  assert.deepEqual(activeTypists(entries, now, "me"), []);
  assert.equal(activeTypists(entries, now, "someone-else").length, 1);
});

test("a later keystroke replaces the earlier one from the same person", () => {
  const now = 1_000_000;
  const entries = [
    { userId: "u-1", channelId: "c", name: "Ada", at: now - 5000 },
    { userId: "u-1", channelId: "c", name: "Ada", at: now - 100 },
  ];
  const active = activeTypists(entries, now, null);
  assert.equal(active.length, 1, "one person is one entry");
  assert.equal(active[0].at, now - 100);
});

test("the typing sentence stops naming people past three", () => {
  // Four names is longer than the message anybody is typing.
  assert.equal(typingSentence([]), null);
  assert.equal(typingSentence(["Ada"]), "Ada is typing…");
  assert.equal(typingSentence(["Ada", "Bob"]), "Ada and Bob are typing…");
  assert.equal(typingSentence(["Ada", "Bob", "Cleo"]), "Ada, Bob and Cleo are typing…");
  assert.equal(typingSentence(["Ada", "Bob", "Cleo", "Dan"]), "Several people are typing…");
});
