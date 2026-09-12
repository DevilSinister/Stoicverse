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

// Roles, their permission vocabulary and their validation live in
// permissions.ts and role-model.ts as of migration 20260912010000. The
// seven-key grants-only `permission_config` they replaced is gone from the
// database, so a copy of it here would be a list nothing reads.

/**
 * The three answers to "may this member post yet", in increasing order of
 * friction. Each carries the sentence the section shows, because a radio
 * labelled `member_age` is a column name, not a choice.
 */
export const VERIFICATION_LEVELS = [
  {
    value: "none",
    label: "Open",
    blurb: "Anyone who can see a channel can post in it.",
  },
  {
    value: "member_age",
    label: "After a wait",
    blurb: "A new membership reads first, and posts once it is old enough.",
  },
  {
    value: "accepted_rules",
    label: "After accepting the rules",
    blurb: "Members read the rules and accept them. Editing the rules asks everyone again.",
  },
] as const;

export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number]["value"];

/**
 * Who may post, how soon, and what happens when many people join at once.
 *
 * One shape rather than two, because the edit window and the verification
 * level are answers to the same question — how much rope a member gets — and
 * as two forms in one section they only argued about which Save to press.
 *
 * `raidLockdownUntil`, `rulesVersion` and `rulesUpdatedAt` are in here but are
 * never submitted: the database writes them, from the join-rate trigger and
 * from the settings trigger, and the section only shows them.
 */
export type CommunitySafety = {
  verificationLevel: VerificationLevel;
  verificationMinutes: number;
  joinRateLimit: number;
  joinRateWindowMinutes: number;
  lockdownMinutes: number;
  rulesChannelId: string | null;
  editWindowMinutes: number;
  deleteRequiresReason: boolean;
  /** Read-only. Set by private.enforce_join_rate, cleared by community_clear_lockdown. */
  raidLockdownUntil: string | null;
  /** Read-only. Bumped by touch_community_settings when the rules text changes. */
  rulesVersion: number;
  rulesUpdatedAt: string | null;
};

const VERIFICATION_VALUES = new Set<string>(VERIFICATION_LEVELS.map((level) => level.value));

/**
 * Mirrors community_settings_safety_bounds and _moderation_bounds.
 *
 * Blocked words left this row in 20260912040000: they are AutoMod rules now,
 * each with its own match mode and its own action, so a pair of community-wide
 * columns could no longer say what any one of them does. Their bounds live in
 * `automod.ts` as `AUTOMOD_LIMITS.keyword`.
 */
export const SAFETY_LIMITS = {
  editWindowMinutes: { min: 0, max: 10080 },
  verificationMinutes: { min: 0, max: 10080 },
  joinRateLimit: { min: 0, max: 500 },
  joinRateWindowMinutes: { min: 1, max: 60 },
  lockdownMinutes: { min: 5, max: 1440 },
} as const;

export const DEFAULT_COMMUNITY_SAFETY: CommunitySafety = {
  verificationLevel: "none",
  verificationMinutes: 0,
  joinRateLimit: 0,
  joinRateWindowMinutes: 10,
  lockdownMinutes: 30,
  rulesChannelId: null,
  editWindowMinutes: 0,
  deleteRequiresReason: false,
  raidLockdownUntil: null,
  rulesVersion: 1,
  rulesUpdatedAt: null,
};

function bounded(input: Record<string, unknown>, key: keyof typeof SAFETY_LIMITS, sentence: string): number {
  const value = Number.parseInt(String(input[key] ?? ""), 10);
  const limit = SAFETY_LIMITS[key];
  if (!Number.isInteger(value) || value < limit.min || value > limit.max) throw new Error(sentence);
  return value;
}

export function parseSafety(
  input: Record<string, unknown>,
): Omit<CommunitySafety, "raidLockdownUntil" | "rulesVersion" | "rulesUpdatedAt"> {
  const verificationLevel = String(input.verificationLevel ?? "");
  if (!VERIFICATION_VALUES.has(verificationLevel)) {
    throw new Error("Choose one of the three ways a member earns the right to post.");
  }

  const verificationMinutes = bounded(input, "verificationMinutes", "The wait must be between 0 minutes and 7 days.");
  // A wait of zero is the same as no wait at all, and saving it would leave a
  // level switched on that does nothing — the shape of a setting somebody
  // later reports as broken.
  if (verificationLevel === "member_age" && verificationMinutes === 0) {
    throw new Error("A wait of zero minutes is the same as leaving the community open.");
  }

  const rulesChannelId = String(input.rulesChannelId ?? "").trim();

  return {
    verificationLevel: verificationLevel as VerificationLevel,
    verificationMinutes,
    joinRateLimit: bounded(input, "joinRateLimit", "The join limit must be between 0 (off) and 500."),
    joinRateWindowMinutes: bounded(input, "joinRateWindowMinutes", "The window must be between 1 and 60 minutes."),
    lockdownMinutes: bounded(input, "lockdownMinutes", "A lockdown must last between 5 minutes and 24 hours."),
    rulesChannelId: rulesChannelId === "" ? null : rulesChannelId,
    editWindowMinutes: bounded(
      input,
      "editWindowMinutes",
      "The edit window must be between 0 minutes (never expires) and 7 days.",
    ),
    deleteRequiresReason: input.deleteRequiresReason === true || input.deleteRequiresReason === "on",
  };
}

/**
 * Channel kinds. `master` is gone: it was a type doing an access-control job,
 * and tier access is a channel override now. `rules` is the channel a member
 * must read but cannot reply in — the resolver strips the send permissions
 * there for anyone without `manage_channels`.
 */
export const CHANNEL_TYPES = ["text", "announcements", "events", "rules"] as const;

export type ChannelType = (typeof CHANNEL_TYPES)[number];

export function isChannelType(value: unknown): value is ChannelType {
  return typeof value === "string" && (CHANNEL_TYPES as readonly string[]).includes(value);
}

/** Mirrors `channels_slow_mode_seconds_check`. Slow mode is per channel now. */
export const SLOW_MODE_LIMITS = { min: 0, max: 21600 } as const;

/** The stops Discord offers, so the common values are one click rather than typed. */
export const SLOW_MODE_STOPS = [0, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21600] as const;

export function parseSlowMode(input: unknown): number {
  const seconds = Number.parseInt(String(input ?? ""), 10);
  if (!Number.isInteger(seconds) || seconds < SLOW_MODE_LIMITS.min || seconds > SLOW_MODE_LIMITS.max) {
    throw new Error("Slow mode must be between 0 seconds (off) and 6 hours.");
  }
  return seconds;
}

/** "Off", "5s", "10m", "6h" — the label beside the slider and on the channel header. */
export function formatSlowMode(seconds: number): string {
  if (seconds <= 0) return "Off";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 360) / 10}h`.replace(".0h", "h");
}

/** Mirrors the `kind` CHECK on `community_mod_cases`. */
export const CASE_KINDS = ["warn", "timeout", "untimeout", "ban", "unban", "note"] as const;
export type CaseKind = (typeof CASE_KINDS)[number];

export const REPORT_REASONS = ["spam", "harassment", "hate", "sexual", "scam", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["open", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam or advertising",
  harassment: "Harassment or bullying",
  hate: "Hate speech",
  sexual: "Sexual content",
  scam: "Scam or fraud",
  other: "Something else",
};

export const CASE_KIND_LABELS: Record<CaseKind, string> = {
  warn: "Warned",
  timeout: "Timed out",
  untimeout: "Timeout lifted",
  ban: "Banned",
  unban: "Unbanned",
  note: "Note",
};

/** Mirrors the CHECK constraints and the `raise` bounds in 20260912030000. */
export const SANCTION_LIMITS = {
  reason: { min: 3, max: 500 },
  details: { max: 500 },
  duration: { min: 60, max: 2419200 },
  bulkDelete: { max: 100 },
} as const;

/** The presets, plus a custom value up to 28 days. Discord's ladder. */
export const TIMEOUT_PRESETS = [
  { seconds: 60, label: "1 minute" },
  { seconds: 300, label: "5 minutes" },
  { seconds: 600, label: "10 minutes" },
  { seconds: 3600, label: "1 hour" },
  { seconds: 86400, label: "1 day" },
  { seconds: 604800, label: "1 week" },
] as const;

export function parseTimeoutDuration(input: unknown): number {
  const seconds = Number.parseInt(String(input ?? ""), 10);
  if (!Number.isInteger(seconds) || seconds < SANCTION_LIMITS.duration.min || seconds > SANCTION_LIMITS.duration.max) {
    throw new Error("A timeout must be between 1 minute and 28 days.");
  }
  return seconds;
}

/**
 * The reason is the record. A sanction with no reason is a sanction nobody can
 * review later, which is why the database refuses one for every kind that is
 * not an undo or a note.
 */
export function parseModerationReason(input: unknown, { required = true } = {}): string | null {
  const reason = typeof input === "string" ? input.trim() : "";
  if (!reason) {
    if (required) throw new Error(`A reason must be between ${SANCTION_LIMITS.reason.min} and ${SANCTION_LIMITS.reason.max} characters.`);
    return null;
  }
  if (reason.length < SANCTION_LIMITS.reason.min || reason.length > SANCTION_LIMITS.reason.max) {
    throw new Error(`A reason must be between ${SANCTION_LIMITS.reason.min} and ${SANCTION_LIMITS.reason.max} characters.`);
  }
  return reason;
}

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && (REPORT_REASONS as readonly string[]).includes(value);
}

/** "2 days", "3 hours", "15 minutes" — how a timeout is described to the person serving it. */
export function formatDuration(seconds: number): string {
  if (seconds >= 86400) {
    const days = Math.round(seconds / 86400);
    return `${days} ${days === 1 ? "day" : "days"}`;
  }
  if (seconds >= 3600) {
    const hours = Math.round(seconds / 3600);
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
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

