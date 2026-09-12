import assert from "node:assert/strict";
import test from "node:test";

import { continuesGroup, firstUnreadIndex, GROUP_WINDOW_MS, startsNewDay } from "../src/lib/channels/grouping.ts";
import { COMPOSER_NOTICE, deriveAffordances } from "../src/lib/channels/permissions.ts";
import { activeMentionQuery, decodeMentions, encodeMentions } from "../src/lib/channels/mentions.ts";

const ADA = "11111111-2222-3333-4444-555555555555";
const GRACE = "66666666-7777-8888-9999-000000000000";
const MODS = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const GENERAL = "12121212-3434-5656-7878-909090909090";

const at = (iso) => ({ authorId: ADA, createdAt: iso });

test("a run of messages from one person is one block", () => {
  const first = at("2026-09-12T10:00:00Z");
  assert.equal(continuesGroup(first, at("2026-09-12T10:01:00Z")), true);
  assert.equal(continuesGroup(null, first), false);
});

test("a long enough gap starts a new block even from the same person", () => {
  const first = at("2026-09-12T10:00:00Z");
  const later = at(new Date(Date.parse(first.createdAt) + GROUP_WINDOW_MS + 1000).toISOString());
  assert.equal(continuesGroup(first, later), false);
});

test("a different author always starts a block", () => {
  assert.equal(
    continuesGroup(at("2026-09-12T10:00:00Z"), { authorId: GRACE, createdAt: "2026-09-12T10:00:30Z" }),
    false,
  );
});

test("a reply never continues a block", () => {
  // A reply renders a quoted excerpt above it. Hiding the author would make
  // that excerpt look like it belongs to the person above.
  assert.equal(
    continuesGroup(at("2026-09-12T10:00:00Z"), {
      authorId: ADA,
      createdAt: "2026-09-12T10:00:30Z",
      replyToPostId: "some-post",
    }),
    false,
  );
});

test("a system message has no author to group under", () => {
  assert.equal(
    continuesGroup(at("2026-09-12T10:00:00Z"), {
      authorId: null,
      createdAt: "2026-09-12T10:00:30Z",
      postType: "system",
    }),
    false,
  );
});

test("a day divider appears at the first message and at each date change", () => {
  assert.equal(startsNewDay(null, at("2026-09-12T10:00:00Z")), true);
  // Same instant twice is certainly the same local day, whatever the timezone.
  assert.equal(startsNewDay(at("2026-09-12T10:00:00Z"), at("2026-09-12T10:00:00Z")), false);
  // Three days apart is a different local day in every timezone.
  assert.equal(startsNewDay(at("2026-09-09T10:00:00Z"), at("2026-09-12T10:00:00Z")), true);
});

const perms = (...keys) => ({ permissions: keys, channelType: "text" });

test("the composer resolves the sanction before the channel", () => {
  // Telling somebody "you cannot post here" when they are actually timed out
  // sends them to argue with the wrong thing.
  assert.equal(deriveAffordances({ ...perms("send_messages"), gate: "timeout" }).composer, "timedOut");
  assert.equal(deriveAffordances({ ...perms("send_messages"), gate: "banned" }).composer, "banned");
  assert.equal(deriveAffordances({ ...perms("send_messages"), gate: "suspended" }).composer, "suspended");
  assert.equal(deriveAffordances(perms("send_messages")).composer, "ready");

  // The three soft gates from phase 7. None of them is a sanction: each one
  // names the thing that lifts it, and reading survives all three.
  for (const [gate, state] of [
    ["lockdown", "lockedDown"],
    ["rules", "rulesNotAccepted"],
    ["verification", "notVerified"],
  ]) {
    const held = deriveAffordances({ ...perms("send_messages", "add_reactions"), gate });
    assert.equal(held.composer, state, gate);
    assert.equal(held.canReply, false, `${gate} stops replying`);
    assert.equal(held.canReact, false, `${gate} stops reacting`);
    assert.match(COMPOSER_NOTICE[state], /\S/, `${gate} has something to say`);
  }

  // A sanction still outranks a soft gate: being banned and unverified reads
  // as banned, which is the one of the two worth arguing with.
  assert.equal(deriveAffordances({ ...perms("send_messages"), gate: "banned" }).composer, "banned");
});

test("a read-only channel and an announcement channel say different things", () => {
  assert.equal(deriveAffordances(perms()).composer, "readOnly");
  assert.equal(deriveAffordances({ permissions: [], channelType: "announcements" }).composer, "announcementOnly");
  assert.equal(deriveAffordances({ permissions: [], channelType: "rules" }).composer, "rulesChannel");
  // Every state has a sentence behind it.
  for (const state of ["timedOut", "banned", "suspended", "readOnly", "announcementOnly", "rulesChannel"]) {
    assert.ok(COMPOSER_NOTICE[state], `${state} needs a notice`);
  }
});

test("administrator implies every permission", () => {
  const admin = deriveAffordances({ permissions: ["administrator"], channelType: "text" });
  assert.equal(admin.composer, "ready");
  assert.equal(admin.canAttach, true);
  assert.equal(admin.canManageMessages, true);
});

test("reacting survives a read-only channel but not a sanction", () => {
  // Read-only is about writing. A timeout is about the person.
  assert.equal(deriveAffordances({ permissions: ["add_reactions"], channelType: "text" }).canReact, true);
  assert.equal(
    deriveAffordances({ permissions: ["add_reactions"], channelType: "text", gate: "timeout" }).canReact,
    false,
  );
});

const dictionary = {
  users: [
    { id: ADA, name: "Ada" },
    { id: GRACE, name: "Ada Lovelace" },
  ],
  roles: [{ id: MODS, name: "Moderators" }],
  channels: [{ id: GENERAL, name: "general" }],
};

test("the longest matching name wins, so @Ada does not eat @Ada Lovelace", () => {
  assert.equal(encodeMentions("hi @Ada Lovelace", dictionary), `hi <@${GRACE}>`);
  assert.equal(encodeMentions("hi @Ada", dictionary), `hi <@${ADA}>`);
});

test("a mention has to end on a non-word character", () => {
  // Otherwise @Ada matches inside @Adam and silently pings the wrong person.
  assert.equal(encodeMentions("hi @Adam", dictionary), "hi @Adam");
});

test("roles and channels encode to their own token shapes", () => {
  assert.equal(encodeMentions("@Moderators", dictionary), `<@&${MODS}>`);
  assert.equal(encodeMentions("#general", dictionary), `<#${GENERAL}>`);
});

test("decoding round-trips, and a deleted target reads as words not hex", () => {
  assert.equal(decodeMentions(encodeMentions("hi @Ada", dictionary), dictionary), "hi @Ada");
  const missing = "00000000-0000-0000-0000-000000000000";
  assert.equal(decodeMentions(`<@${missing}>`, dictionary), "@unknown-member");
  assert.equal(decodeMentions(`<@&${missing}>`, dictionary), "@deleted-role");
  assert.equal(decodeMentions(`<#${missing}>`, dictionary), "#deleted-channel");
});

test("the autocomplete only fires on the token under the caret", () => {
  assert.deepEqual(activeMentionQuery("hello @ad", 9), { trigger: "@", query: "ad", start: 6 });
  assert.deepEqual(activeMentionQuery("hello #gen", 10), { trigger: "#", query: "gen", start: 6 });
  assert.equal(activeMentionQuery("hello there", 11), null);
  // Mid-word is not a mention.
  assert.equal(activeMentionQuery("email@example", 13), null);
});

// ------------------------------------------------- the NEW divider (phase P3)

const READER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const msg = (id, iso, authorId = OTHER) => ({ id, createdAt: iso, authorId });

test("the divider marks the first message that arrived after the last visit", () => {
  const messages = [
    msg("a", "2026-09-12T10:00:00Z"),
    msg("b", "2026-09-12T11:00:00Z"),
    msg("c", "2026-09-12T12:00:00Z"),
  ];
  assert.equal(firstUnreadIndex(messages, "2026-09-12T10:30:00Z", READER), 1);
});

test("your own messages never start the unread run", () => {
  // Posting something and then being told there is something new below it is
  // nonsense. This is also why the divider cannot be exercised in a community
  // where the only author is the reader.
  const mine = [msg("a", "2026-09-12T11:00:00Z", READER), msg("b", "2026-09-12T12:00:00Z", READER)];
  assert.equal(firstUnreadIndex(mine, "2026-09-12T10:00:00Z", READER), -1);

  // But somebody else's message after yours still counts.
  const mixed = [msg("a", "2026-09-12T11:00:00Z", READER), msg("b", "2026-09-12T12:00:00Z", OTHER)];
  assert.equal(firstUnreadIndex(mixed, "2026-09-12T10:00:00Z", READER), 1);
});

test("nothing unread, never read, and an unusable timestamp all mean no divider", () => {
  const messages = [msg("a", "2026-09-12T10:00:00Z")];
  assert.equal(firstUnreadIndex(messages, "2026-09-12T23:00:00Z", READER), -1, "all read");
  assert.equal(firstUnreadIndex(messages, null, READER), -1, "never opened the channel");
  assert.equal(firstUnreadIndex(messages, "not a date", READER), -1, "unparseable");
  assert.equal(firstUnreadIndex([], "2026-09-12T10:00:00Z", READER), -1, "empty channel");
});

test("a message exactly at the boundary is already read", () => {
  // The boundary is when the reader last looked, so a message written at that
  // instant was on screen. Using >= would put the divider above a message they
  // had already seen, on every single visit.
  const messages = [msg("a", "2026-09-12T10:00:00Z")];
  assert.equal(firstUnreadIndex(messages, "2026-09-12T10:00:00Z", READER), -1);
});

test("an anonymous reader owns nothing, so every message can be unread", () => {
  const messages = [msg("a", "2026-09-12T11:00:00Z", null)];
  assert.equal(firstUnreadIndex(messages, "2026-09-12T10:00:00Z", null), 0);
});
