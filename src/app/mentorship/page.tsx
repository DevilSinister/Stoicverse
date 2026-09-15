import MentorshipView from "@/components/mentorship/MentorshipView";
import { findPurchase } from "@/lib/checkout/plans";
import { priceFor } from "@/lib/stripe/prices";
import { requireActiveMembership, requireInfluencerWorkspace } from "@/lib/supabase/access";
import { profileRow } from "@/lib/supabase/viewer";

type MentorshipPageOptions = {
  nextPath?: string;
  routeBase?: string;
  creatorWorkspace?: boolean;
};

export async function renderMentorshipPage({ nextPath = "/mentorship", routeBase = "", creatorWorkspace = false }: MentorshipPageOptions = {}) {
  const { supabase, user } = creatorWorkspace
    ? await requireInfluencerWorkspace(nextPath)
    : await requireActiveMembership(nextPath);

  const [profileResult, tierResult, notificationsResult, mentorshipResult] = await Promise.all([
    profileRow(),
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

  /*
    The offer's amount comes from the price that will be charged.

    Only for somebody who has not bought it — the workspace shows no figure, and
    a Stripe round trip on a page that will not print it is wasted. `priceFor`
    memoises per server instance and returns null rather than guessing, which is
    what lets the offer render without an amount instead of with a stale one.
  */
  const purchase = findPurchase("mentorship", null);
  const price = mentorship || !purchase ? null : await priceFor(purchase);

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
      price={price?.amount ?? null}
      cadence={purchase?.cadence ?? "one-time"}
      routeBase={routeBase}
    />
  );
}

export default async function MentorshipPage() {
  return renderMentorshipPage();
}
