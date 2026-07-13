"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireInfluencer } from "@/lib/supabase/access";

const text = (value: FormDataEntryValue | null) => typeof value === "string" ? value.trim() : "";
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
const tier = (value: string) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 5 ? Number(value) : null;
const order = (value: string) => Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const invalidate = () => ["/creator", "/community", "/courses", "/events", "/master", "/dashboard"].forEach((path) => revalidatePath(path));

export async function saveChannel(formData: FormData) {
  const { supabase, user } = await requireInfluencer();
  const id = text(formData.get("id"));
  const name = text(formData.get("name")).toLowerCase().replace(/\s+/g, "-");
  const minTier = tier(text(formData.get("minTier")));
  const sortOrder = order(text(formData.get("sortOrder")));
  const type = text(formData.get("type"));
  if (!name || !minTier || sortOrder === null || !["text", "announcements", "events", "master"].includes(type)) throw new Error("Enter a valid channel.");
  const values = { name, type, description: text(formData.get("description")) || null, min_tier: minTier, sort_order: sortOrder, is_active: formData.get("isActive") === "on" };
  const result = id && uuid(id) ? await supabase.from("channels").update(values).eq("id", id) : await supabase.from("channels").insert({ ...values, created_by: user.id });
  if (result.error) throw new Error(result.error.message);
  invalidate();
}

export async function deleteChannel(formData: FormData) {
  const { supabase } = await requireInfluencer();
  const id = text(formData.get("id"));
  if (!uuid(id)) throw new Error("Invalid channel.");
  const { error } = await supabase.from("channels").delete().eq("id", id);
  if (error) throw new Error(error.message);
  invalidate();
}

export async function saveLesson(formData: FormData) {
  const { supabase, user } = await requireInfluencer();
  const id = text(formData.get("id"));
  const tierId = text(formData.get("tierId"));
  const title = text(formData.get("title"));
  const fileId = text(formData.get("videoFileId"));
  const sortOrder = order(text(formData.get("sortOrder")));
  const duration = Number(text(formData.get("durationSeconds")));
  const status = text(formData.get("status"));
  if (!uuid(tierId) || !title || (!id && !/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) || (fileId && !/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) || sortOrder === null || !Number.isInteger(duration) || duration < 0 || !["draft", "published", "archived"].includes(status)) throw new Error("Enter valid lesson details and a Google Drive file ID for new lessons.");
  const values = { tier_id: tierId, title, description: text(formData.get("description")) || null, duration_seconds: duration, completion_threshold: 85, sort_order: sortOrder, status, release_at: text(formData.get("releaseAt")) || null };
  const saved = id && uuid(id)
    ? await supabase.from("lessons").update(values).eq("id", id).select("id").single()
    : await supabase.from("lessons").insert({ ...values, created_by: user.id }).select("id").single();
  if (saved.error || !saved.data) throw new Error(saved.error?.message ?? "Unable to save lesson.");
  if (fileId) {
    const { error } = await createAdminClient().from("lesson_assets").upsert({ lesson_id: saved.data.id, video_file_id: fileId }, { onConflict: "lesson_id" });
    if (error) throw new Error("Lesson saved, but its secure video asset could not be stored.");
  }
  invalidate();
}

export async function deleteLesson(formData: FormData) {
  const { supabase } = await requireInfluencer();
  const id = text(formData.get("id"));
  if (!uuid(id)) throw new Error("Invalid lesson.");
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  if (error) throw new Error(error.message);
  invalidate();
}

export async function setModerator(formData: FormData) {
  const { supabase } = await requireInfluencer();
  const id = text(formData.get("userId"));
  const role = text(formData.get("role"));
  if (!uuid(id) || !["member", "moderator"].includes(role)) throw new Error("Invalid moderator change.");
  const { error } = await supabase.from("profiles").update({ platform_role: role }).eq("id", id).in("platform_role", ["member", "moderator"]);
  if (error) throw new Error(error.message);
  invalidate();
}

export async function updateReview(formData: FormData) {
  const { supabase, user } = await requireInfluencer();
  const id = text(formData.get("id"));
  const status = text(formData.get("status"));
  if (!uuid(id) || !["under_review", "accepted", "rejected", "scheduled", "completed", "approved_for_team"].includes(status)) throw new Error("Invalid review update.");
  const call = text(formData.get("callScheduledAt"));
  const { error } = await supabase.from("review_applications").update({ status, decision_notes: text(formData.get("decisionNotes")) || null, call_scheduled_at: call || null, zoom_url: text(formData.get("zoomUrl")) || null, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  invalidate();
}

export async function saveEvent(formData: FormData) {
  const { supabase, user } = await requireInfluencer();
  const id = text(formData.get("id"));
  const eventChannelId = text(formData.get("channelId"));
  const minTier = tier(text(formData.get("minTier")));
  const startsAt = text(formData.get("startsAt"));
  const endsAt = text(formData.get("endsAt"));
  const status = text(formData.get("status"));
  const zoom = text(formData.get("zoomUrl"));
  if (!uuid(eventChannelId) || !text(formData.get("title")) || !minTier || !startsAt || !["upcoming", "live", "completed", "cancelled"].includes(status) || (endsAt && new Date(endsAt) <= new Date(startsAt))) throw new Error("Enter valid event details.");
  if (zoom && !/^https:\/\/(?:[a-z0-9-]+\.)?zoom\.us\//i.test(zoom)) throw new Error("Use an HTTPS Zoom URL.");
  const values = { channel_id: eventChannelId, title: text(formData.get("title")), description: text(formData.get("description")) || null, starts_at: new Date(startsAt).toISOString(), ends_at: endsAt ? new Date(endsAt).toISOString() : null, min_tier: minTier, status };
  const saved = id && uuid(id) ? await supabase.from("events").update(values).eq("id", id).select("id").single() : await supabase.from("events").insert({ ...values, created_by: user.id }).select("id").single();
  if (saved.error || !saved.data) throw new Error(saved.error?.message ?? "Unable to save event.");
  if (zoom) {
    const { error } = await createAdminClient().from("event_rooms").upsert({ event_id: saved.data.id, zoom_url: zoom }, { onConflict: "event_id" });
    if (error) throw new Error("Event saved, but its secure room could not be stored.");
  }
  invalidate();
}
