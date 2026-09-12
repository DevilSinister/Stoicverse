import type { ChannelMessage } from "@/lib/community/messages";

/**
 * The `community_channel_messages` row as the shape the list renders.
 *
 * This lives here rather than in `messages.ts` because that module is
 * `server-only` — the browser pages the channel itself, so it needs the same
 * mapping without dragging the server loaders along. It lives here rather than
 * in `ChannelView` because the thread panel needs it too, and a component
 * importing its own child's module is a cycle waiting to bite.
 *
 * `ChannelMessage` is a type, so importing it from a server-only module is
 * erased at compile time and reaches no bundle.
 */
export function toClientMessage(row: Record<string, unknown>): ChannelMessage {
  return {
    id: row.id as string,
    authorId: (row.author_id as string | null) ?? null,
    authorName: (row.author_name as string) ?? "Former member",
    authorAvatar: (row.author_avatar as string | null) ?? null,
    authorColor: (row.author_color as string | null) ?? null,
    body: (row.body as string | null) ?? null,
    postType: (row.post_type as string) ?? "post",
    isPinned: Boolean(row.is_pinned),
    createdAt: row.created_at as string,
    editedAt: (row.edited_at as string | null) ?? null,
    clientNonce: (row.client_nonce as string | null) ?? null,
    replyToPostId: (row.reply_to_post_id as string | null) ?? null,
    replyAuthorName: (row.reply_author_name as string | null) ?? null,
    replyExcerpt: (row.reply_excerpt as string | null) ?? null,
    threadId: (row.thread_id as string | null) ?? null,
    threadName: (row.thread_name as string | null) ?? null,
    threadMessageCount: (row.thread_message_count as number | null) ?? null,
    attachments: (row.attachments as ChannelMessage["attachments"] | null) ?? [],
    reactions: (row.reactions as ChannelMessage["reactions"] | null) ?? [],
  };
}
