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

export type CommunityComposer = {
  reactionEmojis: string[];
  maxBodyLength: number;
  allowLinks: boolean;
  allowAttachments: boolean;
  maxAttachmentBytes: number;
  allowedAttachmentTypes: string[];
};

/**
 * The emoji a creator may choose from.
 *
 * Not free entry: the set is a database predicate, and an arbitrary string
 * there would be a reaction nobody can render and nobody can search for. This
 * is the single definition — `components/community/types` re-exports it so the
 * palette and the validator cannot drift.
 */
export const REACTION_PALETTE = [
  "👍",
  "❤️",
  "🔥",
  "💡",
  "👏",
  "🎉",
  "🚀",
  "👀",
  "😮",
  "😢",
  "💯",
  "🙏",
] as const;

/** The `community-posts` bucket's own allow-list. Nothing outside it can be uploaded. */
export const ATTACHMENT_TYPE_CHOICES = [
  { value: "image/jpeg", label: "JPEG" },
  { value: "image/png", label: "PNG" },
  { value: "image/webp", label: "WebP" },
  { value: "image/gif", label: "GIF" },
  { value: "video/mp4", label: "MP4" },
  { value: "video/webm", label: "WebM" },
] as const;

/** Mirrors community_settings_composer_bounds and the bucket ceiling. */
export const COMPOSER_LIMITS = {
  body: { min: 200, max: 10000 },
  attachmentBytes: { min: 1024, max: 20971520 },
  emojis: { min: 1, max: 24 },
} as const;

export const DEFAULT_COMMUNITY_COMPOSER: CommunityComposer = {
  reactionEmojis: [...REACTION_PALETTE],
  maxBodyLength: COMPOSER_LIMITS.body.max,
  allowLinks: true,
  allowAttachments: true,
  maxAttachmentBytes: COMPOSER_LIMITS.attachmentBytes.max,
  allowedAttachmentTypes: ATTACHMENT_TYPE_CHOICES.map((choice) => choice.value),
};

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

function integer(value: unknown): number {
  return typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
}

function bounded(value: number, range: { min: number; max: number }): boolean {
  return Number.isInteger(value) && value >= range.min && value <= range.max;
}

/**
 * Validate one composer submission.
 *
 * The emoji set is intersected with the palette rather than trusted: the array
 * reaches a row-level-security predicate, and an arbitrary string there is a
 * reaction that renders as a box for every member.
 */
export function parseComposer(input: {
  reactionEmojis: unknown;
  maxBodyLength: unknown;
  allowLinks: unknown;
  allowAttachments: unknown;
  maxAttachmentBytes: unknown;
  allowedAttachmentTypes: unknown;
}): CommunityComposer {
  const palette = new Set<string>(REACTION_PALETTE);
  const submitted = Array.isArray(input.reactionEmojis) ? input.reactionEmojis.map(String) : [];
  const reactionEmojis = [...new Set(submitted.filter((emoji) => palette.has(emoji)))];
  if (reactionEmojis.length < COMPOSER_LIMITS.emojis.min) {
    throw new Error("Keep at least one reaction enabled, or members have no way to respond without posting.");
  }

  const maxBodyLength = integer(input.maxBodyLength);
  if (!bounded(maxBodyLength, COMPOSER_LIMITS.body)) {
    throw new Error(
      `The message limit must be between ${COMPOSER_LIMITS.body.min} and ${COMPOSER_LIMITS.body.max} characters.`,
    );
  }

  const maxAttachmentBytes = integer(input.maxAttachmentBytes);
  if (!bounded(maxAttachmentBytes, COMPOSER_LIMITS.attachmentBytes)) {
    throw new Error("The attachment limit must be between 1KB and 20MB, which is the storage ceiling.");
  }

  const allowed = new Set(ATTACHMENT_TYPE_CHOICES.map((choice) => choice.value as string));
  const submittedTypes = Array.isArray(input.allowedAttachmentTypes)
    ? input.allowedAttachmentTypes.map(String)
    : [];
  const allowedAttachmentTypes = [...new Set(submittedTypes.filter((type) => allowed.has(type)))];

  const allowAttachments = input.allowAttachments === true || input.allowAttachments === "on";
  if (allowAttachments && allowedAttachmentTypes.length === 0) {
    throw new Error("Pick at least one file type, or turn attachments off entirely.");
  }

  return {
    reactionEmojis,
    maxBodyLength,
    allowLinks: input.allowLinks === true || input.allowLinks === "on",
    allowAttachments,
    maxAttachmentBytes,
    // Keep the stored list non-empty even when attachments are off, so turning
    // them back on restores a working configuration rather than an error.
    allowedAttachmentTypes: allowedAttachmentTypes.length
      ? allowedAttachmentTypes
      : DEFAULT_COMMUNITY_COMPOSER.allowedAttachmentTypes,
  };
}
