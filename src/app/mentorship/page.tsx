import MentorshipView from "@/components/mentorship/MentorshipView";
import { requireActiveMembership } from "@/lib/supabase/access";

export default async function MentorshipPage() {
  const { supabase, user } = await requireActiveMembership("/mentorship");

  const [profileResult, tierResult, notificationsResult, mentorshipResult] = await Promise.all([
    supabase.from("profiles").select("full_name, platform_role").eq("id", user.id).maybeSingle(),
    supabase.from("member_tiers").select("current_tier, is_master").eq("user_id", user.id).maybeSingle(),
    supabase.from("notifications").select("id, type, title, body, action_url, is_read, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("mentorships").select("status, booking_url, mentor:assigned_mentor_id(full_name), starts_at, ends_at").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
  ]);

  if ([profileResult, tierResult, notificationsResult, mentorshipResult].some((res) => res.error)) {
    throw new Error("Unable to load mentorship workspace details.");
  }

  const profile = profileResult.data;
  const isMaster = tierResult.data?.is_master ?? false;
  const currentTier = tierResult.data?.current_tier ?? 1;
  const notifications = notificationsResult.data ?? [];
  const mentorship = mentorshipResult.data;

  const mentor = mentorship?.mentor as unknown as { full_name?: string } | { full_name?: string }[] | null | undefined;
  const mentorName = (Array.isArray(mentor) ? mentor[0]?.full_name : mentor?.full_name) ?? "Marcus Aurelius";

  return (
    <MentorshipView
      isMaster={isMaster}
      memberName={profile?.full_name?.trim() || "Practitioner"}
      platformRole={profile?.platform_role ?? "member"}
      currentTier={currentTier}
      notifications={notifications}
      hasMentorship={!!mentorship}
      bookingUrl={mentorship?.booking_url ?? null}
      mentorName={mentorName}
      startsAt={mentorship?.starts_at ?? null}
      endsAt={mentorship?.ends_at ?? null}
    />
  );
}
