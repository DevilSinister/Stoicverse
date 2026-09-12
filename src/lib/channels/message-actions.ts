/**
 * What the menu on one message is allowed to offer.
 *
 * Split out from the component for the same reason `permissions.ts` was: the
 * question "may this person delete this message" has a right answer that does
 * not involve React, and a menu that offers an action the database will refuse
 * is worse than one that never offered it.
 *
 * The database still decides. Every item here has a server-side check behind
 * it — `soft_delete_post` re-asks author-or-`manage_messages`, and
 * `togglePostHighlight` re-asks `pin_messages`. This only decides what to draw.
 *
 * Zero imports, so the unit test loads this directly.
 */

export type MessageSubject = {
  /** null when the author's profile is gone; such a message can still be moderated. */
  authorId: string | null;
  postType: string;
  isPinned: boolean;
  threadId: string | null;
  hasBody: boolean;
  /** True while the bubble is still the composer's optimistic copy. */
  pending: boolean;
};

export type MessageAbilities = {
  canReply: boolean;
  canReact: boolean;
  canPin: boolean;
  canManageMessages: boolean;
  canCreateThread: boolean;
};

export type MessageActions = {
  reply: boolean;
  react: boolean;
  edit: boolean;
  remove: boolean;
  /** Removing somebody else's message writes a moderation case, which wants a reason. */
  removeNeedsReason: boolean;
  pin: boolean;
  startThread: boolean;
  openThread: boolean;
  report: boolean;
  copyText: boolean;
  copyLink: boolean;
};

const NOTHING: MessageActions = {
  reply: false,
  react: false,
  edit: false,
  remove: false,
  removeNeedsReason: false,
  pin: false,
  startThread: false,
  openThread: false,
  report: false,
  copyText: false,
  copyLink: false,
};

export function deriveMessageActions(input: {
  message: MessageSubject;
  viewerId: string | null;
  abilities: MessageAbilities;
}): MessageActions {
  const { message, viewerId, abilities } = input;

  // An optimistic bubble has no server id yet. Every action would address a
  // row that does not exist, so the menu stays away until the send settles.
  if (message.pending) return NOTHING;

  // A system message is written by the community, not by a person. There is
  // nobody to reply to, report, or hold responsible for it.
  if (message.postType === "system") return { ...NOTHING, copyLink: true };

  const own = viewerId !== null && message.authorId === viewerId;

  return {
    reply: abilities.canReply,
    react: abilities.canReact,
    // Editing is the author's alone. No permission grants the right to change
    // what somebody else said — a moderator deletes, and the deletion is
    // logged; silently rewriting words would not be.
    edit: own && message.hasBody,
    remove: own || abilities.canManageMessages,
    removeNeedsReason: !own && abilities.canManageMessages,
    pin: abilities.canPin,
    startThread: abilities.canCreateThread && message.threadId === null,
    openThread: message.threadId !== null,
    // Reporting your own message is noise in the queue, and there is nobody to
    // report when the author's profile is gone.
    report: !own && message.authorId !== null,
    copyText: message.hasBody,
    copyLink: true,
  };
}

/**
 * A link that reopens the channel scrolled to one message.
 *
 * `?jump=` rather than a fragment: the message may be far enough back that the
 * page has to fetch toward it, which is work the route has to know about, and
 * a fragment never reaches the server.
 */
export function messagePermalink(origin: string, channelId: string, messageId: string): string {
  return `${origin.replace(/\/+$/, "")}/channels/${channelId}?jump=${messageId}`;
}

/** How many extra pages a jump will walk back before giving up. */
export const JUMP_PAGE_BUDGET = 5;
