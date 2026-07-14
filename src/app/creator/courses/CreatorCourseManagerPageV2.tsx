import { CreatorCourseManagerV2, type ManagedCourse } from "@/components/creator/CreatorCourseManagerV2";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorCourseManagerPageV2() {
  const { supabase, user } = await requireInfluencerWorkspace("/creator/courses");
  const [profile, tier, courseRows, prerequisiteRows, videoRows] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("member_tiers").select("current_tier,is_master").eq("user_id", user.id).maybeSingle(),
    supabase.from("courses").select("id,title,description,min_tier,completion_tier,status,is_finished,finished_at").order("min_tier"),
    supabase.from("course_prerequisites").select("course_id,prerequisite_course_id"),
    supabase.from("course_videos").select("id,course_id,title,description,duration_seconds,sort_order,is_optional,release_at").order("sort_order"),
  ]);
  if ([profile, tier, courseRows, prerequisiteRows, videoRows].some((result) => result.error)) throw new Error("Unable to load creator courses.");
  const courses: ManagedCourse[] = (courseRows.data ?? []).map((course) => ({
    ...course,
    prerequisiteIds: (prerequisiteRows.data ?? []).filter((item) => item.course_id === course.id).map((item) => item.prerequisite_course_id),
    videos: (videoRows.data ?? []).filter((video) => video.course_id === course.id),
  }));
  return <CreatorCourseManagerV2 courses={courses} memberName={profile.data?.full_name?.trim() || "Creator"} currentTier={tier.data?.current_tier ?? 1} isMaster={tier.data?.is_master ?? false} />;
}
