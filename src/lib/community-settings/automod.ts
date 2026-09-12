/**
 * AutoMod rules: kinds, bounds, and the keyword compiler.
 *
 * Zero imports, so the unit test loads this module directly. Validation throws
 * strings written for the creator, because the caller is a server action whose
 * only job is to relay them.
 *
 * `compileKeywordPattern` is a character-for-character mirror of
 * `public.community_compile_keyword_pattern` in migration 20260912040000.
 * `tests/community-automod.test.mjs` pins the exact output, because the
 * "test a sentence" box in the interface is worthless if it disagrees with
 * what the database does on save.
 */

export const AUTOMOD_KINDS = ["keyword", "preset", "mention_spam", "link_filter", "duplicate_spam"] as const;
export type AutomodKind = (typeof AUTOMOD_KINDS)[number];

export function isAutomodKind(value: unknown): value is AutomodKind {
  return typeof value === "string" && (AUTOMOD_KINDS as readonly string[]).includes(value);
}

export const AUTOMOD_MATCH_MODES = ["word", "substring"] as const;
export type AutomodMatchMode = (typeof AUTOMOD_MATCH_MODES)[number];

/** Mirrors every CHECK on `community_automod_rules`. Drift here is a 23514 at runtime. */
export const AUTOMOD_LIMITS = {
  rules: 25,
  name: { min: 2, max: 60 },
  keyword: { min: 2, max: 60 },
  keywords: { max: 200 },
  mentionLimit: { min: 1, max: 50 },
  allowedDomains: { max: 100 },
  duplicateCount: { min: 2, max: 20 },
  duplicateWindowSeconds: { min: 10, max: 3600 },
  // 60 seconds to 28 days, the same range a moderator's own timeout allows.
  timeoutSeconds: { min: 60, max: 2419200 },
} as const;

/**
 * The one wildcard a moderator may type, and what it expands to.
 *
 * Bounded at 30 rather than `.*`: an unbounded wildcard between two
 * alternations is how a phrase list becomes a stalled connection.
 */
export const KEYWORD_WILDCARD_BOUND = 30;

export type AutomodRule = {
  id: string | null;
  name: string;
  kind: AutomodKind;
  enabled: boolean;
  keywords: string[];
  matchMode: AutomodMatchMode;
  presetKey: string | null;
  mentionLimit: number | null;
  allowedDomains: string[];
  duplicateCount: number | null;
  duplicateWindowSeconds: number | null;
  actionBlock: boolean;
  alertChannelId: string | null;
  timeoutSeconds: number | null;
};

export type AutomodPreset = {
  key: string;
  label: string;
  description: string;
  phraseCount: number;
};

export type AutomodExemptions = { roleIds: string[]; channelIds: string[] };

/** What a new rule of each kind starts as, so the editor never opens on an invalid shape. */
export const AUTOMOD_RULE_DEFAULTS: Record<AutomodKind, Partial<AutomodRule>> = {
  keyword: { keywords: [], matchMode: "word", actionBlock: true },
  preset: { presetKey: null, matchMode: "word", actionBlock: true },
  mention_spam: { mentionLimit: 5, actionBlock: true },
  link_filter: { allowedDomains: [], actionBlock: true },
  duplicate_spam: { duplicateCount: 5, duplicateWindowSeconds: 60, actionBlock: true },
};

export const AUTOMOD_KIND_LABELS: Record<AutomodKind, { label: string; detail: string }> = {
  keyword: { label: "Block custom words", detail: "Words and phrases you type, with * as a wildcard." },
  preset: { label: "Block a preset list", detail: "A curated list, kept up to date for you." },
  mention_spam: { label: "Block mention spam", detail: "Messages that mention more people than you allow." },
  link_filter: { label: "Block suspicious links", detail: "Links to anywhere outside your allowed domains." },
  duplicate_spam: { label: "Block spam", detail: "The same message posted over and over." },
};

/** Only these characters may appear in a keyword — mirrors `private.automod_assert_keywords`. */
const KEYWORD_ALLOWED = /^[0-9A-Za-z_'* -]+$/;

// Every regex metacharacter except `*`, which the compiler expands rather than
// escapes. Kept in the same order as the SQL character class so the two can be
// read side by side.
const ESCAPE_PATTERN = /[\^$.|?+()[\]{}\\]/g;

/**
 * Plain text plus `*`, turned into one POSIX alternation.
 *
 * Returns null when nothing usable is left, which the database treats as "that
 * rule has no usable keywords" rather than as a rule matching everything.
 */
export function compileKeywordPattern(keywords: string[], mode: AutomodMatchMode): string | null {
  if (!Array.isArray(keywords) || keywords.length === 0) return null;
  if (mode !== "word" && mode !== "substring") {
    throw new Error("AutoMod match mode must be word or substring.");
  }

  const parts: string[] = [];
  for (const raw of keywords) {
    const cleaned = String(raw ?? "")
      .trim()
      .toLowerCase();
    if (cleaned === "") continue;
    parts.push(cleaned.replace(ESCAPE_PATTERN, "\\$&").replaceAll("*", `[[:alnum:]_]{0,${KEYWORD_WILDCARD_BOUND}}`));
  }
  if (parts.length === 0) return null;

  const joined = parts.join("|");
  if (mode === "word") {
    return `(^|[^[:alnum:]_])(${joined})([^[:alnum:]_]|$)`;
  }
  return `(${joined})`;
}

/**
 * The compiled POSIX pattern as a JavaScript regex.
 *
 * `[[:alnum:]]` has no JavaScript equivalent, so it becomes `[0-9A-Za-z]`.
 * The two disagree on accented letters — POSIX in a UTF-8 database counts `é`
 * as alphanumeric and this does not. That makes the browser preview very
 * slightly more eager to report a match at a word boundary than the database
 * is. It is the same speed-bump caveat the blocked-word list carried: this
 * filter stops the careless, not the determined, and `b-a-d` walks through
 * either way.
 */
function toJsRegex(pattern: string): RegExp {
  return new RegExp(pattern.replaceAll("[:alnum:]", "0-9A-Za-z"), "i");
}

/** Replaces `matchesBlockedWord`. Returns whether the body trips the rule. */
export function matchesKeywordRule(body: string, keywords: string[], mode: AutomodMatchMode): boolean {
  const pattern = compileKeywordPattern(keywords, mode);
  if (pattern === null) return false;
  return toJsRegex(pattern).test(body ?? "");
}

/** 2–60 characters, lowercased and trimmed, restricted to what the database accepts. */
export function parseKeyword(raw: string): string {
  const keyword = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (keyword.length < AUTOMOD_LIMITS.keyword.min || keyword.length > AUTOMOD_LIMITS.keyword.max) {
    throw new Error(
      `Each keyword must be between ${AUTOMOD_LIMITS.keyword.min} and ${AUTOMOD_LIMITS.keyword.max} characters.`,
    );
  }
  if (!KEYWORD_ALLOWED.test(keyword)) {
    throw new Error(
      "Keywords may only contain letters, numbers, spaces, hyphens, apostrophes, underscores and * as a wildcard.",
    );
  }
  return keyword;
}

/** A bare hostname. Deliberately not a URL: `https://x.com/path` is not a domain. */
export function parseDomain(raw: string): string {
  const domain = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  if (!/^[0-9a-z]([0-9a-z-]*[0-9a-z])?(\.[0-9a-z]([0-9a-z-]*[0-9a-z])?)+$/.test(domain)) {
    throw new Error(`"${raw}" is not a domain. Enter a hostname such as youtube.com.`);
  }
  return domain;
}

function requireInt(value: unknown, bounds: { min: number; max: number }, message: string): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed < bounds.min || parsed > bounds.max) {
    throw new Error(message);
  }
  return parsed;
}

/**
 * Validates a rule into the shape `community_automod_rule_save` parses.
 *
 * Fields the kind does not use are left at their empty value rather than
 * carried through, because the database's per-kind CHECK rejects a rule
 * holding settings its kind will never read, and a 23514 is a worse error
 * message than any of these.
 */
export function parseAutomodRule(input: Record<string, unknown>): AutomodRule {
  const kind = input.kind;
  if (!isAutomodKind(kind)) throw new Error("That is not an AutoMod rule kind.");

  const name = String(input.name ?? "").trim();
  if (name.length < AUTOMOD_LIMITS.name.min || name.length > AUTOMOD_LIMITS.name.max) {
    throw new Error(
      `A rule name must be between ${AUTOMOD_LIMITS.name.min} and ${AUTOMOD_LIMITS.name.max} characters.`,
    );
  }

  const actionBlock = input.actionBlock === true || input.actionBlock === "on";
  const rawTimeout = String(input.timeoutSeconds ?? "").trim();
  const timeoutSeconds =
    rawTimeout === ""
      ? null
      : requireInt(rawTimeout, AUTOMOD_LIMITS.timeoutSeconds, "A timeout must be between 1 minute and 28 days.");
  if (timeoutSeconds !== null && !actionBlock) {
    throw new Error("A rule that times someone out has to block the message too.");
  }

  const rule: AutomodRule = {
    id: typeof input.id === "string" && input.id !== "" ? input.id : null,
    name,
    kind,
    enabled: input.enabled !== false && input.enabled !== "false",
    keywords: [],
    matchMode: "word",
    presetKey: null,
    mentionLimit: null,
    allowedDomains: [],
    duplicateCount: null,
    duplicateWindowSeconds: null,
    actionBlock,
    alertChannelId:
      typeof input.alertChannelId === "string" && input.alertChannelId !== "" ? input.alertChannelId : null,
    timeoutSeconds,
  };

  const matchMode = String(input.matchMode ?? "word");
  if (matchMode !== "word" && matchMode !== "substring") {
    throw new Error("Keywords must match whole words or any substring.");
  }

  if (kind === "keyword") {
    const raw = Array.isArray(input.keywords) ? input.keywords : [];
    const unique = [...new Set(raw.map((entry) => parseKeyword(String(entry))))];
    if (unique.length === 0) throw new Error("Add at least one word for this rule to look for.");
    if (unique.length > AUTOMOD_LIMITS.keywords.max) {
      throw new Error(`A rule can hold at most ${AUTOMOD_LIMITS.keywords.max} keywords.`);
    }
    rule.keywords = unique;
    rule.matchMode = matchMode;
  } else if (kind === "preset") {
    const presetKey = String(input.presetKey ?? "").trim();
    if (presetKey === "") throw new Error("Choose which preset list this rule uses.");
    rule.presetKey = presetKey;
    rule.matchMode = matchMode;
  } else if (kind === "mention_spam") {
    rule.mentionLimit = requireInt(
      input.mentionLimit,
      AUTOMOD_LIMITS.mentionLimit,
      `The mention limit must be between ${AUTOMOD_LIMITS.mentionLimit.min} and ${AUTOMOD_LIMITS.mentionLimit.max}.`,
    );
  } else if (kind === "link_filter") {
    const raw = Array.isArray(input.allowedDomains) ? input.allowedDomains : [];
    const domains = [...new Set(raw.map((entry) => parseDomain(String(entry))))];
    if (domains.length > AUTOMOD_LIMITS.allowedDomains.max) {
      throw new Error(`A rule can allow at most ${AUTOMOD_LIMITS.allowedDomains.max} domains.`);
    }
    // An empty list is meaningful and allowed: it blocks every link.
    rule.allowedDomains = domains;
  } else {
    rule.duplicateCount = requireInt(
      input.duplicateCount,
      AUTOMOD_LIMITS.duplicateCount,
      `The repeat count must be between ${AUTOMOD_LIMITS.duplicateCount.min} and ${AUTOMOD_LIMITS.duplicateCount.max}.`,
    );
    rule.duplicateWindowSeconds = requireInt(
      input.duplicateWindowSeconds,
      AUTOMOD_LIMITS.duplicateWindowSeconds,
      "The repeat window must be between 10 seconds and 1 hour.",
    );
  }

  return rule;
}

/** "1 minute", "2 hours", "7 days" — the label on a timeout picker and a rule summary. */
export function formatDuration(seconds: number): string {
  if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  if (seconds < 86400) {
    const hours = Math.round(seconds / 3600);
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const days = Math.round(seconds / 86400);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** The timeout stops a moderator reaches for, so the common values are one click. */
export const TIMEOUT_STOPS = [60, 300, 600, 3600, 21600, 86400, 604800, 2419200] as const;

/**
 * The one-line summary under a rule's name in the list, so the operator can
 * read what a rule does without opening it.
 */
export function describeRule(rule: AutomodRule, presets: AutomodPreset[] = []): string {
  let trigger: string;
  switch (rule.kind) {
    case "keyword":
      trigger =
        rule.keywords.length === 1
          ? `1 word, matched as ${rule.matchMode === "word" ? "a whole word" : "any substring"}`
          : `${rule.keywords.length} words, matched as ${rule.matchMode === "word" ? "whole words" : "any substring"}`;
      break;
    case "preset": {
      const preset = presets.find((entry) => entry.key === rule.presetKey);
      trigger = preset ? `the ${preset.label} list (${preset.phraseCount} phrases)` : "a preset list";
      break;
    }
    case "mention_spam":
      trigger = `more than ${rule.mentionLimit} mentions in one message`;
      break;
    case "link_filter":
      trigger =
        rule.allowedDomains.length === 0
          ? "any link"
          : `links outside ${rule.allowedDomains.length} allowed domain${rule.allowedDomains.length === 1 ? "" : "s"}`;
      break;
    default:
      trigger = `the same message ${rule.duplicateCount} times in ${formatDuration(rule.duplicateWindowSeconds ?? 0)}`;
  }

  const consequences = [rule.actionBlock ? "blocks the message" : "alerts moderators"];
  if (rule.timeoutSeconds !== null) {
    consequences.push(`times the member out for ${formatDuration(rule.timeoutSeconds)}`);
  }

  return `Catches ${trigger}, then ${consequences.join(" and ")}.`;
}
