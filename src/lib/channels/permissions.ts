/**
 * What the composer and the message actions are allowed to offer.
 *
 * The database decides; this decides what to *show*. Rendering a reply button
 * that always fails is worse than not rendering one, and the resolver has
 * already told us the answer in `community_viewer_state`.
 *
 * Zero imports, so the unit test loads this directly.
 */

export type ComposerState =
  | "ready"
  | "timedOut"
  | "banned"
  | "suspended"
  | "readOnly"
  | "announcementOnly"
  | "rulesChannel";

export type Affordances = {
  composer: ComposerState;
  canReply: boolean;
  canReact: boolean;
  canAttach: boolean;
  canEmbedLinks: boolean;
  canCreateThread: boolean;
  canSendInThread: boolean;
  canManageThreads: boolean;
  canPin: boolean;
  canManageMessages: boolean;
  canMentionEveryone: boolean;
};

export type AffordanceInput = {
  /** The permission list `community_viewer_state` resolved for this channel. */
  permissions: readonly string[];
  channelType: string;
  /** From `private.community_gate`: null or "ok" means nothing is wrong. */
  gate?: string | null;
};

function has(permissions: readonly string[], key: string): boolean {
  return permissions.includes(key) || permissions.includes("administrator");
}

/**
 * The composer's state, resolved in the order a person experiences it.
 *
 * The gate comes first because being banned is not the same as a channel being
 * read-only, and telling someone "you cannot post here" when they are actually
 * timed out sends them to argue with the wrong thing.
 */
export function deriveAffordances(input: AffordanceInput): Affordances {
  const { permissions, channelType, gate } = input;

  let composer: ComposerState = "ready";
  if (gate === "suspended") composer = "suspended";
  else if (gate === "banned") composer = "banned";
  else if (gate === "timeout") composer = "timedOut";
  else if (channelType === "rules") composer = "rulesChannel";
  else if (!has(permissions, "send_messages")) {
    composer = channelType === "announcements" ? "announcementOnly" : "readOnly";
  }

  const blocked = composer !== "ready";

  return {
    composer,
    // Reacting survives a read-only channel; it does not survive a sanction.
    canReact: has(permissions, "add_reactions") && !gate,
    canReply: !blocked,
    canAttach: !blocked && has(permissions, "attach_files"),
    canEmbedLinks: !blocked && has(permissions, "embed_links"),
    canCreateThread: !blocked && has(permissions, "create_threads"),
    // A channel can be read-only at the top level and still take replies in
    // its threads, which is why this is its own permission rather than an
    // inference from `send_messages`.
    canSendInThread: !blocked && has(permissions, "send_messages_in_threads"),
    canManageThreads: has(permissions, "manage_threads"),
    canPin: has(permissions, "pin_messages"),
    canManageMessages: has(permissions, "manage_messages"),
    canMentionEveryone: !blocked && has(permissions, "mention_everyone"),
  };
}

/** The sentence shown where the composer would be. */
export const COMPOSER_NOTICE: Record<Exclude<ComposerState, "ready">, string> = {
  suspended: "Your account is suspended.",
  banned: "You are banned from this community.",
  timedOut: "You are timed out and cannot post right now.",
  readOnly: "You do not have permission to post in this channel.",
  announcementOnly: "Only the creator posts in announcement channels.",
  rulesChannel: "This channel is the rules. Nobody replies here.",
};
