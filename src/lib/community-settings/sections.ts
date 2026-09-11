/**
 * The settings section registry — the single source of truth for the
 * /creator/settings rail, the /channels/settings page and the in-community
 * overlay. A contract test asserts no page keeps its own section list.
 *
 * Only a type import, so the node test runner can load this file directly.
 */

import type { PermissionKey } from "./permissions";

export type SettingsSectionId =
  | "overview"
  | "roles"
  | "emoji"
  | "channels"
  | "automod"
  | "safety"
  | "members"
  | "bans"
  | "reports"
  | "audit";

export type SettingsGroup = "community" | "people" | "moderation";

export const SETTINGS_GROUPS: { id: SettingsGroup; label: string }[] = [
  { id: "community", label: "Community" },
  { id: "people", label: "People" },
  { id: "moderation", label: "Moderation" },
];

export type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  blurb: string;
  group: SettingsGroup;
  /** The permission that reveals the section. The influencer sees everything. */
  requires: PermissionKey;
  /** True once the section has a server action and a policy behind it. Unbuilt sections render nothing at all. */
  built: boolean;
};

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    id: "overview",
    label: "Overview",
    blurb: "The name, mark, rules and first words a member meets.",
    group: "community",
    requires: "manage_community",
    built: true,
  },
  {
    id: "roles",
    label: "Roles",
    blurb: "Who can do what. Roles stack; the highest one sets a member's colour.",
    group: "community",
    requires: "manage_roles",
    built: true,
  },
  {
    id: "emoji",
    label: "Emoji",
    blurb: "Custom emoji for messages and reactions.",
    group: "community",
    requires: "manage_emojis",
    built: false,
  },
  {
    id: "channels",
    label: "Channels",
    blurb: "Name, group and gate every channel members can open.",
    group: "community",
    requires: "manage_channels",
    built: true,
  },
  {
    id: "members",
    label: "Members",
    blurb: "Everyone in the community, their roles, and their standing.",
    group: "people",
    requires: "moderate_members",
    built: false,
  },
  {
    id: "bans",
    label: "Bans",
    blurb: "Members locked out of the community, and why.",
    group: "people",
    requires: "ban_members",
    built: true,
  },
  {
    id: "automod",
    label: "AutoMod",
    blurb: "Rules that act on messages the moment they are sent.",
    group: "moderation",
    requires: "manage_community",
    built: false,
  },
  {
    id: "safety",
    label: "Safety setup",
    blurb: "Who may post, how soon, and what happens when many join at once.",
    group: "moderation",
    requires: "manage_community",
    built: true,
  },
  {
    id: "reports",
    label: "Reports",
    blurb: "Messages members have flagged, waiting for a decision.",
    group: "moderation",
    requires: "moderate_members",
    built: true,
  },
  {
    id: "audit",
    label: "Audit log",
    blurb: "Every edit, deletion, pin and sanction, with the message as it was.",
    group: "moderation",
    requires: "view_audit_log",
    built: true,
  },
];

const SECTION_IDS = new Set<string>(SETTINGS_SECTIONS.map((section) => section.id));

export function isSettingsSection(value: unknown): value is SettingsSectionId {
  return typeof value === "string" && SECTION_IDS.has(value);
}

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = "overview";

/** Legacy `?section=` values from the first settings page keep resolving. */
const LEGACY_SECTION_ALIASES: Record<string, SettingsSectionId> = {
  identity: "overview",
  moderation: "safety",
  composer: "overview",
};

export type SettingsViewer = {
  isInfluencer: boolean;
  permissions: ReadonlySet<PermissionKey>;
};

export function visibleSections(viewer: SettingsViewer): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((section) => {
    if (!section.built) return false;
    if (viewer.isInfluencer || viewer.permissions.has("administrator")) return true;
    return viewer.permissions.has(section.requires);
  });
}

export type SettingsQuery = {
  section: SettingsSectionId;
  channelId?: string;
  roleId?: string;
  memberId?: string;
  tab?: string;
  cursor?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function uuidOrUndefined(value: string | undefined): string | undefined {
  return value && UUID.test(value) ? value.toLowerCase() : undefined;
}

/** Validated server-side: `?section=` comes from the URL bar as readily as from the rail. */
export function parseSettingsQuery(
  params: Record<string, string | string[] | undefined>,
  visible: readonly SettingsSection[],
): SettingsQuery {
  const raw = first(params.section);
  const aliased = raw && LEGACY_SECTION_ALIASES[raw] ? LEGACY_SECTION_ALIASES[raw] : raw;
  const requested = isSettingsSection(aliased) ? aliased : DEFAULT_SETTINGS_SECTION;
  const allowed = visible.some((section) => section.id === requested)
    ? requested
    : (visible[0]?.id ?? DEFAULT_SETTINGS_SECTION);

  const tab = first(params.tab);
  const cursor = first(params.cursor);
  return {
    section: allowed,
    channelId: uuidOrUndefined(first(params.channel)),
    roleId: uuidOrUndefined(first(params.role)),
    memberId: uuidOrUndefined(first(params.member)),
    tab: tab && /^[a-z-]{1,24}$/.test(tab) ? tab : undefined,
    cursor: cursor && cursor.length <= 64 ? cursor : undefined,
  };
}

export function settingsHref(
  base: string,
  section: SettingsSectionId,
  target?: { channelId?: string; roleId?: string; memberId?: string; tab?: string },
): string {
  const params = new URLSearchParams({ section });
  if (target?.channelId) params.set("channel", target.channelId);
  if (target?.roleId) params.set("role", target.roleId);
  if (target?.memberId) params.set("member", target.memberId);
  if (target?.tab) params.set("tab", target.tab);
  return `${base}?${params.toString()}`;
}
