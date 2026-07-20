"use server";

import { revalidatePath } from "next/cache";
import { requireInfluencer } from "@/lib/supabase/access";

type Result = { error?: string; success?: true };
const text = (data: FormData, key: string) => typeof data.get(key) === "string" ? String(data.get(key)).trim() : "";

function validate(data: FormData) {
  const level = Number(text(data, "level"));
  const title = text(data, "title");
  const requiredLessonCount = Number(text(data, "requiredLessonCount"));
  if (!Number.isInteger(level) || level < 1 || level > 4 || !title || title.length > 120 || !Number.isInteger(requiredLessonCount) || requiredLessonCount < 1) return null;
  return { level, title, description: text(data, "description") || null, required_lesson_count: requiredLessonCount, sort_order: level };
}

function refresh() { for (const path of ["/creator/tiers", "/creator/courses", "/dashboard/courses", "/dashboard"]) revalidatePath(path); }

export async function saveTier(data: FormData): Promise<Result> {
  const tier = validate(data); if (!tier) return { error: "Enter a level from 1–4, title, and positive completion count." };
  const { supabase, user } = await requireInfluencer();
  const { data: community, error: communityError } = await supabase
    .from("communities")
    .select("id")
    .eq("influencer_id", user.id)
    .maybeSingle();
  if (communityError || !community) return { error: "Creator community not found." };
  const { error } = await supabase
    .from("tiers")
    .upsert({ ...tier, community_id: community.id }, { onConflict: "community_id,level" });
  if (error) return { error: error.message }; refresh(); return { success: true };
}

export async function deleteTier(id: string): Promise<Result> {
  const { supabase } = await requireInfluencer();
  const { data: tier, error: tierError } = await supabase.from("tiers").select("level").eq("id", id).maybeSingle();
  if (tierError || !tier) return { error: "Tier not found." };
  const [{ count: courses }, { count: lessons }] = await Promise.all([
    supabase.from("courses").select("id", { count: "exact", head: true }).or(`min_tier.eq.${tier.level},completion_tier.eq.${tier.level}`),
    supabase.from("lessons").select("id", { count: "exact", head: true }).eq("tier_id", id),
  ]);
  if ((courses ?? 0) || (lessons ?? 0)) return { error: "Move or remove linked courses and lessons before deleting this tier." };
  const { error } = await supabase.from("tiers").delete().eq("id", id); if (error) return { error: error.message }; refresh(); return { success: true };
}
