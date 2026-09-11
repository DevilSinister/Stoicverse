import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MIME_TYPES,
  ATTACHMENTS_PER_MESSAGE,
  formatBytes,
  isAllowedAttachmentType,
  isValidReactionToken,
  MAX_DISTINCT_REACTIONS_PER_MESSAGE,
  MESSAGE_MAX_CHARS,
  parseCustomEmojiToken,
  QUICK_REACTIONS,
  REACTION_MAX_CHARS,
} from "../src/lib/community/constants.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the constants equal the numbers the database enforces", async () => {
  const migration = await read("supabase/migrations/20260912000000_community_global_composer_constants.sql");
  const composerRules = await read("supabase/migrations/20260911010000_community_composer_rules.sql");

  assert.equal(MESSAGE_MAX_CHARS, 10000);
  assert.match(composerRules, /check \(char_length\(body\) <= 10000\)/, "the fixed CHECK on posts");
  assert.match(migration, new RegExp(`file_size_limit = ${ATTACHMENT_MAX_BYTES}`));
  for (const type of ATTACHMENT_MIME_TYPES) assert.match(migration, new RegExp(`'${type.replace("/", "\\/")}'`));
  assert.match(migration, new RegExp(`\\{1,${REACTION_MAX_CHARS}\\}`));
  assert.equal(ATTACHMENTS_PER_MESSAGE, 10);
  assert.equal(MAX_DISTINCT_REACTIONS_PER_MESSAGE, 20);
  assert.equal(QUICK_REACTIONS.length, 12);
  assert.equal(new Set(QUICK_REACTIONS).size, 12);
});

test("the reaction token validator accepts emoji and custom tokens and nothing else", () => {
  for (const ok of ["👍", "❤️", "👨‍👩‍👧‍👦", "🇯🇵", "1️⃣", "#⃣", "🏳️‍🌈", "<:stoic_owl:0f2a4d1e-8b6c-4d3e-9a1b-2c3d4e5f6a7b>"]) {
    assert.equal(isValidReactionToken(ok), true, ok);
  }
  // Parity with PostgreSQL, which counts code points: sixteen thumbs pass, seventeen do not.
  assert.equal(isValidReactionToken("👍".repeat(16)), true);
  assert.equal(isValidReactionToken("👍".repeat(17)), false);
  for (const bad of [
    "",
    "a",
    ":kek:",
    "<:Kek:0f2a4d1e-8b6c-4d3e-9a1b-2c3d4e5f6a7b>",
    "<:x:not-a-uuid>",
    "👍 ",
    "x".repeat(17),
    3,
    null,
  ]) {
    assert.equal(isValidReactionToken(bad), false, String(bad));
  }
  assert.deepEqual(parseCustomEmojiToken("<:stoic_owl:0f2a4d1e-8b6c-4d3e-9a1b-2c3d4e5f6a7b>"), {
    name: "stoic_owl",
    id: "0f2a4d1e-8b6c-4d3e-9a1b-2c3d4e5f6a7b",
  });
  assert.equal(parseCustomEmojiToken("👍"), null);
});

test("attachment helpers mirror the bucket allow-list and read like a human", () => {
  assert.equal(isAllowedAttachmentType("application/pdf"), true);
  assert.equal(isAllowedAttachmentType("image/svg+xml"), false, "SVG can carry script; the bucket refuses it");
  assert.equal(formatBytes(ATTACHMENT_MAX_BYTES), "25 MB");
  assert.equal(formatBytes(2048), "2 KB");
  assert.equal(formatBytes(512), "512 B");
});
