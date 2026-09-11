/**
 * The pure half of the emoji picker: build a searchable index from emojibase's
 * compact dataset, search it, apply skin tones, and rank frequently used emoji.
 * Zero runtime imports so the node test runner can load it.
 *
 * The dataset itself is loaded lazily by the picker (`import()` of
 * `emojibase-data/en/compact.json` and `.../shortcodes/emojibase.json`) the
 * first time it opens; nothing here touches the network, which the CSP
 * forbids anyway.
 */

export type CompactEmojiInput = {
  hexcode: string;
  label: string;
  unicode: string;
  group?: number;
  order?: number;
  tags?: string[];
  skins?: CompactEmojiInput[];
};

export type ShortcodeMap = Record<string, string | string[]>;

export type SkinTone = 0 | 1 | 2 | 3 | 4 | 5;

export type EmojiEntry = {
  hexcode: string;
  unicode: string;
  label: string;
  group: number;
  order: number;
  tags: string[];
  shortcodes: string[];
  /** Index = tone 1..5; absent when the emoji has no skin variants. */
  skins?: string[];
};

export type EmojiGroup = { id: number; key: string; label: string };

/**
 * emojibase group ids, Discord's order. Group 2 ("component") holds the skin
 * tone and hair modifiers themselves and is never shown.
 */
export const EMOJI_GROUPS: readonly EmojiGroup[] = [
  { id: 0, key: "smileys", label: "Smileys & emotion" },
  { id: 1, key: "people", label: "People & body" },
  { id: 3, key: "nature", label: "Animals & nature" },
  { id: 4, key: "food", label: "Food & drink" },
  { id: 5, key: "travel", label: "Travel & places" },
  { id: 6, key: "activities", label: "Activities" },
  { id: 7, key: "objects", label: "Objects" },
  { id: 8, key: "symbols", label: "Symbols" },
  { id: 9, key: "flags", label: "Flags" },
];

const SKIN_TONE_HEX: Record<string, SkinTone> = {
  "1F3FB": 1,
  "1F3FC": 2,
  "1F3FD": 3,
  "1F3FE": 4,
  "1F3FF": 5,
};

export const SKIN_TONE_SAMPLES: readonly string[] = ["✋", "✋🏻", "✋🏼", "✋🏽", "✋🏾", "✋🏿"];

export type EmojiIndex = {
  entries: EmojiEntry[];
  byGroup: Map<number, EmojiEntry[]>;
  byUnicode: Map<string, EmojiEntry>;
  byShortcode: Map<string, EmojiEntry>;
};

function shortcodesFor(map: ShortcodeMap, hexcode: string): string[] {
  const raw = map[hexcode];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/**
 * The fully-qualified glyph from a hexcode. emojibase's `unicode` field adds a
 * variation selector to emoji that do not need one (`👍️`), which would make a
 * picked emoji a different reaction key from the same emoji typed or stored;
 * the hexcode carries `FE0F` only where Unicode requires it (`2764-FE0F`).
 */
export function glyphFromHexcode(hexcode: string): string {
  return String.fromCodePoint(...hexcode.split("-").map((part) => Number.parseInt(part, 16)));
}

/** Pick the tone out of a skin variant's hexcode, e.g. `1F44B-1F3FB` → 1. */
function toneOf(skin: CompactEmojiInput): SkinTone | null {
  for (const part of skin.hexcode.split("-")) {
    const tone = SKIN_TONE_HEX[part];
    if (tone) return tone;
  }
  return null;
}

export function buildIndex(data: readonly CompactEmojiInput[], shortcodes: ShortcodeMap): EmojiIndex {
  const shown = new Set(EMOJI_GROUPS.map((group) => group.id));
  const entries: EmojiEntry[] = [];

  for (const raw of data) {
    if (raw.group === undefined || !shown.has(raw.group)) continue;
    const entry: EmojiEntry = {
      hexcode: raw.hexcode,
      unicode: glyphFromHexcode(raw.hexcode),
      label: raw.label,
      group: raw.group,
      order: raw.order ?? Number.MAX_SAFE_INTEGER,
      tags: raw.tags ?? [],
      shortcodes: shortcodesFor(shortcodes, raw.hexcode),
    };
    if (raw.skins && raw.skins.length > 0) {
      // Only single-tone variants; two-tone handshakes and couples stay on their base glyph.
      const skins: string[] = [];
      for (const skin of raw.skins) {
        const tone = toneOf(skin);
        if (tone && skin.hexcode.split("-").filter((part) => SKIN_TONE_HEX[part]).length === 1) {
          skins[tone] = glyphFromHexcode(skin.hexcode);
        }
      }
      if (skins.filter(Boolean).length === 5) entry.skins = skins;
    }
    entries.push(entry);
  }

  entries.sort((a, b) => a.group - b.group || a.order - b.order);

  const byGroup = new Map<number, EmojiEntry[]>();
  const byUnicode = new Map<string, EmojiEntry>();
  const byShortcode = new Map<string, EmojiEntry>();
  for (const entry of entries) {
    const bucket = byGroup.get(entry.group) ?? [];
    bucket.push(entry);
    byGroup.set(entry.group, bucket);
    byUnicode.set(entry.unicode, entry);
    // Also resolve the variation-selector form, so text typed elsewhere still maps back.
    byUnicode.set(`${entry.unicode}️`, entry);
    if (entry.skins) entry.skins.forEach((skin) => skin && byUnicode.set(skin, entry));
    for (const code of entry.shortcodes) byShortcode.set(code, entry);
  }
  return { entries, byGroup, byUnicode, byShortcode };
}

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/^:|:$/g, "").replace(/\s+/g, "_");
}

/**
 * Rank: exact shortcode, label prefix, shortcode prefix, label word, tag, then
 * anything containing the query. Stable within a rank by dataset order.
 */
export function searchEmoji(index: EmojiIndex, query: string, limit = 60): EmojiEntry[] {
  const needle = normalizeQuery(query);
  if (needle.length === 0) return [];
  const spaced = needle.replace(/_/g, " ");
  const ranked: { entry: EmojiEntry; rank: number }[] = [];

  for (const entry of index.entries) {
    const label = entry.label.toLowerCase();
    let rank = Number.POSITIVE_INFINITY;
    if (entry.shortcodes.includes(needle)) rank = 0;
    else if (label.startsWith(spaced)) rank = 1;
    else if (entry.shortcodes.some((code) => code.startsWith(needle))) rank = 2;
    else if (label.split(/[\s:,-]+/).some((word) => word.startsWith(spaced))) rank = 3;
    else if (entry.tags.some((tag) => tag.startsWith(spaced))) rank = 4;
    else if (label.includes(spaced) || entry.shortcodes.some((code) => code.includes(needle))) rank = 5;
    if (rank !== Number.POSITIVE_INFINITY) ranked.push({ entry, rank });
  }

  ranked.sort((a, b) => a.rank - b.rank);
  return ranked.slice(0, limit).map((item) => item.entry);
}

/** The glyph for a tone, or the base glyph when the emoji has no skin variants. */
export function applySkinTone(entry: EmojiEntry, tone: SkinTone): string {
  if (tone === 0 || !entry.skins) return entry.unicode;
  return entry.skins[tone] ?? entry.unicode;
}

export function isSkinTone(value: unknown): value is SkinTone {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5;
}

export type FrecencyRecord = Record<string, { count: number; last: number }>;

export const FRECENCY_LIMIT = 36;

/** Count plus recency, so a burst yesterday does not outrank steady use. */
export function recordUse(record: FrecencyRecord, unicode: string, now: number): FrecencyRecord {
  const previous = record[unicode];
  const next: FrecencyRecord = { ...record, [unicode]: { count: (previous?.count ?? 0) + 1, last: now } };
  const keys = Object.keys(next);
  if (keys.length > FRECENCY_LIMIT) {
    keys.sort((a, b) => scoreOf(next[a], now) - scoreOf(next[b], now));
    for (const key of keys.slice(0, keys.length - FRECENCY_LIMIT)) delete next[key];
  }
  return next;
}

function scoreOf(item: { count: number; last: number }, now: number): number {
  const ageDays = Math.max(0, now - item.last) / 86_400_000;
  return item.count / (1 + ageDays / 7);
}

/**
 * Ranked against the newest use in the record rather than the clock, so this
 * is a pure function of its input and safe to call during render.
 */
export function frequentlyUsed(record: FrecencyRecord, limit = 18): string[] {
  const entries = Object.entries(record);
  const newest = entries.reduce((max, [, item]) => Math.max(max, item.last), 0);
  return entries
    .sort(([, a], [, b]) => scoreOf(b, newest) - scoreOf(a, newest))
    .slice(0, limit)
    .map(([unicode]) => unicode);
}
