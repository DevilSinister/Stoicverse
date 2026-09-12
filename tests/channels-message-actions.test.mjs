import assert from "node:assert/strict";
import test from "node:test";

import { deriveMessageActions, messagePermalink, JUMP_PAGE_BUDGET } from "../src/lib/channels/message-actions.ts";

const ME = "11111111-1111-4111-8111-111111111111";
const THEM = "22222222-2222-4222-8222-222222222222";

const message = (over = {}) => ({
  authorId: THEM,
  postType: "post",
  isPinned: false,
  threadId: null,
  hasBody: true,
  pending: false,
  ...over,
});

const abilities = (over = {}) => ({
  canReply: true,
  canReact: true,
  canPin: false,
  canManageMessages: false,
  canCreateThread: false,
  ...over,
});

const derive = (m, viewerId, a) => deriveMessageActions({ message: message(m), viewerId, abilities: abilities(a) });

test("a plain member gets no delete on somebody else's message", () => {
  const actions = derive({}, ME, {});
  assert.equal(actions.remove, false);
  assert.equal(actions.edit, false);
  assert.equal(actions.report, true);
});

test("you can delete your own message, and it asks for no reason", () => {
  const actions = derive({ authorId: ME }, ME, {});
  assert.equal(actions.remove, true);
  assert.equal(actions.removeNeedsReason, false);
});

test("a moderator deleting somebody else's message is asked for a reason", () => {
  // The reason is what `soft_delete_post` puts in `app.moderation_reason`, and
  // what the case log then carries. A deletion with no record of why is the
  // thing that log exists to prevent.
  const actions = derive({}, ME, { canManageMessages: true });
  assert.equal(actions.remove, true);
  assert.equal(actions.removeNeedsReason, true);
});

test("no permission lets anyone edit somebody else's words", () => {
  // A moderator deletes, and the deletion is logged. Silently rewriting what
  // another person said would not be.
  const actions = derive({}, ME, { canManageMessages: true, canPin: true });
  assert.equal(actions.edit, false);
  assert.equal(derive({ authorId: ME }, ME, {}).edit, true);
});

test("a message with no body cannot be edited or have its text copied", () => {
  const actions = derive({ authorId: ME, hasBody: false }, ME, {});
  assert.equal(actions.edit, false);
  assert.equal(actions.copyText, false);
  // An attachment-only message is still a link worth sharing.
  assert.equal(actions.copyLink, true);
});

test("you cannot report yourself, or a message whose author is gone", () => {
  assert.equal(derive({ authorId: ME }, ME, {}).report, false);
  assert.equal(derive({ authorId: null }, ME, {}).report, false);
  // But a departed author's message can still be removed by a moderator.
  assert.equal(derive({ authorId: null }, ME, { canManageMessages: true }).remove, true);
});

test("an optimistic bubble offers nothing at all", () => {
  // Its id is a nonce, not a row. Every action would address a message the
  // database has never heard of.
  const actions = derive({ pending: true, authorId: ME }, ME, {
    canManageMessages: true,
    canPin: true,
    canCreateThread: true,
  });
  assert.deepEqual(Object.values(actions).filter(Boolean), [], "a pending message must offer no actions");
});

test("a system message offers only its link", () => {
  const actions = derive({ postType: "system", authorId: null }, ME, {
    canManageMessages: true,
    canPin: true,
  });
  assert.equal(actions.copyLink, true);
  assert.equal(actions.reply, false);
  assert.equal(actions.remove, false);
  assert.equal(actions.report, false);
});

test("starting a thread is offered once, and only with the permission", () => {
  assert.equal(derive({}, ME, { canCreateThread: true }).startThread, true);
  assert.equal(derive({}, ME, { canCreateThread: false }).startThread, false);
  // A message that already has one offers to open it instead.
  const existing = derive({ threadId: "t" }, ME, { canCreateThread: true });
  assert.equal(existing.startThread, false);
  assert.equal(existing.openThread, true);
});

test("an anonymous viewer owns nothing", () => {
  // viewerId null must not make a message with a null author look like "mine".
  const actions = derive({ authorId: null }, null, {});
  assert.equal(actions.edit, false);
  assert.equal(actions.remove, false);
});

test("pinning follows the permission, not the authorship", () => {
  assert.equal(derive({ authorId: ME }, ME, { canPin: false }).pin, false);
  assert.equal(derive({}, ME, { canPin: true }).pin, true);
});

test("a permalink points at the channel and names the message", () => {
  assert.equal(messagePermalink("https://example.com", "chan", "msg"), "https://example.com/channels/chan?jump=msg");
  // A trailing slash on the origin must not produce a double slash.
  assert.equal(messagePermalink("https://example.com/", "chan", "msg"), "https://example.com/channels/chan?jump=msg");
});

test("the jump budget is bounded and small", () => {
  // Unbounded, a reply to something from months ago walks the whole channel.
  assert.ok(JUMP_PAGE_BUDGET >= 1 && JUMP_PAGE_BUDGET <= 10);
});
