import { CreatorWorkspace } from "@/components/creator/CreatorWorkspace";
import { requirePlatformRole } from "@/lib/supabase/access";

export default async function CreatorPage() {
  const { supabase } = await requirePlatformRole("influencer");
  const [members, channels, tiers, lessons, moderators, reviews, events] = await Promise.all([
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("channels").select("id, name, type, description, min_tier, sort_order, is_active").order("sort_order"),
    supabase.from("tiers").select("id, level, title").order("level"),
    supabase.from("lessons").select("id, title, description, tier_id, duration_seconds, sort_order, status, release_at, tiers(level, title)").order("sort_order"),
    supabase.from("profiles").select("id, full_name, platform_role").eq("platform_role", "moderator").order("full_name"),
    supabase.from("review_applications").select("id, status, answers, submitted_at, decision_notes, call_scheduled_at, profiles!review_applications_user_id_fkey(full_name)").order("submitted_at", { ascending: false }).limit(40),
    supabase.from("events").select("id, channel_id, title, description, starts_at, ends_at, min_tier, status").order("starts_at", { ascending: true }).limit(40),
  ]);

  if ([members, channels, tiers, lessons, moderators, reviews, events].some((result) => result.error)) throw new Error("Unable to load influencer workspace.");

  return <CreatorWorkspace activeMembers={members.count ?? 0} channels={channels.data ?? []} tiers={tiers.data ?? []} lessons={lessons.data ?? []} moderators={moderators.data ?? []} reviews={reviews.data ?? []} events={events.data ?? []} />;
}
