/**
 * The community's custom emoji.
 *
 * Zero imports and no `server-only`: the shape is read by the channels layout
 * on the server, by the settings section in the browser, and by the unit test
 * directly. The rules about what a name may be belong with the shape, because
 * the database enforces exactly the same ones and a second opinion would
 * eventually become a second answer.
 */

export type CustomEmoji = {
  id: string;
  name: string;
  url: string;
  animated: boolean;
  /** Empty means everyone holding `use_custom_emojis`. */
  roleIds: string[];
};

export const CUSTOM_EMOJI_LIMITS = {
  /** Mirrors the CHECK on community_emojis.name. */
  name: { min: 2, max: 32 },
  /** Mirrors the bucket's file_size_limit. */
  bytes: 262144,
  /** Mirrors the bucket's allowed_mime_types. */
  types: ["image/png", "image/webp", "image/gif"],
  /** Mirrors private.assert_emoji_cap. */
  slots: 100,
  /** Not a database rule: a larger image is downscaled by every renderer anyway. */
  pixels: 128,
} as const;

const NAME = /^[a-z0-9_]{2,32}$/;

/**
 * Clean a typed name into one the database will take, or say why not.
 *
 * Spaces and dashes become underscores rather than being refused: `stoic owl`
 * is what somebody means to type, and turning it into `stoic_owl` is a kinder
 * answer than an error about a character class.
 */
export function parseEmojiName(input: unknown): string {
  const cleaned = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

  if (cleaned.length < CUSTOM_EMOJI_LIMITS.name.min || cleaned.length > CUSTOM_EMOJI_LIMITS.name.max) {
    throw new Error(
      `An emoji name is ${CUSTOM_EMOJI_LIMITS.name.min} to ${CUSTOM_EMOJI_LIMITS.name.max} characters: letters, numbers and underscores.`,
    );
  }
  if (!NAME.test(cleaned)) throw new Error("An emoji name uses letters, numbers and underscores only.");
  return cleaned;
}

export function isAllowedEmojiType(type: string): boolean {
  return (CUSTOM_EMOJI_LIMITS.types as readonly string[]).includes(type);
}

/** The token a message body carries. The id travels with the name so a rename never rewrites a message. */
export function emojiToken(emoji: { id: string; name: string }): string {
  return `<:${emoji.name}:${emoji.id}>`;
}
