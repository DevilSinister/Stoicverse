import assert from "node:assert/strict";
import test from "node:test";

import { resolveShortcut } from "../src/lib/channels/shortcuts.ts";

const press = (over = {}) =>
  resolveShortcut({
    key: "a",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    typing: false,
    ...over,
  });

test("Ctrl+K and Cmd+K both open the search palette", () => {
  // Renamed from "quickSwitcher" when the two meanings of Ctrl+K merged: the
  // palette opens on the channel list, so it is still the switcher, and typing
  // widens it to people and messages rather than changing tool.
  assert.equal(press({ key: "k", ctrlKey: true }), "search");
  assert.equal(press({ key: "k", metaKey: true }), "search");
  assert.equal(press({ key: "K", metaKey: true }), "search");
});

test("the palette opens from inside the composer too", () => {
  // Somebody halfway through a message who wants another channel should not
  // have to leave the box first, and no text field binds Ctrl+K.
  assert.equal(press({ key: "k", ctrlKey: true, typing: true }), "search");
});

test("a bare k is a letter, not a shortcut", () => {
  assert.equal(press({ key: "k" }), null);
  assert.equal(press({ key: "k", typing: true }), null);
});

test("Alt moves between channels and Ctrl does not", () => {
  assert.equal(press({ key: "ArrowUp", altKey: true }), "previousChannel");
  assert.equal(press({ key: "ArrowDown", altKey: true }), "nextChannel");
  // Ctrl+arrow is word-wise caret movement in every text field on every
  // platform; taking it would break typing to save a keystroke.
  assert.equal(press({ key: "ArrowUp", ctrlKey: true }), null);
  assert.equal(press({ key: "ArrowDown", ctrlKey: true }), null);
});

test("Alt+arrow still moves while typing, because no text field uses it", () => {
  assert.equal(press({ key: "ArrowDown", altKey: true, typing: true }), "nextChannel");
});

test("Escape closes the top layer, but never out of a text field", () => {
  assert.equal(press({ key: "Escape" }), "closeTopmost");
  // Inside the composer, Escape already cancels a reply or abandons an edit.
  assert.equal(press({ key: "Escape", typing: true }), null);
});

test("the up arrow edits the last message only from inside a text field", () => {
  assert.equal(press({ key: "ArrowUp", typing: true }), "editLastMessage");
  // Outside one there is no composer to be empty, so it means nothing.
  assert.equal(press({ key: "ArrowUp" }), null);
  // Shift+Up is selecting text, not recalling a message.
  assert.equal(press({ key: "ArrowUp", shiftKey: true, typing: true }), null);
});

test("an unbound key resolves to nothing at all", () => {
  assert.equal(press({ key: "Enter" }), null);
  assert.equal(press({ key: "Tab", shiftKey: true }), null);
});
