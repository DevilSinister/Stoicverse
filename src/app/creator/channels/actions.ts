"use server";

import { isChannelType, parseSlowMode } from "@/lib/community-settings/model";
import { parseOverrideGrid } from "@/lib/community-settings/permissions";
import { revalidateCommunity as refresh } from "@/lib/community-settings/revalidate";
import { isUuid as uuid } from "@/lib/security/uuid";
import { requireCommunityPermission } from "@/lib/supabase/access";
import { postgresMessage } from "@/lib/supabase/errors";

type Result = { error?: string; success?: true };

const value = (data: FormData, key: string) => typeof data.get(key) === "string" ? String(data.get(key)).trim() : "";

async function creatorSupabase() {
  // `manage_channels`, not "is the influencer": the policies on `channels` and
  // `channel_categories` ask the resolver the same question, so a moderator
  // holding the grant reaches exactly the same surface.
  const { supabase } = await requireCommunityPermission("manage_channels");
  return { supabase };
}

/**
 * Phase 9 left one field here. `min_tier` and `allowed_roles` were validated
 * and written by this function long after the overrides took over deciding
 * access, so a refused form told a creator their tier was invalid and an
 * accepted one changed nothing. `visibility_mode` is the survivor because it
 * answers a different question: locked-and-listed, or not listed.
 */
function access(data: FormData) {
  const visibilityMode = value(data, "visibilityMode");
  if (!["locked", "hidden"].includes(visibilityMode)) return null;
  return { visibility_mode: visibilityMode };
}

export async function saveCategory(data: FormData): Promise<Result> {
  const id = value(data, "categoryId");
  const name = value(data, "name");
  const rule = access(data);
  if (!name || name.length > 80 || !rule || (id && !uuid(id))) return { error: "Enter a name and a valid visibility setting." };
  const { supabase } = await creatorSupabase();
  const { data: nextCategory } = await supabase.from("channel_categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const payload = { name, description: value(data, "description") || null, default_visibility_mode: rule.visibility_mode };
  const query = id ? supabase.from("channel_categories").update(payload).eq("id", id) : supabase.from("channel_categories").insert({ ...payload, sort_order: (nextCategory?.sort_order ?? -1) + 1 });
  const { error } = await query;
  if (error) return { error: postgresMessage(error, "That change could not be saved.") };
  refresh(); return { success: true };
}

export async function saveChannel(data: FormData): Promise<Result> {
  const id = value(data, "channelId");
  const categoryId = value(data, "categoryId");
  const name = value(data, "name");
  const type = value(data, "type");
  const rule = access(data);
  if ((id && !uuid(id)) || !uuid(categoryId) || !name || name.length > 80 || !isChannelType(type) || !rule) return { error: "Enter a category, name, type, and a valid visibility setting." };
  const { supabase } = await creatorSupabase();
  const { data: nextChannel } = await supabase.from("channels").select("sort_order").eq("category_id", categoryId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const payload = { category_id: categoryId, name, type, description: value(data, "description") || null, ...rule, is_active: true, is_archived: false };
  const query = id ? supabase.from("channels").update(payload).eq("id", id) : supabase.from("channels").insert({ ...payload, sort_order: (nextChannel?.sort_order ?? -1) + 1 });
  const { error } = await query;
  if (error) return { error: postgresMessage(error, "That change could not be saved.") };
  refresh(); return { success: true };
}

export async function setCommunityStructureArchived(kind: "category" | "channel", id: string, archived: boolean): Promise<Result> {
  if (!uuid(id)) return { error: "Invalid item." };
  const { supabase } = await creatorSupabase();
  const table = kind === "category" ? "channel_categories" : "channels";
  const payload = kind === "channel" ? { is_archived: archived, is_active: !archived } : { is_archived: archived };
  const { error } = await supabase.from(table).update(payload).eq("id", id);
  if (error) return { error: postgresMessage(error, "That item could not be updated.") };
  refresh(); return { success: true };
}

export async function deleteCommunityStructure(kind: "category" | "channel", id: string): Promise<Result> {
  if (!uuid(id)) return { error: "Invalid item." };
  const { supabase } = await creatorSupabase();
  if (kind === "category") {
    const { count, error } = await supabase.from("channels").select("id", { count: "exact", head: true }).eq("category_id", id);
    if (error) return { error: postgresMessage(error, "That category could not be read.") };
    if (count) return { error: "Archive or permanently delete every channel in this category first." };
    const { error: deleteError } = await supabase.from("channel_categories").delete().eq("id", id);
    if (deleteError) return { error: postgresMessage(deleteError, "That category could not be deleted.") };
  } else {
    const { count, error } = await supabase.from("posts").select("id", { count: "exact", head: true }).eq("channel_id", id);
    if (error) return { error: postgresMessage(error, "That channel could not be read.") };
    if (count) return { error: "Channels with posts can only be archived." };
    const { error: deleteError } = await supabase.from("channels").delete().eq("id", id);
    if (deleteError) return { error: postgresMessage(deleteError, "That channel could not be deleted.") };
  }
  refresh(); return { success: true };
}

export async function reorderCommunityStructure(kind: "category" | "channel", ids: string[]): Promise<Result> {
  if (!ids.length || new Set(ids).size !== ids.length || ids.some((id) => !uuid(id))) return { error: "Invalid order." };
  const { supabase } = await creatorSupabase();
  const table = kind === "category" ? "channel_categories" : "channels";
  for (let index = 0; index < ids.length; index += 1) {
    const { error } = await supabase.from(table).update({ sort_order: index }).eq("id", ids[index]);
    if (error) return { error: postgresMessage(error, "That order could not be saved.") };
  }
  refresh(); return { success: true };
}

/**
 * Write every override for one channel or category in a single action.
 *
 * Next dispatches Server Actions sequentially per client, so a call per role
 * would serialise into N round trips while the grid sat half-saved. An entry
 * whose allow and deny are both empty deletes that role's override, which is
 * what "every control back to Neutral" means.
 */
export async function setChannelOverrides(
  targetKind: "channel" | "category",
  targetId: string,
  entries: { roleId: string; grid: Record<string, string> }[],
): Promise<Result> {
  if (!["channel", "category"].includes(targetKind) || !uuid(targetId)) return { error: "Invalid target." };
  if (!Array.isArray(entries) || entries.length > 50) return { error: "Change at most 50 roles at a time." };
  if (entries.some((entry) => !uuid(entry.roleId))) return { error: "Invalid role." };

  const { supabase } = await creatorSupabase();
  for (const entry of entries) {
    const { allow, deny } = parseOverrideGrid(entry.grid ?? {});
    const { error } = await supabase.rpc("community_override_set", {
      target_kind: targetKind,
      target_id: targetId,
      role_id: entry.roleId,
      allow_keys: allow,
      deny_keys: deny,
    });
    if (error) return { error: postgresMessage(error, "Those channel permissions could not be saved.") };
  }
  refresh();
  return { success: true };
}

export async function deleteChannelOverride(overrideId: string): Promise<Result> {
  if (!uuid(overrideId)) return { error: "Invalid override." };
  const { supabase } = await creatorSupabase();
  const { error } = await supabase.rpc("community_override_delete", { override_id: overrideId });
  if (error) return { error: postgresMessage(error, "That override could not be removed.") };
  refresh();
  return { success: true };
}

/** Re-syncing discards the channel's own overrides — the RPC says so and does it. */
export async function setChannelPermissionSync(channelId: string, synced: boolean): Promise<Result> {
  if (!uuid(channelId)) return { error: "Invalid channel." };
  const { supabase } = await creatorSupabase();
  const { error } = await supabase.rpc("community_channel_sync_permissions", { channel_id: channelId, synced });
  if (error) return { error: postgresMessage(error, "That channel could not be re-synced.") };
  refresh();
  return { success: true };
}

export async function setChannelSlowMode(channelId: string, seconds: number): Promise<Result> {
  if (!uuid(channelId)) return { error: "Invalid channel." };
  let clean: number;
  try {
    clean = parseSlowMode(seconds);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid slow mode." };
  }

  const { supabase } = await creatorSupabase();
  const { error } = await supabase.rpc("community_channel_set_slow_mode", { channel_id: channelId, seconds: clean });
  if (error) return { error: postgresMessage(error, "Slow mode could not be saved.") };
  refresh();
  return { success: true };
}
