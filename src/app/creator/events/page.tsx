import { CreatorEventsView, type CreatorEventRecord } from "@/components/creator/CreatorEventsView";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorEventsPage() {
  const { supabase, user } = await requireInfluencerWorkspace("/creator/events");
  const [tierResult, profileResult, eventsResult, enrollmentResult, membershipsResult, tiersResult, roomsResult] = await Promise.all([
    supabase.from("member_tiers").select("is_master, current_tier").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("events").select("*").order("starts_at", { ascending: true }),
    supabase.from("event_enrollments").select("event_id, user_id, enrolled_at, profiles(full_name)").order("enrolled_at", { ascending: true }),
    supabase.from("memberships").select("user_id").eq("status", "active"),
    supabase.from("member_tiers").select("user_id, current_tier, is_master"),
    supabase.rpc("get_creator_event_room_status"),
  ]);
  if ([tierResult, profileResult, eventsResult, enrollmentResult, membershipsResult, tiersResult].some((result) => result.error)) throw new Error("Unable to load creator events.");

  const memberTiers = new Map((tiersResult.data ?? []).map((tier) => [tier.user_id, tier]));
  const attendeesByEvent = new Map<string, CreatorEventRecord["attendees"]>();
  for (const enrollment of enrollmentResult.data ?? []) {
    const row = enrollment as typeof enrollment & { profiles?: { full_name?: string | null } | null };
    const attendees = attendeesByEvent.get(row.event_id) ?? [];
    attendees.push({ id: row.user_id, name: row.profiles?.full_name?.trim() || "Member", enrolledAt: row.enrolled_at });
    attendeesByEvent.set(row.event_id, attendees);
  }
  const roomIds = new Set((roomsResult.data ?? []) as string[]);
  const events: CreatorEventRecord[] = (eventsResult.data ?? []).map((event) => {
    const attendees = attendeesByEvent.get(event.id) ?? [];
    const qualifiedAudienceCount = (membershipsResult.data ?? []).filter((member) => {
      const tier = memberTiers.get(member.user_id);
      return tier?.is_master || (tier?.current_tier ?? 0) >= event.min_tier;
    }).length;
    return {
      id: event.id, title: event.title, description: event.description, hostName: event.host_name ?? "Stoicverse Team", startsAt: event.starts_at, endsAt: event.ends_at,
      minTier: event.min_tier, status: event.status, enrolled: attendees.some((attendee) => attendee.id === user.id), publishAt: event.publish_at ?? null,
      publishedAt: event.published_at ?? null, cancelledAt: event.cancelled_at ?? null, cancellationReason: event.cancellation_reason ?? null,
      enrollmentCount: attendees.length, qualifiedAudienceCount, roomPublished: roomIds.has(event.id), attendees,
    };
  });
  return <CreatorEventsView events={events} enrollmentAvailable={!enrollmentResult.error} currentTier={tierResult.data?.current_tier ?? 1} isMaster={tierResult.data?.is_master ?? false} memberName={profileResult.data?.full_name ?? undefined} />;
}
