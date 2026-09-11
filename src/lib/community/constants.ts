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
