import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import {
  applySkinTone,
  buildIndex,
  EMOJI_GROUPS,
  frequentlyUsed,
  isSkinTone,
  normalizeQuery,
  recordUse,
  searchEmoji,
} from "../src/components/community/emoji/emoji-index.ts";

const require = createRequire(import.meta.url);
const compact = require("emojibase-data/en/compact.json");
const shortcodes = require("emojibase-data/en/shortcodes/emojibase.json");

const index = buildIndex(compact, shortcodes);

test("the index covers every shown group and drops components and uncategorised glyphs", () => {
  assert.ok(index.entries.length > 1500, `expected the full set, got ${index.entries.length}`);
  for (const group of EMOJI_GROUPS) {
    assert.ok((index.byGroup.get(group.id) ?? []).length > 0, group.label);
  }
  assert.equal(index.byGroup.has(2), false, "skin tone modifiers are not pickable");
  assert.equal(index.entries.some((entry) => entry.label.startsWith("regional indicator")), false);
  // Sorted by group then dataset order, so the grid reads like Discord's.
  for (let i = 1; i < index.entries.length; i += 1) {
    const prev = index.entries[i - 1];
    const next = index.entries[i];
    assert.ok(prev.group < next.group || (prev.group === next.group && prev.order <= next.order));
  }
});

test("skin tones apply only where the dataset has all five single-tone variants", () => {
  const wave = index.byUnicode.get("👋");
  assert.ok(wave?.skins, "waving hand has skin tones");
  assert.equal(applySkinTone(wave, 0), "👋");
  assert.equal(applySkinTone(wave, 3), "👋🏽");
  assert.equal(index.byUnicode.get("👋🏽"), wave, "a toned glyph resolves back to its base entry");

  const fire = index.byUnicode.get("🔥");
  assert.equal(fire.skins, undefined);
  assert.equal(applySkinTone(fire, 5), "🔥", "no variants means the base glyph");
  assert.equal(isSkinTone(5), true);
  assert.equal(isSkinTone(6), false);
});

test("search ranks exact shortcodes and label prefixes ahead of loose matches", () => {
  assert.equal(normalizeQuery(":Thumbs Up:"), "thumbs_up");
  const thumbs = searchEmoji(index, "thumbs_up");
  assert.equal(thumbs[0].unicode, "👍");
  const fire = searchEmoji(index, "fire");
  assert.equal(fire[0].unicode, "🔥");
  assert.ok(searchEmoji(index, "heart").length > 5);
  assert.deepEqual(searchEmoji(index, "   "), []);
  assert.ok(searchEmoji(index, "zzzzqqq").length === 0);
  assert.ok(searchEmoji(index, "a", 10).length <= 10, "the limit holds");
  const byShortcode = index.byShortcode.get("joy");
  assert.equal(byShortcode?.unicode, "😂");
});

test("frequently used favours steady use over a stale burst and stays bounded", () => {
  const now = Date.UTC(2026, 8, 11);
  const day = 86_400_000;
  let record = {};
  for (let i = 0; i < 5; i += 1) record = recordUse(record, "🎉", now - 40 * day);
  record = recordUse(record, "👍", now - day);
  record = recordUse(record, "👍", now);
  assert.deepEqual(frequentlyUsed(record, 2), ["👍", "🎉"]);

  for (let i = 0; i < 50; i += 1) record = recordUse(record, `e${i}`, now);
  assert.ok(Object.keys(record).length <= 36);
  assert.ok("👍" in record, "recent, repeated use survives the cap");
});
