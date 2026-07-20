"use server";

import { revalidatePath } from "next/cache";

import { requireInfluencer } from "@/lib/supabase/access";

type Result = { error?: string; success?: true };
type Role = "member" | "moderator" | "influencer";

const value = (data: FormData, key: string) => typeof data.get(key) === "string" ? String(data.get(key)).trim() : "";
const uuid = (candidate: string) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(candidate);
const roles = (data: FormData): Role[] => [...new Set(data.getAll("allowedRoles").filter((role): role is Role => role === "member" || role === "moderator" || role === "influencer"))];

function refresh() {
  for (const path of ["/creator/channels", "/dashboard/community", "/creator", "/dashboard"]) revalidatePath(path);
}

async function creatorSupabase() {
  const { supabase } = await requireInfluencer();
  return { supabase };
}

function access(data: FormData) {
  const minTier = Number(value(data, "minTier"));
  const allowedRoles = roles(data);
  const visibilityMode = value(data, "visibilityMode");
  if (!Number.isInteger(minTier) || minTier < 1 || minTier > 5 || !allowedRoles.length || !["locked", "hidden"].includes(visibilityMode)) return null;
  return { min_tier: minTier, allowed_roles: allowedRoles, visibility_mode: visibilityMode };
}

export async function saveCategory(data: FormData): Promise<Result> {
  const id = value(data, "categoryId");
  const name = value(data, "name");
  const rule = access(data);
  if (!name || name.length > 80 || !rule || (id && !uuid(id))) return { error: "Enter a name and valid category access rule." };
  const { supabase } = await creatorSupabase();
  const { data: nextCategory } = await supabase.from("channel_categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const payload = { name, description: value(data, "description") || null, default_min_tier: rule.min_tier, default_allowed_roles: rule.allowed_roles, default_visibility_mode: rule.visibility_mode };
  const query = id ? supabase.from("channel_categories").update(payload).eq("id", id) : supabase.from("channel_categories").insert({ ...payload, sort_order: (nextCategory?.sort_order ?? -1) + 1 });
  const { error } = await query;
  if (error) return { error: error.message };
  refresh(); return { success: true };
}

export async function saveChannel(data: FormData): Promise<Result> {
  const id = value(data, "channelId");
  const categoryId = value(data, "categoryId");
  const name = value(data, "name");
  const type = value(data, "type");
  const rule = access(data);
  if ((id && !uuid(id)) || !uuid(categoryId) || !name || name.length > 80 || !["text", "announcements", "events", "master"].includes(type) || !rule) return { error: "Enter a category, name, type, and valid access rule." };
  const { supabase } = await creatorSupabase();
  const { data: nextChannel } = await supabase.from("channels").select("sort_order").eq("category_id", categoryId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const payload = { category_id: categoryId, name, type, description: value(data, "description") || null, ...rule, is_active: true, is_archived: false };
  const query = id ? supabase.from("channels").update(payload).eq("id", id) : supabase.from("channels").insert({ ...payload, sort_order: (nextChannel?.sort_order ?? -1) + 1 });
  const { error } = await query;
  if (error) return { error: error.message };
  refresh(); return { success: true };
}

export async function setCommunityStructureArchived(kind: "category" | "channel", id: string, archived: boolean): Promise<Result> {
  if (!uuid(id)) return { error: "Invalid item." };
  const { supabase } = await creatorSupabase();
  const table = kind === "category" ? "channel_categories" : "channels";
  const payload = kind === "channel" ? { is_archived: archived, is_active: !archived } : { is_archived: archived };
  const { error } = await supabase.from(table).update(payload).eq("id", id);
  if (error) return { error: error.message };
  refresh(); return { success: true };
}

export async function deleteCommunityStructure(kind: "category" | "channel", id: string): Promise<Result> {
  if (!uuid(id)) return { error: "Invalid item." };
  const { supabase } = await creatorSupabase();
  if (kind === "category") {
    const { count, error } = await supabase.from("channels").select("id", { count: "exact", head: true }).eq("category_id", id);
    if (error) return { error: error.message };
    if (count) return { error: "Archive or permanently delete every channel in this category first." };
    const { error: deleteError } = await supabase.from("channel_categories").delete().eq("id", id);
    if (deleteError) return { error: deleteError.message };
  } else {
    const { count, error } = await supabase.from("posts").select("id", { count: "exact", head: true }).eq("channel_id", id);
    if (error) return { error: error.message };
    if (count) return { error: "Channels with posts can only be archived." };
    const { error: deleteError } = await supabase.from("channels").delete().eq("id", id);
    if (deleteError) return { error: deleteError.message };
  }
  refresh(); return { success: true };
}

export async function reorderCommunityStructure(kind: "category" | "channel", ids: string[]): Promise<Result> {
  if (!ids.length || new Set(ids).size !== ids.length || ids.some((id) => !uuid(id))) return { error: "Invalid order." };
  const { supabase } = await creatorSupabase();
  const table = kind === "category" ? "channel_categories" : "channels";
  for (let index = 0; index < ids.length; index += 1) {
    const { error } = await supabase.from(table).update({ sort_order: index }).eq("id", ids[index]);
    if (error) return { error: error.message };
  }
  refresh(); return { success: true };
}
