import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizePermissions, type PermissionKey } from "@/lib/community-settings/permissions";
import { isSystemRoleKey, type CommunityRole, type SystemRoleKey } from "@/lib/community-settings/role-model";

export const ROLE_ICON_BUCKET = "community-role-icons";

export type RolesLoad = {
  roles: CommunityRole[];
  /** Resolved public URLs for uploaded icons, keyed by role id. */
  iconUrls: Record<string, string>;
  /** The viewer's own ceiling, so the list can disable roles at or above it. */
  viewerHighestPosition: number;
  degraded: string[];
};

type RoleRow = {
  id: string;
  name: string;
  color: string;
  position: number;
  hoist: boolean;
  mentionable: boolean;
  icon_emoji: string | null;
  icon_path: string | null;
  permissions: string[] | null;
  system_key: string | null;
};

/**
 * Every role, highest first, with how many people hold each.
 *
 * "Effective for N members" is not decoration: a permission grid with no
 * headcount invites granting `manage_messages` to a role that turns out to
 * have forty people in it. A failed headcount is said out loud rather than
 * rendered as "0 members".
 */
export async function loadCommunityRoles(supabase: SupabaseClient, viewerId: string): Promise<RolesLoad> {
  const [roleResult, memberResult, ceilingResult] = await Promise.all([
    supabase
      .from("community_roles")
      // One string literal: supabase-js parses the projection at the type
      // level, and a concatenated expression degrades every column to
      // GenericStringError.
      .select("id,name,color,position,hoist,mentionable,icon_emoji,icon_path,permissions,system_key")
      .order("position", { ascending: false }),
    supabase.from("community_role_members").select("role_id"),
    supabase.rpc("community_highest_position", { target: viewerId }),
  ]);

  if (roleResult.error) {
    console.error("[community-settings]", { code: roleResult.error.code ?? null });
    return {
      roles: [],
      iconUrls: {},
      viewerHighestPosition: 0,
      degraded: ["Roles could not be read. Saving is disabled until migration 20260912010000 is applied."],
    };
  }

  const degraded: string[] = [];
  const counts = new Map<string, number>();
  if (memberResult.error) {
    console.error("[community-settings]", { code: memberResult.error.code ?? null });
    degraded.push("Member counts per role could not be read.");
  } else {
    for (const row of memberResult.data ?? []) counts.set(row.role_id, (counts.get(row.role_id) ?? 0) + 1);
  }

  if (ceilingResult.error) {
    console.error("[community-settings]", { code: ceilingResult.error.code ?? null });
    degraded.push("Your own role position could not be read, so editing is limited to roles you certainly outrank.");
  }

  const rows = (roleResult.data ?? []) as RoleRow[];
  const iconUrls: Record<string, string> = {};
  for (const row of rows) {
    // The bucket is public, so this is string construction rather than a
    // request. A private bucket would mean a signed-URL round trip per role.
    if (row.icon_path) {
      iconUrls[row.id] = supabase.storage.from(ROLE_ICON_BUCKET).getPublicUrl(row.icon_path).data.publicUrl;
    }
  }

  return {
    roles: rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      position: row.position,
      hoist: row.hoist,
      mentionable: row.mentionable,
      iconEmoji: row.icon_emoji,
      iconPath: row.icon_path,
      // The trigger already normalises on write; re-running it on read keeps a
      // row written before the trigger existed from reaching the grid.
      permissions: normalizePermissions(row.permissions ?? []) as PermissionKey[],
      systemKey: isSystemRoleKey(row.system_key) ? (row.system_key as SystemRoleKey) : null,
      memberCount: counts.get(row.id) ?? 0,
    })),
    iconUrls,
    viewerHighestPosition: typeof ceilingResult.data === "number" ? ceilingResult.data : 0,
    degraded,
  };
}

export type RoleMemberRow = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  /** `system` rows come from a tier or platform-role trigger and cannot be removed here. */
  source: "manual" | "system";
};

export const ROLE_MEMBER_PAGE_SIZE = 50;

type RoleMemberQueryRow = {
  id: string;
  full_name: string;
  normalized_name: string;
  avatar_url: string | null;
  source: string;
};

/** One keyset page of the people holding a role, ordered by name. */
export async function loadRoleMembers(
  supabase: SupabaseClient,
  roleId: string,
  cursor?: { name: string; id: string },
): Promise<{ members: RoleMemberRow[]; nextCursor: { name: string; id: string } | null; degraded: string[] }> {
  const { data, error } = await supabase.rpc("community_role_members_page", {
    role_id: roleId,
    after_name: cursor?.name ?? null,
    after_id: cursor?.id ?? null,
    page_size: ROLE_MEMBER_PAGE_SIZE + 1,
  });

  if (error) {
    console.error("[community-settings]", { code: error.code ?? null });
    return { members: [], nextCursor: null, degraded: ["The members of this role could not be read."] };
  }

  const rows = (data ?? []) as RoleMemberQueryRow[];
  // One row over the page size tells us whether another page exists without a
  // second count query.
  const hasMore = rows.length > ROLE_MEMBER_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, ROLE_MEMBER_PAGE_SIZE) : rows;
  const last = page[page.length - 1];

  return {
    members: page.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      source: row.source === "system" ? "system" : "manual",
    })),
    nextCursor: hasMore && last ? { name: last.normalized_name, id: last.id } : null,
    degraded: [],
  };
}
