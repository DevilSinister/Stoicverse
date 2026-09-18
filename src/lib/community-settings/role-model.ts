/**
 * The role itself: its bounds, its validation, and the two questions the
 * member interface asks of a stack of roles — which one colours the name, and
 * which one groups it in the member list.
 *
 * Imports only from `model.ts` and `permissions.ts`, both of which are
 * themselves import-free, so the node test runner loads this file directly.
 * Every bound here is also a CHECK or a `raise` in migration 20260912010000 —
 * this exists to fail earlier and more legibly, never to replace the database.
 */

// Relative and extension-bearing: `node --test` loads this file directly, so it
// resolves neither the `@/` alias nor an extensionless specifier for a value
// import. `model.ts` and `permissions.ts` are themselves import-free.
import { contrastRatio, formatContrast, isHexColor } from "./model.ts";
import { normalizePermissions, type PermissionKey } from "./permissions.ts";

/** Mirrors `community_roles_system_key_known`. */
export const SYSTEM_ROLE_KEYS = [
  "everyone",
  "tier_1",
  "tier_2",
  "tier_3",
  "tier_4",
  "tier_5",
  "moderator",
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

/**
 * Roles that follow a member's paid tier. They are assigned by trigger from
 * `member_tiers`, so the interface offers no way to add or remove one — an
 * "Assign" button here would be a control the database refuses.
 */
export const TIER_ROLE_KEYS: readonly SystemRoleKey[] = ["tier_1", "tier_2", "tier_3", "tier_4", "tier_5"];

export function isSystemRoleKey(value: unknown): value is SystemRoleKey {
  return typeof value === "string" && (SYSTEM_ROLE_KEYS as readonly string[]).includes(value);
}

/** True when the role cannot be assigned or removed by hand — see `community_role_assign`. */
export function isTierRole(systemKey: string | null): boolean {
  return systemKey !== null && (TIER_ROLE_KEYS as readonly string[]).includes(systemKey);
}

export const ROLE_LIMITS = {
  name: { min: 2, max: 32 },
  iconEmoji: { max: 16 },
  iconBytes: 256 * 1024,
  iconTypes: ["image/png", "image/webp", "image/gif"],
} as const;

/**
 * The surface a role colour is read against — the member list and the message
 * author line, both of which sit on `--color-surface-container-low`. Darker
 * than the page background the accent is measured against, so a colour that
 * clears the accent floor does not automatically clear this one.
 */
export const ROLE_SURFACE_COLOR = "#0D1C2D";

/** A role name is body text at 13px. Below 3:1 it stops being readable as a name. */
export const MIN_ROLE_CONTRAST = 3;

/** Ten that clear the floor against the role surface. Hex entry stays available behind Advanced. */
export const ROLE_SWATCHES = [
  { hex: "#94A3B8", name: "Slate" },
  { hex: "#10B981", name: "Emerald" },
  { hex: "#38BDF8", name: "Sky" },
  { hex: "#2DD4BF", name: "Teal" },
  { hex: "#C8A24A", name: "Brass" },
  { hex: "#FB923C", name: "Amber" },
  { hex: "#F472B6", name: "Rose" },
  { hex: "#A78BFA", name: "Iris" },
  { hex: "#F87171", name: "Coral" },
  { hex: "#d4e4fa", name: "Bone" },
] as const;

export type CommunityRole = {
  id: string;
  name: string;
  color: string;
  position: number;
  hoist: boolean;
  mentionable: boolean;
  iconEmoji: string | null;
  iconPath: string | null;
  permissions: PermissionKey[];
  systemKey: SystemRoleKey | null;
  /** Shown beside every role, so no grant is made blind. */
  memberCount: number;
};

export type RoleInput = {
  name: string;
  color: string;
  hoist: boolean;
  mentionable: boolean;
  iconEmoji: string | null;
  iconPath: string | null;
  permissions: PermissionKey[];
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function truthy(value: unknown): boolean {
  return value === true || value === "on" || value === "true";
}

/**
 * Validate one role submission.
 *
 * Throws the message the person editing should read. Unknown permission keys
 * are dropped rather than rejected, exactly as the database trigger does: a
 * stale checkbox from an older tab should not fail the whole save.
 */
export function parseRoleInput(input: Record<string, unknown>): RoleInput {
  const name = text(input.name);
  if (name.length < ROLE_LIMITS.name.min || name.length > ROLE_LIMITS.name.max) {
    throw new Error(`A role name must be between ${ROLE_LIMITS.name.min} and ${ROLE_LIMITS.name.max} characters.`);
  }

  const color = text(input.color);
  if (!isHexColor(color)) {
    throw new Error("A role colour must be a six-digit hex value, such as #10B981.");
  }
  const ratio = contrastRatio(color, ROLE_SURFACE_COLOR);
  if (ratio === null || ratio < MIN_ROLE_CONTRAST) {
    throw new Error(
      `That colour reaches ${formatContrast(ratio ?? 1)} against the member list. A role name needs at least ${MIN_ROLE_CONTRAST}:1 to stay readable.`,
    );
  }

  const iconEmoji = text(input.iconEmoji);
  if (iconEmoji.length > ROLE_LIMITS.iconEmoji.max) {
    throw new Error("That icon is not a single emoji.");
  }
  const iconPath = text(input.iconPath);
  // The database CHECK refuses both at once; catching it here keeps the person
  // from losing the rest of the form to a 23514.
  if (iconEmoji && iconPath) {
    throw new Error("Choose an emoji or an uploaded image for the icon, not both.");
  }

  const raw = Array.isArray(input.permissions) ? input.permissions : [];
  return {
    name,
    color: color.toUpperCase(),
    hoist: truthy(input.hoist),
    mentionable: truthy(input.mentionable),
    iconEmoji: iconEmoji || null,
    iconPath: iconPath || null,
    permissions: normalizePermissions(raw),
  };
}

/**
 * The role that groups a member in the member list.
 *
 * Highest position wins among the hoisted ones. Null when the member holds no
 * hoisted role, which is the signal to file them under Online or Offline.
 */
export function highestHoistedRole<T extends { position: number; hoist: boolean }>(roles: readonly T[]): T | null {
  let best: T | null = null;
  for (const role of roles) {
    if (!role.hoist) continue;
    if (!best || role.position > best.position) best = role;
  }
  return best;
}

/**
 * The colour a member's name is drawn in.
 *
 * The highest role *that has a colour of its own* — hoisting is about grouping
 * and says nothing about colour, so a hoisted role does not outrank a higher
 * unhoisted one here. Null means the default text colour.
 */
export function roleDisplayColor<T extends { position: number; color: string | null }>(
  roles: readonly T[],
): string | null {
  let best: T | null = null;
  for (const role of roles) {
    if (!role.color) continue;
    if (!best || role.position > best.position) best = role;
  }
  return best?.color ?? null;
}

/** Highest position held, matching `public.community_highest_position`. Zero when none. */
export function highestPosition(roles: readonly { position: number }[]): number {
  return roles.reduce((highest, role) => (role.position > highest ? role.position : highest), 0);
}
