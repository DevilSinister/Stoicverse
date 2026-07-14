import { EventsView, type EventRecord } from "@/components/events/EventsView";
import { requireActiveMembership } from "@/lib/supabase/access";

export async function renderEventsPage({ nextPath = "/events", routeBase = "" }: { nextPath?: string; routeBase?: string } = {}) {
  const { supabase, user } = await requireActiveMembership(nextPath);
  const recentCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const [{ data: tier, error: tierError }, { data: profile, error: profileError }, { data: events, error: eventsError }, { data: enrollments, error: enrollmentError }] = await Promise.all([
    supabase
    .from("member_tiers")
    .select("is_master, current_tier")
    .eq("user_id", user.id)
    .maybeSingle(),
    supabase.from("profiles").select("full_name, platform_role").eq("id", user.id).maybeSingle(),
    // This also remains compatible with older event schemas: absent optional
    // columns are simply not returned by Postgres when selecting all fields.
    supabase.from("events").select("*").in("status", ["upcoming", "live", "completed", "cancelled"]).order("starts_at", { ascending: true }),
    supabase.from("event_enrollments").select("event_id").eq("user_id", user.id),
  ]);

  if (tierError || profileError || eventsError) {
    console.error("Unable to load events", { tierError, profileError, eventsError });
    throw new Error("Unable to load event access.");
  }

  // A deployed UI can briefly precede its database migration. Do not make the
  // directory unavailable in that window; enrollment controls explain the
  // required update instead.
  if (enrollmentError) {
    console.warn("Event enrollment data is unavailable. Apply the events enrollment migration.", enrollmentError);
  }

  const enrolledIds = new Set(enrollments?.map((enrollment) => enrollment.event_id) ?? []);
  const visibleEvents: EventRecord[] = (events ?? [])
    .filter((event) => {
      if (event.status === "cancelled") {
        const cancelledAt = event.cancelled_at ?? event.updated_at;
        return cancelledAt ? new Date(cancelledAt).getTime() >= recentCutoff : false;
      }

      const endedAt = event.ends_at ?? event.starts_at;
      return event.status !== "completed" || new Date(endedAt).getTime() >= recentCutoff;
    })
    .map((event) => ({
      id: event.id, title: event.title, description: event.description, hostName: event.host_name ?? "Stoicverse Team",
      startsAt: event.starts_at, endsAt: event.ends_at, minTier: event.min_tier,
      status: event.status, enrolled: enrolledIds.has(event.id), publishAt: event.publish_at ?? null, publishedAt: event.published_at ?? null,
      cancelledAt: event.cancelled_at ?? (event.status === "cancelled" ? event.updated_at : null), cancellationReason: event.cancellation_reason ?? null,
    }));

  return <EventsView events={visibleEvents} enrollmentAvailable={!enrollmentError} currentTier={tier?.current_tier ?? 1} isMaster={tier?.is_master ?? false} memberName={profile?.full_name ?? undefined} routeBase={routeBase} />;
}

export default async function EventsPage() {
  return renderEventsPage();
}
