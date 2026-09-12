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

/**
 * Where the "NEW" divider goes: the index of the first message this person has
 * not read, or -1.
 *
 * `lastReadAt` is frozen when the channel opens and deliberately not updated
 * while it is open. A divider that moved as you read would sit permanently at
 * the bottom and tell you nothing — the whole value is that it stays put,
 * marking where you were when you arrived.
 *
 * Your own messages never start the unread run. Posting something and then
 * being told there is something new below is nonsense.
 */
export function firstUnreadIndex(
  messages: readonly { id: string; createdAt: string; authorId: string | null }[],
  lastReadAt: string | null,
  viewerId: string | null,
): number {
  if (!lastReadAt) return -1;
  const boundary = Date.parse(lastReadAt);
  if (Number.isNaN(boundary)) return -1;

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (viewerId !== null && message.authorId === viewerId) continue;
    if (Date.parse(message.createdAt) > boundary) return index;
  }
  return -1;
}
