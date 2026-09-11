import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CommunityCategory, CommunityChannel } from "@/components/community/types";

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
      .select("id,category_id,name,type,description,sort_order,min_tier,allowed_roles,visibility_mode,is_archived")
      .order("sort_order"),
  ]);

  if (categoryResult.error || channelResult.error) throw new Error("Unable to load channel structure.");

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
    })),
  };
}
