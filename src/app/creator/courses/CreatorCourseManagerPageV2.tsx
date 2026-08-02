import { CreatorCourseManagerV2, type ManagedCourse } from "@/components/creator/CreatorCourseManagerV2";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorCourseManagerPageV2() {
  const { supabase, user } = await requireInfluencerWorkspace("/creator/courses");
  const [profile, tier, courseRows, videoRows, assetRows] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("member_tiers").select("current_tier,is_master").eq("user_id", user.id).maybeSingle(),
    supabase.from("courses").select("id,title,description,completion_tier,status,is_finished,finished_at").order("created_at"),
    supabase.from("course_videos").select("id,course_id,title,description,duration_seconds,sort_order,is_optional,release_at").order("sort_order"),
    supabase.from("course_video_assets").select("video_id"),
  ]);
  if ([profile, tier, courseRows, videoRows, assetRows].some((result) => result.error)) throw new Error("Unable to load creator courses.");
  const assetVideoIds = new Set((assetRows.data ?? []).map((asset) => asset.video_id));
  const courses: ManagedCourse[] = (courseRows.data ?? []).map((course) => ({
    ...course,
    videos: (videoRows.data ?? []).filter((video) => video.course_id === course.id).map((video) => ({ ...video, has_secure_asset: assetVideoIds.has(video.id) })),
  }));
  return <CreatorCourseManagerV2 courses={courses} memberName={profile.data?.full_name?.trim() || "Creator"} currentTier={tier.data?.current_tier ?? 1} isMaster={tier.data?.is_master ?? false} />;
}
