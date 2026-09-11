import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CommunityCategory, CommunityChannel } from "@/components/community/types";
import { isChannelPermissionKey, type ChannelPermissionKey } from "@/lib/community-settings/permissions";

/**
 * The creator's view of community structure, in one place.
 *
 * `/creator/channels` reads it through `renderCommunityWorkspace` and
 * `/creator/settings` reads it directly. Duplicated, the two projections drift
 * and one surface starts editing a field the other cannot see.
 *
 * This is the creator projection only — it reads the base tables, which RLS
 * gates on influencer/staff. The member path stays on the
 * `community_channel_directory()` RPC and must not be routed through here.
 */
export async function loadCommunityStructure(
  supabase: SupabaseClient,
): Promise<{ categories: CommunityCategory[]; channels: CommunityChannel[] }> {
  const [categoryResult, channelResult] = await Promise.all([
    supabase
      .from("channel_categories")
      .select("id,name,description,sort_order,default_min_tier,default_allowed_roles,default_visibility_mode,is_archived")
      .order("sort_order"),
    supabase
      .from("channels")
      .select("id,category_id,name,type,description,sort_order,min_tier,allowed_roles,visibility_mode,is_archived,permissions_synced,slow_mode_seconds,legacy_type")
      .order("sort_order"),
  ]);

  // The code is logged before the throw because the message that reaches the
  // page says nothing. A stale PostgREST schema cache after a migration that
  // adds columns fails here as PGRST204/42703, and without this line the only
  // symptom is "Unable to load channel structure."
  if (categoryResult.error || channelResult.error) {
    console.error("[community-settings]", {
      categoryCode: categoryResult.error?.code ?? null,
      channelCode: channelResult.error?.code ?? null,
    });
    throw new Error("Unable to load channel structure.");
  }

  return {
    categories: (categoryResult.data ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      sortOrder: category.sort_order,
      minTier: category.default_min_tier,
      allowedRoles: category.default_allowed_roles,
      visibilityMode: category.default_visibility_mode as "locked" | "hidden",
      isArchived: category.is_archived,
    })),
    channels: (channelResult.data ?? []).map((channel) => ({
      id: channel.id,
      categoryId: channel.category_id,
      name: channel.name,
      type: channel.type,
      description: channel.description,
      sortOrder: channel.sort_order,
      minTier: channel.min_tier,
      allowedRoles: channel.allowed_roles,
      visibilityMode: channel.visibility_mode as "locked" | "hidden",
      isArchived: channel.is_archived,
      isLocked: false,
      // The creator projection reads the base table, where "can this viewer
      // send here" is not a column. The member path gets it from the directory.
      canSend: false,
      slowModeSeconds: channel.slow_mode_seconds ?? 0,
      permissionsSynced: channel.permissions_synced ?? true,
      unlockTier: null,
    })),
  };
}

export type ChannelOverride = {
  id: string;
  channelId: string | null;
  categoryId: string | null;
  roleId: string;
  allow: ChannelPermissionKey[];
  deny: ChannelPermissionKey[];
};

/**
 * Every override, for the permissions grid.
 *
 * Loaded whole rather than per channel: there is one row per (target, role)
 * pair that is not entirely Neutral, so the table stays small by construction,
 * and the grid needs a channel's own rows and its category's at the same time
 * to render the "follows the category" mirror.
 */
export async function loadChannelOverrides(
  supabase: SupabaseClient,
): Promise<{ overrides: ChannelOverride[]; degraded: string[] }> {
  const { data, error } = await supabase
    .from("channel_permission_overrides")
    .select("id,channel_id,category_id,role_id,allow,deny");

  if (error) {
    console.error("[community-settings]", { code: error.code ?? null });
    return {
      overrides: [],
      degraded: ["Channel permissions could not be read. Saving them is disabled until migration 20260912020000 is applied."],
    };
  }

  return {
    overrides: (data ?? []).map((row) => ({
      id: row.id,
      channelId: row.channel_id,
      categoryId: row.category_id,
      // Normalised on read as well as on write: a row stored before a key was
      // renamed should not reach the grid as an unrecognised checkbox.
      allow: (row.allow ?? []).filter(isChannelPermissionKey),
      deny: (row.deny ?? []).filter(isChannelPermissionKey),
      roleId: row.role_id,
    })),
    degraded: [],
  };
}
