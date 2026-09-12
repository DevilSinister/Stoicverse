/**
 * The message a forward points at, as it stands right now.
 *
 * Read live rather than copied. That is the decision the whole feature turns
 * on: a moderator deleting a message deletes it everywhere it was forwarded,
 * in the same act, and `deleted` is what separates "the original said nothing"
 * from "the original is gone".
 *
 * This sits in its own module because both mappers need it and one of them
 * runs in the browser — `messages.ts` is `server-only`, so a function exported
 * from there and imported by `rows.ts` would drag the server loaders into the
 * client bundle. Types are erased and cross that line freely; a function does
 * not.
 */

export type ForwardedOrigin = {
  postId: string;
  authorName: string;
  body: string | null;
  createdAt: string | null;
  channelId: string | null;
  channelName: string | null;
  /** False when the viewer cannot open the channel it came from: no jump link. */
  channelVisible: boolean;
  attachmentCount: number;
  deleted: boolean;
};

/** Null for an ordinary message — `forwarded_from_post_id` is what marks a forward. */
export function toForwardedOrigin(row: Record<string, unknown>): ForwardedOrigin | null {
  const postId = (row.forwarded_from_post_id as string | null) ?? null;
  if (!postId) return null;
  return {
    postId,
    authorName: (row.forwarded_author_name as string | null) ?? "Former member",
    body: (row.forwarded_body as string | null) ?? null,
    createdAt: (row.forwarded_created_at as string | null) ?? null,
    channelId: (row.forwarded_channel_id as string | null) ?? null,
    channelName: (row.forwarded_channel_name as string | null) ?? null,
    channelVisible: row.forwarded_channel_visible === true,
    attachmentCount: (row.forwarded_attachment_count as number | null) ?? 0,
    deleted: row.forwarded_deleted === true,
  };
}
