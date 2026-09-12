import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Turning an attachment's storage path into a URL a browser can load.
 *
 * **`community-posts` is a private bucket.** The channels page was built on
 * `getPublicUrl`, with a comment saying the bucket was public; it never was,
 * and `/object/public/community-posts/...` answers 400 for every object in it.
 * Every image posted to a channel has been a broken one since P1, and the
 * non-image branch rendered a filename linking nowhere.
 *
 * A signed URL is not a way around the permission: Storage mints one only for
 * a caller the read policy already allows, so the object is still gated on
 * `post_attachments.path`. What changes is that the link works for the people
 * who were always meant to be able to open it.
 *
 * These expire. An hour is long enough that nobody meets the edge while
 * reading, and the page signs again on every load and every page of history.
 *
 * Takes the client rather than making one, so the same function serves the
 * server render and the browser's own paging without this module having to
 * know which side it is on.
 */

/** An hour. Matches what the rest of the product signs storage URLs for. */
export const ATTACHMENT_URL_TTL_SECONDS = 60 * 60;

export async function signAttachmentUrls(
  supabase: SupabaseClient,
  paths: readonly string[],
): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  // One request, not one per attachment: a page of fifty messages can carry
  // hundreds of them.
  const unique = [...new Set(paths)].filter((path) => path.trim() !== "");
  if (unique.length === 0) return signed;

  const { data, error } = await supabase.storage
    .from("community-posts")
    .createSignedUrls(unique, ATTACHMENT_URL_TTL_SECONDS);

  if (error) {
    // A missing URL renders as an attachment that cannot be opened, which is
    // the same outcome as before and better than taking the channel down. The
    // name is logged because the message alone never says which policy refused.
    console.error("[attachment-urls]", { code: error.name, count: unique.length });
    return signed;
  }

  for (const entry of data ?? []) {
    // `createSignedUrls` reports per-path failures inline rather than throwing,
    // so one unreadable object cannot cost the other forty-nine their URLs.
    if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
  }
  return signed;
}

/** Every attachment path in a page of messages, in one list. */
export function attachmentPathsOf(
  messages: readonly { attachments: readonly { path: string }[] }[],
): string[] {
  return messages.flatMap((message) => message.attachments.map((attachment) => attachment.path));
}
