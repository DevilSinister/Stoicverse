import { EventsView, type EventRecord } from "@/components/events/EventsView";
import { requireActiveMembership } from "@/lib/supabase/access";

export default async function EventsPage() {
  const { supabase, user } = await requireActiveMembership("/events");
  const [{ data: tier, error: tierError }, { data: profile, error: profileError }, { data: events, error: eventsError }, { data: enrollments, error: enrollmentError }] = await Promise.all([
    supabase
    .from("member_tiers")
    .select("is_master, current_tier")
    .eq("user_id", user.id)
    .maybeSingle(),
    supabase.from("profiles").select("full_name, platform_role").eq("id", user.id).maybeSingle(),
    // This also remains compatible with older event schemas: absent optional
    // columns are simply not returned by Postgres when selecting all fields.
    supabase.from("events").select("*").neq("status", "cancelled").order("starts_at", { ascending: true }),
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
    .map((event) => ({
      id: event.id, title: event.title, description: event.description, hostName: event.host_name ?? "Stoicverse Team",
      startsAt: event.starts_at, endsAt: event.ends_at, zoomUrl: event.zoom_url, minTier: event.min_tier,
      status: event.status, enrolled: enrolledIds.has(event.id),
    }));

  return <EventsView events={visibleEvents} enrollmentAvailable={!enrollmentError} currentTier={tier?.current_tier ?? 1} isMaster={tier?.is_master ?? false} memberName={profile?.full_name ?? undefined} canManage={["moderator", "influencer", "super_admin"].includes(profile?.platform_role ?? "")} />;
}
