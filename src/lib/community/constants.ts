/**
 * Platform-wide composer and reaction rules.
 *
 * These are constants, not settings: the owner decided message length,
 * attachment limits and the reaction set are rules of the platform rather than
 * choices a creator makes. Every number here mirrors a database bound —
 * `posts_body_length_check`, the `community-posts` bucket, and
 * `community_reaction_token_is_valid` (migration 20260912000000) — and a unit
 * test asserts the mirror. Zero imports so the node test runner can load it.
 */

export const MESSAGE_MAX_CHARS = 10_000;
/** The character counter appears once a draft passes this length. */
export const MESSAGE_COUNTER_FROM = 8_000;

/** 25 MB, the `community-posts` bucket's file_size_limit. */
export const ATTACHMENT_MAX_BYTES = 26_214_400;
export const ATTACHMENTS_PER_MESSAGE = 10;
/** The bucket's own allow-list. Checked in `attach()`, not in `accept=`, because drop and paste bypass `accept`. */
export const ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "application/pdf",
] as const;

export const MAX_DISTINCT_REACTIONS_PER_MESSAGE = 20;
/** Longest Unicode reaction, in code points, matching the SQL `{1,16}` (PostgreSQL counts characters, not UTF-16 units). */
export const REACTION_MAX_CHARS = 16;

/**
 * The quick-pick row shown before a member opens the full picker. Purely a UI
 * convenience now — any emoji is a valid reaction.
 */
export const QUICK_REACTIONS = ["👍", "❤️", "🔥", "💡", "👏", "🎉", "🚀", "👀", "😮", "😢", "💯", "🙏"] as const;

/** `<:name:uuid>` — how a custom emoji appears in a body and in `reactions.emoji`. */
export const CUSTOM_EMOJI_TOKEN =
  /^<:([a-z0-9_]{2,32}):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})>$/;

/** A single Unicode emoji: a keycap sequence, or 1–16 non-ASCII code points. The `u` flag makes `{1,16}` count code points like PostgreSQL does. */
export const UNICODE_REACTION = /^(?:[0-9#*]️?⃣|[^\x00-\x7F]{1,16})$/u;

export function isValidReactionToken(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  return CUSTOM_EMOJI_TOKEN.test(value) || UNICODE_REACTION.test(value);
}

export function parseCustomEmojiToken(value: string): { name: string; id: string } | null {
  const match = CUSTOM_EMOJI_TOKEN.exec(value);
  return match ? { name: match[1], id: match[2] } : null;
}

export function isAllowedAttachmentType(mimeType: string): boolean {
  return (ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

// ---------------------------------------------------------------- messaging
// Mirrors migration 20260912070000. The page reads these; the database
// enforces them.

/** One page of a channel or thread. `community_channel_messages` clamps to 100. */
export const MESSAGE_PAGE_SIZE = 50;

/** Mirrors the bounds inside `community_search_messages`. */
export const SEARCH_QUERY_LIMITS = { min: 2, max: 100, pageSize: 25 } as const;

/** Mirrors `threads_name_check`. */
export const THREAD_NAME_LIMITS = { min: 1, max: 100 } as const;

/**
 * How a mention is written in a body. Every form carries an id, so renaming a
 * person, role or channel never breaks an old message.
 *
 * `@all` and `@tier-N` are the legacy forms. They are still rendered as inert
 * chips in messages written before 20260912070000, but nothing extracts them
 * any more: a tier is a role now, and a role mention carries its uuid.
 */
export const MENTION_TOKENS = {
  user: /<@([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})>/g,
  role: /<@&([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})>/g,
  channel: /<#([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})>/g,
  everyone: /(^|[^0-9A-Za-z_])@(everyone|here)([^0-9A-Za-z_]|$)/,
} as const;

/** The legacy forms, kept so the renderer can grey them out rather than drop them. */
export const LEGACY_MENTION_TOKENS = {
  all: /(^|[^0-9A-Za-z_])@all([^0-9A-Za-z_]|$)/,
  tier: /(^|[^0-9A-Za-z_])@tier-([1-5])([^0-9A-Za-z_]|$)/,
} as const;

export const CHANNEL_NOTIFICATION_LEVELS = ["all", "mentions", "none"] as const;
export type ChannelNotificationLevel = (typeof CHANNEL_NOTIFICATION_LEVELS)[number];
