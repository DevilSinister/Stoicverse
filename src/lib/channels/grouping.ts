/**
 * When consecutive messages belong to the same visual group.
 *
 * Chat reads as a conversation rather than a table because a run of messages
 * from one person collapses into a single block with one avatar and one
 * timestamp. Zero imports, so the unit test loads this directly.
 */

/** Discord's window. Past this the next message starts a fresh block even from the same author. */
export const GROUP_WINDOW_MS = 7 * 60 * 1000;

export type GroupableMessage = {
  authorId: string | null;
  createdAt: string;
  replyToPostId?: string | null;
  postType?: string;
};

/**
 * Whether `message` continues the block `previous` started.
 *
 * A reply never continues a block: it carries a quoted excerpt above it, and
 * hiding the author of a reply makes the excerpt look like it belongs to the
 * person above. A system message never joins one either — it has no author to
 * group under.
 */
export function continuesGroup(previous: GroupableMessage | null, message: GroupableMessage): boolean {
  if (!previous) return false;
  if (message.replyToPostId) return false;
  if (message.postType === "system" || previous.postType === "system") return false;
  if (message.authorId === null || previous.authorId === null) return false;
  if (message.authorId !== previous.authorId) return false;

  const gap = new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime();
  if (!Number.isFinite(gap)) return false;
  return gap >= 0 && gap < GROUP_WINDOW_MS;
}

/** Whether a day divider belongs between these two messages. */
export function startsNewDay(previous: GroupableMessage | null, message: GroupableMessage): boolean {
  if (!previous) return true;
  const before = new Date(previous.createdAt);
  const now = new Date(message.createdAt);
  if (Number.isNaN(before.getTime()) || Number.isNaN(now.getTime())) return false;
  return before.toDateString() !== now.toDateString();
}
