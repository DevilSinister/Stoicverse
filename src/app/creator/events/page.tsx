import { CreatorEventsView } from "@/components/creator/CreatorEventsView";
import type { EventRecord } from "@/components/events/EventsView";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorEventsPage() {
  const { supabase, user } = await requireInfluencerWorkspace("/creator/events");
  const [{ data: tier, error: tierError }, { data: profile, error: profileError }, { data: events, error: eventsError }, { data: enrollments, error: enrollmentError }] = await Promise.all([
    supabase.from("member_tiers").select("is_master, current_tier").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("events").select("*").neq("status", "cancelled").order("starts_at", { ascending: true }),
    supabase.from("event_enrollments").select("event_id").eq("user_id", user.id),
  ]);

  if (tierError || profileError || eventsError) {
    throw new Error("Unable to load creator events.");
  }

  const enrolledIds = new Set(enrollments?.map((enrollment) => enrollment.event_id) ?? []);
  const visibleEvents: EventRecord[] = (events ?? []).map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    hostName: event.host_name ?? "Stoicverse Team",
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    minTier: event.min_tier,
    status: event.status,
    enrolled: enrolledIds.has(event.id),
  }));

  return <CreatorEventsView events={visibleEvents} enrollmentAvailable={!enrollmentError} currentTier={tier?.current_tier ?? 1} isMaster={tier?.is_master ?? false} memberName={profile?.full_name ?? undefined} />;
}
