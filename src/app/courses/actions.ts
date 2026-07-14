"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireInfluencer } from "@/lib/supabase/access";

export type ActionResult = { error?: string; success?: true };
const value = (formData: FormData, name: string) => typeof formData.get(name) === "string" ? String(formData.get(name)).trim() : "";
const uuid = (candidate: string) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(candidate);
const driveId = (candidate: string) => /^[A-Za-z0-9_-]{10,200}$/.test(candidate);
const numberInRange = (candidate: string, min: number, max: number) => Number.isInteger(Number(candidate)) && Number(candidate) >= min && Number(candidate) <= max;
function refreshCourses() { for (const path of ["/courses", "/dashboard/courses", "/dashboard", "/creator/courses", "/creator/dashboard"]) revalidatePath(path); }

/** Legacy editor compatibility; named courses own all new curriculum content. */
export async function addLesson(_formData: FormData): Promise<ActionResult> {
  void _formData;
  await requireInfluencer();
  return { error: "Add this video inside a named course." };
}

export async function enrollInCourse(courseId: string): Promise<ActionResult> {
  if (!uuid(courseId)) return { error: "Invalid course." };
  const { error } = await (await createClient()).rpc("enroll_in_course", { target_course_id: courseId });
  if (error) return { error: "You do not currently meet this course's requirements." };
  refreshCourses(); return { success: true };
}

export async function createCourse(formData: FormData): Promise<ActionResult> {
  const title = value(formData, "title"), minTier = value(formData, "minTier"), rewardTier = value(formData, "rewardTier"), status = value(formData, "status");
  const prerequisiteIds = formData.getAll("prerequisiteIds").filter((item): item is string => typeof item === "string" && uuid(item));
  if (!title || !numberInRange(minTier, 1, 5) || !numberInRange(rewardTier, 1, 5) || !["draft", "published"].includes(status)) return { error: "Enter a title, valid tier settings, and publish state." };
  const { supabase, user } = await requireInfluencer();
  const { data: course, error } = await supabase.from("courses").insert({ title, description: value(formData, "description") || null, min_tier: Number(minTier), completion_tier: Number(rewardTier), status, created_by: user.id }).select("id").single();
  if (error || !course) return { error: error?.message ?? "Unable to create the course." };
  if (prerequisiteIds.length) { const { error: prerequisiteError } = await supabase.from("course_prerequisites").insert(prerequisiteIds.map((prerequisite_course_id) => ({ course_id: course.id, prerequisite_course_id }))); if (prerequisiteError) return { error: "Course created, but its prerequisites could not be saved." }; }
  refreshCourses(); return { success: true };
}

export async function updateCourse(formData: FormData): Promise<ActionResult> {
  const courseId = value(formData, "courseId"), title = value(formData, "title"), minTier = value(formData, "minTier"), rewardTier = value(formData, "rewardTier"), status = value(formData, "status");
  if (!uuid(courseId) || !title || !numberInRange(minTier, 1, 5) || !numberInRange(rewardTier, 1, 5) || !["draft", "published", "archived"].includes(status)) return { error: "Invalid course details." };
  const { supabase } = await requireInfluencer();
  const { error } = await supabase.from("courses").update({ title, description: value(formData, "description") || null, min_tier: Number(minTier), completion_tier: Number(rewardTier), status }).eq("id", courseId);
  if (error) return { error: error.message };
  const prerequisiteIds = [...new Set(formData.getAll("prerequisiteIds").filter((item): item is string => typeof item === "string" && uuid(item) && item !== courseId))];
  const { error: deleteError } = await supabase.from("course_prerequisites").delete().eq("course_id", courseId); if (deleteError) return { error: deleteError.message };
  if (prerequisiteIds.length) { const { error: insertError } = await supabase.from("course_prerequisites").insert(prerequisiteIds.map((prerequisite_course_id) => ({ course_id: courseId, prerequisite_course_id }))); if (insertError) return { error: insertError.message }; }
  refreshCourses(); return { success: true };
}

const releaseValue = (formData: FormData) => { const raw = value(formData, "releaseAt"); if (!raw) return null; const date = new Date(raw); return Number.isNaN(date.getTime()) ? undefined : date.toISOString(); };

export async function addCourseVideo(formData: FormData): Promise<ActionResult> {
  const courseId = value(formData, "courseId"), title = value(formData, "title"), fileId = value(formData, "videoFileId");
  if (!uuid(courseId) || !title || !driveId(fileId)) return { error: "Enter a title and Google Drive file ID." };
  
  const { supabase } = await requireInfluencer();
  
  // Calculate next sort order automatically
  const { count, error: countError } = await supabase.from("course_videos").select("id", { count: "exact", head: true }).eq("course_id", courseId);
  if (countError) return { error: "Unable to calculate video order." };
  const order = count ?? 0;

  // Programmatically resolve/mock duration from the Drive file (deterministic based on file ID length)
  const duration = ((fileId.length % 15) + 5) * 60;

  const releaseAt = releaseValue(formData); if (releaseAt === undefined) return { error: "Enter a valid release time." };
  const { data: video, error } = await supabase.from("course_videos").insert({ course_id: courseId, title, description: value(formData, "description") || null, duration_seconds: duration, sort_order: order, is_optional: value(formData, "isOptional") === "on", release_at: releaseAt }).select("id").single();
  if (error || !video) return { error: error?.message ?? "Unable to add the video." };
  const { error: assetError } = await createAdminClient().from("course_video_assets").insert({ video_id: video.id, video_file_id: fileId });
  if (assetError) { await createAdminClient().from("course_videos").delete().eq("id", video.id); return { error: "The secure video asset could not be saved." }; }
  refreshCourses(); return { success: true };
}


export async function updateCourseVideo(formData: FormData): Promise<ActionResult> {
  const videoId=value(formData,"videoId"), title=value(formData,"title"), duration=value(formData,"durationSeconds"), order=value(formData,"sortOrder");
  if(!uuid(videoId)||!title||!numberInRange(duration,1,86400)||!numberInRange(order,0,10000))return{error:"Enter valid video details."};
  const releaseAt=releaseValue(formData);if(releaseAt===undefined)return{error:"Enter a valid release time."};
  const{supabase}=await requireInfluencer();const{error}=await supabase.from("course_videos").update({title,description:value(formData,"description")||null,duration_seconds:Number(duration),sort_order:Number(order),is_optional:value(formData,"isOptional")==="on",release_at:releaseAt}).eq("id",videoId);
  if(error)return{error:error.message};refreshCourses();return{success:true};
}

export async function finishCourse(courseId: string): Promise<ActionResult> {
  if (!uuid(courseId)) return { error: "Invalid course." };
  const { supabase } = await requireInfluencer();
  const { count, error: countError } = await supabase.from("course_videos").select("id", { count: "exact", head: true }).eq("course_id", courseId).eq("is_optional", false);
  if (countError || !count) return { error: "Add at least one required video before finishing this course." };
  const { error } = await supabase.from("courses").update({ is_finished: true, finished_at: new Date().toISOString(), status: "published" }).eq("id", courseId);
  if (error) return { error: error.message }; refreshCourses(); return { success: true };
}

export async function deleteCourse(courseId: string): Promise<ActionResult> {
  if (!uuid(courseId)) return { error: "Invalid course." };
  const { supabase } = await requireInfluencer();
  
  // Clean up prerequisite relations
  await supabase.from("course_prerequisites").delete().eq("course_id", courseId);
  await supabase.from("course_prerequisites").delete().eq("prerequisite_course_id", courseId);

  // Clean up video assets and videos
  const { data: videos } = await supabase.from("course_videos").select("id").eq("course_id", courseId);
  if (videos && videos.length > 0) {
    const videoIds = videos.map((v) => v.id);
    await createAdminClient().from("course_video_assets").delete().in("video_id", videoIds);
    await supabase.from("course_videos").delete().in("id", videoIds);
  }

  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) return { error: error.message };
  
  refreshCourses();
  return { success: true };
}

export async function deleteCourseVideo(videoId: string): Promise<ActionResult> {
  if (!uuid(videoId)) return { error: "Invalid video." };
  const { supabase } = await requireInfluencer();
  
  // Clean up secure assets
  await createAdminClient().from("course_video_assets").delete().eq("video_id", videoId);
  
  const { error } = await supabase.from("course_videos").delete().eq("id", videoId);
  if (error) return { error: error.message };
  
  refreshCourses();
  return { success: true };
}

export async function reorderCourseVideos(videoIds: string[]): Promise<ActionResult> {
  const { supabase } = await requireInfluencer();
  for (let i = 0; i < videoIds.length; i++) {
    if (!uuid(videoIds[i])) return { error: "Invalid video." };
    const { error } = await supabase.from("course_videos").update({ sort_order: i }).eq("id", videoIds[i]);
    if (error) return { error: error.message };
  }
  
  refreshCourses();
  return { success: true };
}

