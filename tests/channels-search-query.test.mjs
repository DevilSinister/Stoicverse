import assert from "node:assert/strict";
import test from "node:test";

import { parseSearchQuery, describeFilters, MIN_TEXT } from "../src/lib/channels/search-query.ts";

const DICT = {
  users: [
    { id: "u-ada", name: "Ada" },
    { id: "u-adam", name: "Adam" },
    { id: "u-ada-lovelace", name: "Ada Lovelace" },
  ],
  channels: [
    { id: "c-general", name: "general" },
    { id: "c-general-chat", name: "general chat" },
  ],
};

const parse = (raw) => parseSearchQuery(raw, DICT);

/** The ISO instant for local midnight on a given day — timezone-independent. */
const localDay = (y, m, d) => new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();

test("plain text is just text", () => {
  const { filters, runnable } = parse("stoic wealth");
  assert.equal(filters.text, "stoic wealth");
  assert.equal(filters.authorId, null);
  assert.equal(runnable, true);
});

test("from: resolves to an id, and a longer name wins", () => {
  // `from:Ada` must not claim Adam, and `from:Ada Lovelace` must not be cut
  // short by the member called Ada.
  assert.equal(parse("from:Ada").filters.authorId, "u-ada");
  assert.equal(parse("from:Adam").filters.authorId, "u-adam");
  assert.equal(parse("from:Ada Lovelace").filters.authorId, "u-ada-lovelace");
});

test("an unmatched from: is a problem, never silent text", () => {
  // Quietly searching for the literal word returns everyone's messages and
  // looks like it worked.
  const { problems, runnable, filters } = parse("from:Nobody hello");
  assert.equal(runnable, false);
  assert.equal(filters.authorId, null);
  assert.ok(problems.some((line) => line.includes("Nobody")));
});

test("a quoted value takes the whole phrase", () => {
  assert.equal(parse('from:"Ada Lovelace"').filters.authorId, "u-ada-lovelace");
  // And an unterminated quote does not run off and eat the rest as a name.
  assert.equal(parse('from:"Ada').filters.authorId, "u-ada");
});

test("in: accepts the channel with or without a hash", () => {
  assert.equal(parse("in:general").filters.channelId, "c-general");
  assert.equal(parse("in:#general").filters.channelId, "c-general");
  assert.equal(parse("in:#general chat").filters.channelId, "c-general-chat");
});

test("has: takes three values and rejects the rest", () => {
  assert.equal(parse("has:link").filters.has, "link");
  assert.equal(parse("has:IMAGE").filters.has, "image");
  assert.equal(parse("has:file").filters.has, "file");
  const bad = parse("has:banana");
  assert.equal(bad.runnable, false);
  assert.ok(bad.problems.some((line) => line.includes("link, image or file")));
});

test("dates are the start of that day where the reader is", () => {
  // Not UTC midnight: a UTC boundary moves the cut by a day for most of the
  // world, so `before:2026-09-01` would quietly include the 1st.
  const { filters } = parse("after:2026-08-01 before:2026-09-01");
  assert.equal(filters.after, localDay(2026, 8, 1));
  assert.equal(filters.before, localDay(2026, 9, 1));
});

test("an impossible date is reported, not coerced", () => {
  // new Date(2026, 12, 45) rolls happily into the next year.
  for (const bad of ["before:2026-13-01", "before:2026-02-30", "before:yesterday", "before:01-09-2026"]) {
    const parsed = parse(bad);
    assert.equal(parsed.runnable, false, `${bad} should not be runnable`);
    assert.equal(parsed.filters.before, null);
  }
});

test("an empty date range is caught before it reaches the database", () => {
  const parsed = parse("after:2026-09-01 before:2026-08-01");
  assert.equal(parsed.runnable, false);
  assert.ok(parsed.problems.some((line) => line.includes("date range is empty")));
});

test("a filter alone is a runnable search", () => {
  // "Everything Ada posted" names no words and is the most precise query the
  // syntax can express.
  const parsed = parse("from:Ada");
  assert.equal(parsed.filters.text, "");
  assert.equal(parsed.runnable, true);
});

test("nothing at all is not runnable, and says nothing about it", () => {
  const parsed = parse("   ");
  assert.equal(parsed.runnable, false);
  assert.deepEqual(parsed.problems, [], "an empty box is not an error");
});

test("one loose character needs a filter to be worth running", () => {
  assert.equal(parse("a").runnable, false);
  assert.equal(parse("a from:Ada").runnable, true);
  assert.ok(MIN_TEXT >= 2);
});

test("an unknown key is text, not a swallowed filter", () => {
  // Otherwise any message containing a colon becomes unsearchable.
  const { filters, runnable } = parse("note:this thing");
  assert.equal(filters.text, "note:this thing");
  assert.equal(runnable, true);
});

test("filters and text coexist in any order", () => {
  const a = parse("from:Ada in:general has:link hello");
  const b = parse("hello has:link in:general from:Ada");
  assert.deepEqual(a.filters, b.filters);
  assert.equal(a.filters.text, "hello");
  assert.equal(a.filters.authorId, "u-ada");
  assert.equal(a.filters.channelId, "c-general");
  assert.equal(a.filters.has, "link");
});

test("a filter with no value is reported", () => {
  const parsed = parse("from: hello");
  assert.equal(parsed.runnable, false);
  assert.ok(parsed.problems.some((line) => line.includes("needs a value")));
});

test("the chips say out loud what the search is doing", () => {
  const { filters } = parse("from:Ada in:general has:image after:2026-08-01");
  const chips = describeFilters(filters, DICT);
  // The date must survive the round trip: the filter is stored as local
  // midnight, whose UTC prefix is the previous day everywhere east of
  // Greenwich. Slicing the ISO string told the reader their filter was a day
  // off when it was exactly right.
  assert.deepEqual(chips, ["from Ada", "in #general", "with an image", "after 2026-08-01"]);
});
