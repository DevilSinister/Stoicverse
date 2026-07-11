"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string; success?: true };

const asTrimmedString = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

export async function enrollInEvent(eventId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Sign in to enroll in this event." };

  const { error } = await supabase
    .from("event_enrollments")
    .insert({ event_id: eventId, user_id: user.id });

  if (error && error.code !== "23505") {
    return { error: "Unable to enroll. Check that your tier has access and try again." };
  }

  revalidatePath("/events");
  return { success: true };
}

export async function createEvent(formData: FormData): Promise<ActionResult> {
  const title = asTrimmedString(formData.get("title"));
  const description = asTrimmedString(formData.get("description"));
  const hostName = asTrimmedString(formData.get("hostName")) || "Stoicverse Team";
  const startsAt = asTrimmedString(formData.get("startsAt"));
  const endsAt = asTrimmedString(formData.get("endsAt"));
  const zoomUrl = asTrimmedString(formData.get("zoomUrl"));
  const minTier = Number(formData.get("minTier"));

  if (!title || !startsAt || !Number.isInteger(minTier) || minTier < 1 || minTier > 5) {
    return { error: "Add a title, start time, and valid minimum tier." };
  }
  if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
    return { error: "The event end time must be after its start time." };
  }
  if (zoomUrl) {
    try { new URL(zoomUrl); } catch { return { error: "Enter a valid Zoom URL, or leave it blank for now." }; }
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to create an event." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("platform_role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !["moderator", "influencer", "super_admin"].includes(profile.platform_role)) {
    return { error: "Only community staff can create events." };
  }

  let { data: channel } = await supabase
    .from("channels")
    .select("id")
    .eq("type", "events")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!channel) {
    const { data, error } = await supabase
      .from("channels")
      .insert({ name: "events", type: "events", description: "Live Stoicverse sessions", created_by: user.id })
      .select("id")
      .single();
    if (error) return { error: "Unable to prepare the events channel." };
    channel = data;
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      channel_id: channel.id,
      created_by: user.id,
      title,
      description: description || null,
      host_name: hostName,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      zoom_url: zoomUrl || null,
      min_tier: minTier,
    })
    .select("id")
    .single();

  if (eventError || !event) return { error: "Unable to create the event." };

  const { error: postError } = await supabase.from("posts").insert({
    channel_id: channel.id,
    author_id: user.id,
    post_type: "event",
    body: `${title} · ${new Date(startsAt).toLocaleString()}`,
  });
  if (postError) return { error: "Event created, but its channel announcement could not be posted." };

  revalidatePath("/events");
  revalidatePath("/community");
  return { success: true };
}

export async function updateEventZoomUrl(eventId: string, zoomUrl: string): Promise<ActionResult> {
  if (!eventId || !zoomUrl.trim()) return { error: "Enter the meeting URL before publishing it." };
  try { new URL(zoomUrl); } catch { return { error: "Enter a valid Zoom URL." }; }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to update this event." };

  const { data: profile } = await supabase.from("profiles").select("platform_role").eq("id", user.id).maybeSingle();
  if (!profile || !["moderator", "influencer", "super_admin"].includes(profile.platform_role)) {
    return { error: "Only community staff can update event rooms." };
  }

  const { error } = await supabase.from("events").update({ zoom_url: zoomUrl.trim() }).eq("id", eventId);
  if (error) return { error: "Unable to publish the meeting link." };

  revalidatePath("/events");
  return { success: true };
}
