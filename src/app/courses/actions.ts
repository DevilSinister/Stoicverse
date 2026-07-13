"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireInfluencer } from "@/lib/supabase/access";

type ActionResult = { error?: string; success?: true };

const value = (formData: FormData, name: string) => {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry.trim() : "";
};

const isUuid = (candidate: string) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(candidate);
const isDriveFileId = (candidate: string) => /^[A-Za-z0-9_-]{10,200}$/.test(candidate);

/** Create curriculum from the normal learning screen; every request re-checks the influencer role. */
export async function addLesson(formData: FormData): Promise<ActionResult> {
  const title = value(formData, "title");
  const tierId = value(formData, "tierId");
  const videoFileId = value(formData, "videoFileId");
  const durationSeconds = Number(value(formData, "durationSeconds"));
  const sortOrder = Number(value(formData, "sortOrder"));
  const status = value(formData, "status");

  if (!title || !isUuid(tierId) || !isDriveFileId(videoFileId) || !Number.isInteger(durationSeconds) || durationSeconds < 0 || !Number.isInteger(sortOrder) || sortOrder < 0 || !["draft", "published"].includes(status)) {
    return { error: "Add a title, tier, Google Drive file ID, duration, and valid lesson status." };
  }

  const { supabase, user } = await requireInfluencer();
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .insert({
      tier_id: tierId,
      title,
      description: value(formData, "description") || null,
      duration_seconds: durationSeconds,
      completion_threshold: 85,
      sort_order: sortOrder,
      status,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (lessonError || !lesson) return { error: lessonError?.message ?? "Unable to create the lesson." };

  const { error: assetError } = await createAdminClient()
    .from("lesson_assets")
    .insert({ lesson_id: lesson.id, video_file_id: videoFileId });

  if (assetError) {
    await createAdminClient().from("lessons").delete().eq("id", lesson.id);
    return { error: "The secure video asset could not be saved, so the lesson was not created." };
  }

  revalidatePath("/courses");
  revalidatePath("/dashboard");
  revalidatePath("/creator/courses");
  revalidatePath("/creator/dashboard");
  return { success: true };
}
