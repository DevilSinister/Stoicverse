/**
 * The permission catalog — the one TypeScript mirror of
 * `public.community_permission_keys()` and
 * `public.community_channel_permission_keys()`.
 *
 * Zero imports on purpose: the node test runner loads this file directly and a
 * contract test parses the SQL literal and asserts it equals PERMISSION_KEYS.
 * Add a key here and in the migration in the same change, or the grant is
 * silently never honoured.
 */

export const PERMISSION_KEYS = [
  // community-scoped — never overridable per channel
  "administrator",
  "manage_community",
  "manage_roles",
  "manage_emojis",
  "view_audit_log",
  "moderate_members",
  "ban_members",
  // channel-scoped — overridable, also valid as a base grant
  "view_channel",
  "read_message_history",
  "send_messages",
  "send_messages_in_threads",
  "create_threads",
  "manage_threads",
  "manage_messages",
  "pin_messages",
  "manage_channels",
  "manage_events",
  "embed_links",
  "attach_files",
  "add_reactions",
  "use_custom_emojis",
  "mention_everyone",
  "mention_roles",
  "bypass_slowmode",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const CHANNEL_PERMISSION_KEYS = [
  "view_channel",
  "read_message_history",
  "send_messages",
  "send_messages_in_threads",
  "create_threads",
  "manage_threads",
  "manage_messages",
  "pin_messages",
  "manage_channels",
  "manage_events",
  "embed_links",
  "attach_files",
  "add_reactions",
  "use_custom_emojis",
  "mention_everyone",
  "mention_roles",
  "bypass_slowmode",
] as const satisfies readonly PermissionKey[];

export type ChannelPermissionKey = (typeof CHANNEL_PERMISSION_KEYS)[number];

export type PermissionGroup = "general" | "membership" | "text" | "moderation";

export const PERMISSION_GROUPS: { id: PermissionGroup; label: string }[] = [
  { id: "general", label: "General community permissions" },
  { id: "membership", label: "Membership permissions" },
  { id: "text", label: "Text channel permissions" },
  { id: "moderation", label: "Moderation permissions" },
];

export type PermissionMeta = {
  label: string;
  detail: string;
  group: PermissionGroup;
  /** Newly granting this needs the role name typed to confirm. */
  escalating: boolean;
  /** Makes sense on the @everyone role. Moderation grants do not. */
  appliesToEveryone: boolean;
};

export const PERMISSION_CATALOG: Record<PermissionKey, PermissionMeta> = {
  administrator: {
    label: "Administrator",
    detail:
      "Every permission, and channel overrides do not apply. Only for people you would trust with the community itself.",
    group: "general",
    escalating: true,
    appliesToEveryone: false,
  },
  manage_community: {
    label: "Manage community",
    detail: "Change the name, branding, rules, safety settings and AutoMod rules.",
    group: "general",
    escalating: true,
    appliesToEveryone: false,
  },
  manage_roles: {
    label: "Manage roles",
    detail: "Create, edit, reorder and assign roles below their own highest role.",
    group: "general",
    escalating: true,
    appliesToEveryone: false,
  },
  manage_channels: {
    label: "Manage channels",
    detail: "Create, rename, gate, archive and reorder channels and categories.",
    group: "general",
    escalating: true,
    appliesToEveryone: false,
  },
  manage_emojis: {
    label: "Manage emoji",
    detail: "Upload, rename and remove the community's custom emoji.",
    group: "general",
    escalating: false,
    appliesToEveryone: false,
  },
  manage_events: {
    label: "Manage events",
    detail: "Create and edit events and the channels that host them.",
    group: "general",
    escalating: false,
    appliesToEveryone: false,
  },
  view_audit_log: {
    label: "View audit log",
    detail: "Read every moderation and settings change, with the message as it was.",
    group: "general",
    escalating: false,
    appliesToEveryone: false,
  },
  view_channel: {
    label: "View channel",
    detail: "See the channel in the sidebar and open it.",
    group: "membership",
    escalating: false,
    appliesToEveryone: true,
  },
  read_message_history: {
    label: "Read message history",
    detail: "Scroll back through messages posted before they opened the channel.",
    group: "membership",
    escalating: false,
    appliesToEveryone: true,
  },
  send_messages: {
    label: "Send messages",
    detail: "Post in the channel.",
    group: "text",
    escalating: false,
    appliesToEveryone: true,
  },
  send_messages_in_threads: {
    label: "Send messages in threads",
    detail: "Reply inside existing threads.",
    group: "text",
    escalating: false,
    appliesToEveryone: true,
  },
  create_threads: {
    label: "Create threads",
    detail: "Start a thread from any message.",
    group: "text",
    escalating: false,
    appliesToEveryone: true,
  },
  embed_links: {
    label: "Embed links",
    detail: "Include links in messages.",
    group: "text",
    escalating: false,
    appliesToEveryone: true,
  },
  attach_files: {
    label: "Attach files",
    detail: "Upload images, video and PDFs with a message.",
    group: "text",
    escalating: false,
    appliesToEveryone: true,
  },
  add_reactions: {
    label: "Add reactions",
    detail: "React to messages with any emoji.",
    group: "text",
    escalating: false,
    appliesToEveryone: true,
  },
  use_custom_emojis: {
    label: "Use custom emoji",
    detail: "Use this community's uploaded emoji in messages and reactions.",
    group: "text",
    escalating: false,
    appliesToEveryone: true,
  },
  mention_everyone: {
    label: "Mention @everyone and @here",
    detail: "Notify every active member at once.",
    group: "text",
    escalating: true,
    appliesToEveryone: false,
  },
  mention_roles: {
    label: "Mention any role",
    detail: "Notify a role even when it is not marked mentionable.",
    group: "text",
    escalating: false,
    appliesToEveryone: false,
  },
  bypass_slowmode: {
    label: "Bypass slow mode",
    detail: "Post without waiting out the channel's pace limit.",
    group: "text",
    escalating: false,
    appliesToEveryone: false,
  },
  manage_messages: {
    label: "Manage messages",
    detail: "Delete anyone's message. The original text is kept in the audit log.",
    group: "moderation",
    escalating: false,
    appliesToEveryone: false,
  },
  pin_messages: {
    label: "Pin messages",
    detail: "Pin and unpin any message in the channel.",
    group: "moderation",
    escalating: false,
    appliesToEveryone: false,
  },
  manage_threads: {
    label: "Manage threads",
    detail: "Rename, archive and lock any thread.",
    group: "moderation",
    escalating: false,
    appliesToEveryone: false,
  },
  moderate_members: {
    label: "Moderate members",
    detail: "Warn and time out members, resolve reports, and read case history.",
    group: "moderation",
    escalating: false,
    appliesToEveryone: false,
  },
  ban_members: {
    label: "Ban members",
    detail: "Lock a member out of the community. Their subscription is untouched.",
    group: "moderation",
    escalating: true,
    appliesToEveryone: false,
  },
};

export const ESCALATING_PERMISSIONS: readonly PermissionKey[] = PERMISSION_KEYS.filter(
  (key) => PERMISSION_CATALOG[key].escalating,
);

const CHANNEL_KEY_SET = new Set<string>(CHANNEL_PERMISSION_KEYS);
const ALL_KEY_SET = new Set<string>(PERMISSION_KEYS);

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === "string" && ALL_KEY_SET.has(value);
}

export function isChannelPermissionKey(value: unknown): value is ChannelPermissionKey {
  return typeof value === "string" && CHANNEL_KEY_SET.has(value);
}

/** Drop unknown strings and duplicates, keeping catalog order — the database trigger does the same. */
export function normalizePermissions(input: readonly unknown[]): PermissionKey[] {
  const wanted = new Set(input.filter(isPermissionKey));
  return PERMISSION_KEYS.filter((key) => wanted.has(key));
}

export type ViewerForGrants = {
  isOwner: boolean;
  permissions: ReadonlySet<PermissionKey>;
  /** Position of the viewer's highest role; the owner is treated as infinite. */
  highestPosition: number;
};

/** You cannot grant what you do not hold. Administrator implies everything. */
export function canGrant(viewer: ViewerForGrants, key: PermissionKey): boolean {
  if (viewer.isOwner || viewer.permissions.has("administrator")) return true;
  return viewer.permissions.has(key);
}

/** Roles are managed strictly from above: equal position is not enough. */
export function canManageRole(
  viewer: ViewerForGrants,
  role: { position: number; systemKey: string | null },
): boolean {
  if (viewer.isOwner) return true;
  const mayManage = viewer.permissions.has("manage_roles") || viewer.permissions.has("administrator");
  if (!mayManage) return false;
  if (role.systemKey === "everyone") return true;
  return role.position < viewer.highestPosition;
}

/** Grants that were off before and on after — only these need the typed confirmation. */
export function newlyEscalating(
  before: readonly PermissionKey[],
  after: readonly PermissionKey[],
): PermissionKey[] {
  const had = new Set(before);
  return after.filter((key) => !had.has(key) && PERMISSION_CATALOG[key].escalating);
}

export function diffPermissions(before: readonly PermissionKey[], after: readonly PermissionKey[]) {
  const had = new Set(before);
  const has = new Set(after);
  return {
    added: after.filter((key) => !had.has(key)),
    removed: before.filter((key) => !has.has(key)),
  };
}

export type RoleOverride = {
  roleId: string;
  allow: readonly ChannelPermissionKey[];
  deny: readonly ChannelPermissionKey[];
};

export type ResolutionInput = {
  /** Union of the @everyone role and every role the member holds; `administrator` short-circuits. */
  base: readonly PermissionKey[];
  everyoneRoleId: string;
  /** Ids of the member's roles, excluding @everyone. */
  memberRoleIds: readonly string[];
  /** Overrides that apply: the category's when the channel is synced, otherwise the channel's own. */
  overrides: readonly RoleOverride[];
  channelType?: "text" | "announcements" | "events" | "rules";
};

/**
 * Discord precedence, mirrored from `public.community_permissions`:
 *   base → @everyone deny → @everyone allow → role denies → role allows.
 * No view_channel means no permissions at all in that channel.
 */
export function resolveChannelPermissions(input: ResolutionInput): PermissionKey[] {
  const base = new Set<PermissionKey>(input.base);
  if (base.has("administrator")) return [...PERMISSION_KEYS];

  const everyone = input.overrides.find((override) => override.roleId === input.everyoneRoleId);
  const mine = input.overrides.filter(
    (override) => override.roleId !== input.everyoneRoleId && input.memberRoleIds.includes(override.roleId),
  );

  const perms = new Set<PermissionKey>(base);
  everyone?.deny.forEach((key) => perms.delete(key));
  everyone?.allow.forEach((key) => perms.add(key));
  mine.forEach((override) => override.deny.forEach((key) => perms.delete(key)));
  mine.forEach((override) => override.allow.forEach((key) => perms.add(key)));

  if (!perms.has("view_channel")) return [];
  if (input.channelType === "rules" && !perms.has("manage_channels")) {
    perms.delete("send_messages");
    perms.delete("send_messages_in_threads");
    perms.delete("create_threads");
  }
  return PERMISSION_KEYS.filter((key) => perms.has(key));
}

export type OverrideState = "allow" | "neutral" | "deny";

export function overrideStateFor(override: RoleOverride | undefined, key: ChannelPermissionKey): OverrideState {
  if (!override) return "neutral";
  if (override.deny.includes(key)) return "deny";
  if (override.allow.includes(key)) return "allow";
  return "neutral";
}
