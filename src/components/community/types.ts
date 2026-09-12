export type CommunityCategory = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  visibilityMode: "locked" | "hidden";
  isArchived: boolean;
};

export type CommunityChannel = {
  id: string;
  categoryId: string;
  name: string;
  type: string;
  description: string | null;
  sortOrder: number;
  visibilityMode: "locked" | "hidden";
  isArchived: boolean;
  isLocked: boolean;
  /** `send_messages` resolved for this viewer in this channel. */
  canSend: boolean;
  slowModeSeconds: number;
  /** False once the channel carries its own overrides instead of its category's. */
  permissionsSynced: boolean;
  /** The tier that unlocks a locked teaser, or null when the channel is not tier-gated. */
  unlockTier: number | null;
};

export type CommunityPost = {
  id: string;
  channelId: string;
  /** Null once the author's account is gone. Drives own-vs-other alignment and
   *  message grouping, so it must survive the loader and the realtime insert. */
  authorId: string | null;
  authorName: string;
  /** The author's `profiles.platform_role`, used for the staff badge. Replaces
   *  the previous substring guess against the display name. */
  authorRole: string | null;
  authorRoles?: { id: string; name: string; color: string }[];
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
  isPinned: boolean;
  reactions: { emoji: string; count: number; userReacted: boolean }[];
};

export const STAFF_ROLES = ["moderator", "influencer", "super_admin"];

export function staffLabel(role: string | null) {
  if (role === "influencer") return "Creator";
  if (role === "super_admin") return "Admin";
  if (role === "moderator") return "Moderator";
  return null;
}
