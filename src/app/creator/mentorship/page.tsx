import MentorshipView from "@/components/mentorship/MentorshipView";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorMentorshipPage() {
  const { supabase, user } = await requireInfluencerWorkspace("/creator/mentorship");
  const [profileResult, tierResult, notificationsResult, mentorshipResult] = await Promise.all([
    supabase.from("profiles").select("full_name, platform_role").eq("id", user.id).maybeSingle(),
    supabase.from("member_tiers").select("current_tier, is_master").eq("user_id", user.id).maybeSingle(),
    supabase.from("notifications").select("id, type, title, body, action_url, is_read, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("mentorships").select("status, booking_url, mentor:assigned_mentor_id(full_name), starts_at, ends_at").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
  ]);

  if ([profileResult, tierResult, notificationsResult, mentorshipResult].some((result) => result.error)) {
    throw new Error("Unable to load creator mentorship details.");
  }

  const mentor = mentorshipResult.data?.mentor as unknown as { full_name?: string } | { full_name?: string }[] | null | undefined;
  const mentorName = (Array.isArray(mentor) ? mentor[0]?.full_name : mentor?.full_name) ?? "Marcus Aurelius";

  return <MentorshipView isMaster={tierResult.data?.is_master ?? false} memberName={profileResult.data?.full_name?.trim() || "Practitioner"} platformRole={profileResult.data?.platform_role ?? "influencer"} currentTier={tierResult.data?.current_tier ?? 1} notifications={notificationsResult.data ?? []} hasMentorship={!!mentorshipResult.data} bookingUrl={mentorshipResult.data?.booking_url ?? null} mentorName={mentorName} startsAt={mentorshipResult.data?.starts_at ?? null} endsAt={mentorshipResult.data?.ends_at ?? null} routeBase="/creator" />;
}
