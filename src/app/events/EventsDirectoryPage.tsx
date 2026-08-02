import { EventsView, type EventRecord } from "@/components/events/EventsView";
import { requireActiveMembership } from "@/lib/supabase/access";

export async function renderEventsPage({ nextPath = "/dashboard/events", routeBase = "/dashboard" }: { nextPath?: string; routeBase?: string } = {}) {
  const { supabase, user } = await requireActiveMembership(nextPath);
  const [{ data: tier, error: tierError }, { data: profile, error: profileError }, { data: events, error: eventsError }, { data: enrollments, error: enrollmentError }] = await Promise.all([
    supabase.from("member_tiers").select("is_master, current_tier").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("full_name, platform_role, is_suspended").eq("id", user.id).maybeSingle(),
    supabase.from("events").select("*").in("status", ["upcoming", "live", "completed", "cancelled"]).order("starts_at", { ascending: true }),
    supabase.from("event_enrollments").select("event_id").eq("user_id", user.id),
  ]);

  if (tierError || profileError || eventsError) {
    console.error("Unable to load events", { tierError, profileError, eventsError });
    throw new Error("Unable to load event access.");
  }

  if (enrollmentError) console.warn("Event enrollment data is unavailable. Apply the events enrollment migration.", enrollmentError);

  const enrolledIds = new Set(enrollments?.map((enrollment) => enrollment.event_id) ?? []);
  const visibleEvents: EventRecord[] = (events ?? []).map((event) => ({
    id: event.id, title: event.title, description: event.description, hostName: event.host_name ?? "Stoicverse Team",
    startsAt: event.starts_at, endsAt: event.ends_at, minTier: event.min_tier,
    status: event.status, enrolled: enrolledIds.has(event.id), publishAt: event.publish_at ?? null, publishedAt: event.published_at ?? null,
    cancelledAt: event.cancelled_at ?? null, cancellationReason: event.cancellation_reason ?? null,
  }));

  const isStaff = ["moderator", "influencer", "super_admin"].includes(profile?.platform_role ?? "") && !profile?.is_suspended;
  return <EventsView events={visibleEvents} enrollmentAvailable={!enrollmentError} currentTier={tier?.current_tier ?? 1} isMaster={tier?.is_master ?? false} isStaff={isStaff} memberName={profile?.full_name ?? undefined} routeBase={routeBase} />;
}
