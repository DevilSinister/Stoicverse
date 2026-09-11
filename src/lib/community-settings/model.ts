/**
 * Community identity: limits, defaults, colour maths and validation.
 *
 * Zero imports, so the unit test loads this module directly. Validation throws
 * strings written for the creator, because the caller is a server action whose
 * only job is to relay them.
 */

export type CommunityIdentity = {
  name: string;
  tagline: string;
  logoPath: string | null;
  accentColor: string;
  welcomeMessage: string;
  rules: string;
  showWelcome: boolean;
};

/**
 * What the page renders when the settings row cannot be read.
 *
 * Reads degrade to this; writes hard-fail. Locking the creator out of branding
 * because one query failed is the worse trade, but silently accepting a write
 * against a table that is not there would lose their work.
 */
export const DEFAULT_COMMUNITY_IDENTITY: CommunityIdentity = {
  name: "Stoicverse",
  tagline: "",
  logoPath: null,
  accentColor: "#10B981",
  welcomeMessage: "",
  rules: "",
  showWelcome: true,
};

/** Mirrors the CHECK constraints in 20260911000000. Drift here is a 23514 at runtime. */
export const IDENTITY_LIMITS = {
  name: { min: 2, max: 60 },
  tagline: { max: 140 },
  welcomeMessage: { max: 2000 },
  rules: { max: 10000 },
  logoBytes: 2 * 1024 * 1024,
  logoTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
} as const;

/** The surface the accent is read against — `--color-surface` in globals.css. */
export const SURFACE_COLOR = "#051424";

/** The accent is the focus-ring colour on every page, so 3:1 against the surface is the floor. */
export const MIN_ACCENT_CONTRAST = 3;

/** Eight that clear the contrast floor comfortably. Hex entry stays available behind Advanced. */
export const ACCENT_SWATCHES = [
  { hex: "#10B981", name: "Emerald" },
  { hex: "#38BDF8", name: "Sky" },
  { hex: "#C8A24A", name: "Brass" },
  { hex: "#F472B6", name: "Rose" },
  { hex: "#A78BFA", name: "Iris" },
  { hex: "#FB923C", name: "Amber" },
  { hex: "#2DD4BF", name: "Teal" },
  { hex: "#E2E8F0", name: "Bone" },
] as const;

// Composer and reaction rules are platform constants, not settings — see
// src/lib/community/constants.ts and migration 20260912000000.

/** Mirrors the key list in `is_valid_permission_config`. A key here that is not there is silently never granted. */
export const PERMISSION_KEYS = [
  "post",
  "pin",
  "delete_others",
  "manage_channels",
  "mention_all",
  "mention_tier",
  "bypass_slow_mode",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type PermissionConfig = Partial<Record<PermissionKey, boolean>>;

/**
 * What a moderator can do without any cosmetic role.
 *
 * `mention_all` and `manage_channels` are deliberately absent: @all reaches
 * every active member at once and channel management reshapes what everyone
 * sees. Both need an explicit grant.
 */
export const MODERATOR_BASELINE: PermissionKey[] = ["post", "pin", "delete_others", "mention_tier"];

export const PERMISSION_LABELS: Record<PermissionKey, { label: string; detail: string; escalating: boolean }> = {
  post: { label: "Post", detail: "Write messages in channels they can already open.", escalating: false },
  pin: { label: "Pin", detail: "Pin and unpin any message in those channels.", escalating: false },
  delete_others: {
    label: "Delete others' messages",
    detail: "Hide anyone's message. The original text is kept in the audit log.",
    escalating: true,
  },
  manage_channels: {
    label: "Manage channels",
    detail: "Create, rename, gate, archive and reorder every channel.",
    escalating: true,
  },
  mention_all: { label: "Mention @all", detail: "Notify every active member at once.", escalating: true },
  mention_tier: { label: "Mention @tier-N", detail: "Notify one tier at a time.", escalating: false },
  bypass_slow_mode: {
    label: "Bypass slow mode",
    detail: "Post without waiting out the channel's pace limit.",
    escalating: false,
  },
};

/** Drop unknown keys and non-booleans, exactly as the database CHECK does. */
export function parsePermissionConfig(input: unknown): PermissionConfig {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const known = new Set<string>(PERMISSION_KEYS);
  const result: PermissionConfig = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (known.has(key) && typeof value === "boolean") result[key as PermissionKey] = value;
  }
  return result;
}

export type CommunityModeration = {
  slowModeSeconds: number;
  editWindowMinutes: number;
  deleteRequiresReason: boolean;
  blockedWordMode: "block" | "flag";
  blockedWordMatch: "word" | "substring";
};

/** Mirrors community_settings_moderation_bounds. */
export const MODERATION_LIMITS = {
  slowModeSeconds: { min: 0, max: 21600 },
  editWindowMinutes: { min: 0, max: 10080 },
  phrase: { min: 2, max: 60 },
  maxPhrases: 200,
} as const;

export const DEFAULT_COMMUNITY_MODERATION: CommunityModeration = {
  slowModeSeconds: 0,
  editWindowMinutes: 0,
  deleteRequiresReason: false,
  blockedWordMode: "block",
  blockedWordMatch: "word",
};

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

/**
 * The same match the database trigger performs, so the interface's "test a
 * sentence" box cannot disagree with what actually happens on save.
 *
 * Returns the phrase that matched, or null. This is a speed bump and not a
 * filter: homoglyphs, zero-width joiners and `b-a-d` all pass straight through.
 */
export function matchesBlockedWord(
  body: string,
  phrases: string[],
  mode: CommunityModeration["blockedWordMatch"],
): string | null {
  const haystack = body ?? "";
  for (const raw of phrases) {
    const phrase = raw.trim();
    if (!phrase) continue;
    if (mode === "substring") {
      if (haystack.toLowerCase().includes(phrase.toLowerCase())) return phrase;
      continue;
    }
    // Word mode mirrors the SQL's [^[:alnum:]_] boundaries rather than \b,
    // which treats accented letters differently.
    const pattern = new RegExp(`(^|[^a-zA-Z0-9_])${phrase.replace(REGEX_SPECIALS, "\\$&")}([^a-zA-Z0-9_]|$)`, "i");
    if (pattern.test(haystack)) return phrase;
  }
  return null;
}

export function parseModeration(input: Record<string, unknown>): CommunityModeration {
  const slowModeSeconds = Number.parseInt(String(input.slowModeSeconds ?? ""), 10);
  if (
    !Number.isInteger(slowModeSeconds) ||
    slowModeSeconds < MODERATION_LIMITS.slowModeSeconds.min ||
    slowModeSeconds > MODERATION_LIMITS.slowModeSeconds.max
  ) {
    throw new Error("Slow mode must be between 0 seconds (off) and 6 hours.");
  }

  const editWindowMinutes = Number.parseInt(String(input.editWindowMinutes ?? ""), 10);
  if (
    !Number.isInteger(editWindowMinutes) ||
    editWindowMinutes < MODERATION_LIMITS.editWindowMinutes.min ||
    editWindowMinutes > MODERATION_LIMITS.editWindowMinutes.max
  ) {
    throw new Error("The edit window must be between 0 minutes (never expires) and 7 days.");
  }

  const blockedWordMode = String(input.blockedWordMode ?? "");
  const blockedWordMatch = String(input.blockedWordMatch ?? "");
  if (blockedWordMode !== "block" && blockedWordMode !== "flag") {
    throw new Error("Blocked words must either block the message or flag it.");
  }
  if (blockedWordMatch !== "word" && blockedWordMatch !== "substring") {
    throw new Error("Blocked words must match whole words or any substring.");
  }

  return {
    slowModeSeconds,
    editWindowMinutes,
    deleteRequiresReason: input.deleteRequiresReason === true || input.deleteRequiresReason === "on",
    blockedWordMode,
    blockedWordMatch,
  };
}

/** 2–60 characters, lowercased and trimmed, matching the table's CHECK and unique index. */
export function parseBlockedPhrase(raw: string): string {
  const phrase = raw.trim().toLowerCase();
  if (phrase.length < MODERATION_LIMITS.phrase.min || phrase.length > MODERATION_LIMITS.phrase.max) {
    throw new Error(
      `Each phrase must be between ${MODERATION_LIMITS.phrase.min} and ${MODERATION_LIMITS.phrase.max} characters.`,
    );
  }
  return phrase;
}

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value);
}

function channelLuminance(value: number): number {
  const channel = value / 255;
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance. Returns null rather than NaN for anything that is not a hex colour. */
export function relativeLuminance(hex: string): number | null {
  if (!isHexColor(hex)) return null;
  const red = channelLuminance(parseInt(hex.slice(1, 3), 16));
  const green = channelLuminance(parseInt(hex.slice(3, 5), 16));
  const blue = channelLuminance(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG contrast ratio, 1 to 21. Null when either colour is unparseable. */
export function contrastRatio(foreground: string, background: string = SURFACE_COLOR): number | null {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  if (first === null || second === null) return null;
  const [lighter, darker] = first > second ? [first, second] : [second, first];
  return (lighter + 0.05) / (darker + 0.05);
}

/** One decimal place, the form the interface shows as text beside the swatch. */
export function formatContrast(ratio: number): string {
  return `${Math.round(ratio * 10) / 10}:1`;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Validate one identity submission.
 *
 * Throws the message the creator should read. Every bound here is also a CHECK
 * in the database — this exists to fail earlier and more legibly, never to
 * replace the constraint.
 */
export function parseIdentity(input: Record<string, unknown>): CommunityIdentity {
  const name = text(input.name);
  if (name.length < IDENTITY_LIMITS.name.min || name.length > IDENTITY_LIMITS.name.max) {
    throw new Error(
      `The community name must be between ${IDENTITY_LIMITS.name.min} and ${IDENTITY_LIMITS.name.max} characters.`,
    );
  }

  const tagline = text(input.tagline);
  if (tagline.length > IDENTITY_LIMITS.tagline.max) {
    throw new Error(`The tagline must be ${IDENTITY_LIMITS.tagline.max} characters or fewer.`);
  }

  const welcomeMessage = text(input.welcomeMessage);
  if (welcomeMessage.length > IDENTITY_LIMITS.welcomeMessage.max) {
    throw new Error(`The welcome message must be ${IDENTITY_LIMITS.welcomeMessage.max} characters or fewer.`);
  }

  const rules = text(input.rules);
  if (rules.length > IDENTITY_LIMITS.rules.max) {
    throw new Error(`The rules must be ${IDENTITY_LIMITS.rules.max} characters or fewer.`);
  }

  const accentColor = text(input.accentColor);
  if (!isHexColor(accentColor)) {
    throw new Error("The accent colour must be a six-digit hex value, such as #10B981.");
  }

  const ratio = contrastRatio(accentColor);
  if (ratio === null || ratio < MIN_ACCENT_CONTRAST) {
    throw new Error(
      `That accent reaches ${formatContrast(ratio ?? 1)} against the page background. It is the focus ring on every page, so it needs at least ${MIN_ACCENT_CONTRAST}:1 to stay visible.`,
    );
  }

  const logoPath = text(input.logoPath);

  return {
    name,
    tagline,
    logoPath: logoPath || null,
    accentColor: accentColor.toUpperCase(),
    welcomeMessage,
    rules,
    showWelcome: input.showWelcome === true || input.showWelcome === "on" || input.showWelcome === "true",
  };
}

