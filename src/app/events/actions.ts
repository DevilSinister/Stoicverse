"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireInfluencer } from "@/lib/supabase/access";

export type ActionResult = { error?: string; success?: true; eventId?: string };

const value = (formData: FormData, name: string) => {
  const input = formData.get(name);
  return typeof input === "string" ? input.trim() : "";
};

function isoDate(input: string) {
  const date = new Date(input);
  return input && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function isApprovedZoomUrl(input: string) {
  try {
    const url = new URL(input);
    return url.protocol === "https:" && (url.hostname === "zoom.us" || url.hostname.endsWith(".zoom.us") || url.hostname === "zoom.com" || url.hostname.endsWith(".zoom.com"));
  } catch { return false; }
}

function revalidateEvents() {
  for (const path of ["/dashboard/events", "/creator/events", "/creator/dashboard", "/dashboard/community", "/creator/channels"]) revalidatePath(path);
}

export async function enrollInEvent(eventId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to enroll in this event." };
  const { error } = await supabase.from("event_enrollments").insert({ event_id: eventId, user_id: user.id });
  if (error && error.code !== "23505") return { error: "Unable to enroll. Check that your tier has access and try again." };
  revalidateEvents();
  return { success: true, eventId };
}

export async function saveCreatorEvent(formData: FormData, eventId?: string, publishNow = false): Promise<ActionResult> {
  const title = value(formData, "title");
  const startsAt = isoDate(value(formData, "startsAt"));
  const endsAt = isoDate(value(formData, "endsAt"));
  const publishAtRaw = value(formData, "publishAt");
  const publishAt = publishAtRaw ? isoDate(publishAtRaw) : null;
  const minTier = Number(value(formData, "minTier"));
  const zoomUrl = value(formData, "zoomUrl");
  if (!title || title.length > 160) return { error: "Enter an event title up to 160 characters." };
  if (!startsAt || !endsAt) return { error: "Enter valid start and end times." };
  if (!eventId && new Date(startsAt) <= new Date()) return { error: "Use a future start time." };
  if (new Date(endsAt) <= new Date(startsAt)) return { error: "End time must be after start time." };
  if (publishAtRaw && !publishAt) return { error: "Enter a valid intended publish time." };
  if (!Number.isInteger(minTier) || minTier < 1 || minTier > 5) return { error: "Choose a valid access level." };
  if (zoomUrl && !isApprovedZoomUrl(zoomUrl)) return { error: "Use an HTTPS Zoom meeting URL, or leave it blank for now." };
  const access = await requireInfluencer().catch(() => null);
  if (!access) return { error: "Creator access is required to manage events." };
  const { data, error } = await access.supabase.rpc("save_creator_event", {
    target_event_id: eventId ?? null, event_title: title, event_description: value(formData, "description"), event_host_name: value(formData, "hostName"),
    event_starts_at: startsAt, event_ends_at: endsAt, event_min_tier: minTier, event_zoom_url: zoomUrl || null,
    intended_publish_at: publishAt, publish_now: publishNow,
  });
  if (error || !data) return { error: error?.message ?? "Unable to save the event." };
  revalidateEvents();
  return { success: true, eventId: data };
}

export async function publishEvent(eventId: string, formData: FormData): Promise<ActionResult> { return saveCreatorEvent(formData, eventId, true); }

export async function updateEventZoomUrl(eventId: string, zoomUrl: string): Promise<ActionResult> {
  if (!zoomUrl.trim() || !isApprovedZoomUrl(zoomUrl.trim())) return { error: "Use an HTTPS Zoom meeting URL." };
  const access = await requireInfluencer().catch(() => null);
  if (!access) return { error: "Creator access is required to update event rooms." };
  const { error } = await access.supabase.rpc("publish_creator_event_room", { target_event_id: eventId, event_zoom_url: zoomUrl.trim() });
  if (error) return { error: error.message || "Unable to publish the meeting link." };
  revalidateEvents();
  return { success: true, eventId };
}

export async function cancelEvent(eventId: string, reason?: string): Promise<ActionResult> {
  const access = await requireInfluencer().catch(() => null);
  if (!access) return { error: "Creator access is required to cancel events." };
  const finalReason = reason?.trim() || "Event cancelled by creator.";
  const { error } = await access.supabase.rpc("cancel_creator_event", { target_event_id: eventId, reason: finalReason });
  if (error) return { error: error.message || "Unable to cancel the event." };
  revalidateEvents();
  return { success: true, eventId };
}
