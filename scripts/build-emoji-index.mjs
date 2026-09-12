/**
 * Generate the emoji payload the picker fetches.
 *
 *   node scripts/build-emoji-index.mjs
 *
 * The picker used to `import()` emojibase's own files — 645 KB of
 * `compact.json` plus 185 KB of shortcodes, shipped as JavaScript chunks and
 * merged on every first open. This does that work once, here, and commits the
 * result as a static file the browser can cache like any other asset.
 *
 * The transform is not reimplemented: this imports the very `buildIndex` the
 * picker used to call, so the shipped file is the same index it always built.
 * `tests/emoji-payload.test.mjs` regenerates and compares, which is what stops
 * the committed file drifting from the dataset behind it.
 */

import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { buildIndex, toPayload } from "../src/components/community/emoji/emoji-index.ts";

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function generate() {
  const compact = require("emojibase-data/en/compact.json");
  const shortcodes = require("emojibase-data/en/shortcodes/emojibase.json");
  // No spaces in the JSON: this is machine-read, and the whitespace was a
  // meaningful share of the bytes.
  return JSON.stringify(toPayload(buildIndex(compact, shortcodes)));
}

export const OUTPUT = path.join(root, "public", "emoji", "index.v1.json");

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const json = generate();
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, json, "utf8");
  const entries = Object.values(JSON.parse(json).g).reduce((total, rows) => total + rows.length, 0);
  console.log(`wrote ${path.relative(root, OUTPUT)} — ${entries} emoji, ${(json.length / 1024).toFixed(0)} KB`);
}
