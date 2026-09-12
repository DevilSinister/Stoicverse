import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildIndex,
  EMOJI_GROUPS,
  EMOJI_PAYLOAD_URL,
  EMOJI_PAYLOAD_VERSION,
  fromPayload,
  searchEmoji,
} from "../src/components/community/emoji/emoji-index.ts";
import { generate } from "../scripts/build-emoji-index.mjs";

const require = createRequire(import.meta.url);
const committed = await readFile(new URL("../public/emoji/index.v1.json", import.meta.url), "utf8");

test("the committed emoji payload is what the generator produces", () => {
  // The file is generated and checked in. Without this, a dataset upgrade
  // would leave the shipped index silently describing the old one, and the
  // picker would be correct about emoji nobody has any more.
  assert.equal(
    committed,
    generate(),
    "public/emoji/index.v1.json is stale — run `node scripts/build-emoji-index.mjs`",
  );
});

test("the payload is a fraction of the dataset it replaces", () => {
  const raw =
    JSON.stringify(require("emojibase-data/en/compact.json")).length +
    JSON.stringify(require("emojibase-data/en/shortcodes/emojibase.json")).length;
  // It was 830 KB of JSON shipped as JavaScript chunks and merged on every
  // first open. A regression here is somebody putting a field back.
  assert.ok(
    committed.length < raw / 3,
    `expected well under a third of ${Math.round(raw / 1024)} KB, got ${Math.round(committed.length / 1024)} KB`,
  );
  assert.ok(committed.length < 300_000, `${Math.round(committed.length / 1024)} KB is larger than intended`);
});

test("the shipped payload rebuilds the same index the dataset does", () => {
  const full = buildIndex(
    require("emojibase-data/en/compact.json"),
    require("emojibase-data/en/shortcodes/emojibase.json"),
  );
  const shipped = fromPayload(JSON.parse(committed));

  assert.equal(shipped.entries.length, full.entries.length);
  for (const group of EMOJI_GROUPS) {
    assert.deepEqual(
      (shipped.byGroup.get(group.id) ?? []).map((entry) => entry.hexcode),
      (full.byGroup.get(group.id) ?? []).map((entry) => entry.hexcode),
      `${group.label} differs`,
    );
  }

  // The fields the picker actually reads, on an emoji that exercises all of
  // them: a label, tags, a shortcode and five skin tones.
  const wave = shipped.byShortcode.get("wave");
  assert.ok(wave, "the shortcode index survived the round trip");
  assert.equal(wave.unicode, "👋");
  assert.equal(wave.skins?.filter(Boolean).length, 5);
  assert.ok(wave.tags.includes("wave"));

  // Search is the thing tags exist for.
  assert.ok(searchEmoji(shipped, "joy").length > 0);
  assert.equal(searchEmoji(shipped, "grinning face")[0].unicode, "😀");
});

test("the payload names its version in the file and in the body", () => {
  // A browser caching one of these must never read it as the other.
  assert.equal(JSON.parse(committed).v, EMOJI_PAYLOAD_VERSION);
  assert.match(EMOJI_PAYLOAD_URL, new RegExp(`\\.v${EMOJI_PAYLOAD_VERSION}\\.json$`));
});
