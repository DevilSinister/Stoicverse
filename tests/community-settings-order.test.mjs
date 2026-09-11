import assert from "node:assert/strict";
import test from "node:test";

import { canMove, describeMove, moveWithin } from "../src/lib/community-settings/order.ts";

const row = (id, isArchived = false) => ({ id, isArchived });
const ids = (items) => items.map((item) => item.id);

test("a move swaps with the adjacent row", () => {
  const items = [row("a"), row("b"), row("c")];
  assert.deepEqual(ids(moveWithin(items, "b", "up")), ["b", "a", "c"]);
  assert.deepEqual(ids(moveWithin(items, "b", "down")), ["a", "c", "b"]);
});

test("a move at either end returns the same array, so no write is committed", () => {
  const items = [row("a"), row("b")];
  assert.equal(moveWithin(items, "a", "up"), items);
  assert.equal(moveWithin(items, "b", "down"), items);
  assert.equal(moveWithin(items, "missing", "up"), items);
});

test("archived rows are skipped over rather than displaced", () => {
  // #b is archived and carries no reorder control. Moving #c up must jump it
  // over #b to #a's slot, not swap it into a position the members cannot see.
  const items = [row("a"), row("b", true), row("c")];
  assert.deepEqual(ids(moveWithin(items, "c", "up")), ["c", "b", "a"]);
});

test("an archived row cannot be moved at all", () => {
  const items = [row("a"), row("b", true), row("c")];
  assert.equal(moveWithin(items, "b", "up"), items);
  assert.equal(moveWithin(items, "b", "down"), items);
});

test("a row whose only neighbours are archived has nowhere to go", () => {
  const items = [row("a", true), row("b"), row("c", true)];
  assert.equal(canMove(items, "b", "up"), false);
  assert.equal(canMove(items, "b", "down"), false);
});

test("canMove agrees with moveWithin at the boundaries", () => {
  const items = [row("a"), row("b"), row("c")];
  assert.equal(canMove(items, "a", "up"), false);
  assert.equal(canMove(items, "a", "down"), true);
  assert.equal(canMove(items, "c", "down"), false);
});

test("the announcement names the position, the total and the container", () => {
  assert.equal(
    describeMove("#daily-reflections", 3, 7, "Foundations"),
    "#daily-reflections moved to position 3 of 7 in Foundations.",
  );
  assert.equal(describeMove("Foundations", 1, 4), "Foundations moved to position 1 of 4.");
});
