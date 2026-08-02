import { CourseCatalog, type CourseCard } from "@/components/courses/CourseCatalog";
import { requireActiveMembership } from "@/lib/supabase/access";
import { createAdminClient } from "@/lib/supabase/admin";

interface CourseVideo {
  id: string;
  course_id: string;
  title: string;
  duration_seconds: number;
  is_optional: boolean;
}

interface CourseEnrollment {
  course_id: string;
}

export async function renderCoursesPage({nextPath="/courses",routeBase=""}:{nextPath?:string;routeBase?:string}={}){
  const { supabase, user } = await requireActiveMembership(nextPath);
  
  const [profileResult, tierResult, coursesResult, enrollmentsResult, videosResult, progressResult] = await Promise.all([
    supabase.from("profiles").select("full_name,platform_role").eq("id",user.id).maybeSingle(),
    supabase.from("member_tiers").select("current_tier,is_master").eq("user_id",user.id).maybeSingle(),
    supabase.from("courses").select("id,title,description,completion_tier,is_finished,status,created_at").eq("status","published").order("created_at"),
    supabase.from("course_enrollments").select("course_id,completion_current,first_completed_at").eq("user_id",user.id),
    supabase.from("course_videos").select("id,course_id,title,duration_seconds,is_optional").order("sort_order"),
    supabase.from("course_video_progress").select("video_id,is_completed,completion_percentage").eq("user_id", user.id)
  ]);
  
  if ([profileResult, tierResult, coursesResult, enrollmentsResult, videosResult, progressResult].some(result => result.error)) {
    throw new Error("Unable to load courses.");
  }
  
  // Use admin client to fetch global data if service role key is available
  const videosData: CourseVideo[] = (videosResult.data as CourseVideo[] | null) ?? [];
  let enrollmentsCountData: CourseEnrollment[] = [];

  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (hasServiceKey) {
    try {
      const admin = createAdminClient();
      const enrollmentsCountResult = await admin.from("course_enrollments").select("course_id");
      if (!enrollmentsCountResult.error) {
        enrollmentsCountData = (enrollmentsCountResult.data as unknown as CourseEnrollment[]) ?? [];
      }
    } catch (e) {
      console.warn("Failed to fetch admin course metadata, falling back to local user data.", e);
    }
  }

  // Fetch course video progress for user
  const progressMap = new Map((progressResult.data ?? []).map(p => [p.video_id, p]));

  // Map videos by course
  const videosByCourse = new Map<string, { id: string; title: string; durationSeconds: number; isOptional: boolean }[]>();
  videosData.forEach(v => {
    if (!videosByCourse.has(v.course_id)) {
      videosByCourse.set(v.course_id, []);
    }
    videosByCourse.get(v.course_id)!.push({
      id: v.id,
      title: v.title,
      durationSeconds: v.duration_seconds,
      isOptional: v.is_optional
    });
  });

  // Map enrollment counts by course
  const enrollmentCounts = new Map<string, number>();
  enrollmentsCountData.forEach(e => {
    enrollmentCounts.set(e.course_id, (enrollmentCounts.get(e.course_id) ?? 0) + 1);
  });

  const completed = new Set((enrollmentsResult.data ?? []).filter(item => item.completion_current).map(item => item.course_id));
  const enrolled = new Set((enrollmentsResult.data ?? []).map(item => item.course_id));
  const currentTier = tierResult.data?.current_tier ?? 1;
  const cards: CourseCard[] = (coursesResult.data ?? []).map(course => {
    // Calculate progress percentage
    const courseVideos = videosByCourse.get(course.id) ?? [];
    const requiredVideos = courseVideos.filter(v => !v.isOptional);
    const completedRequired = requiredVideos.filter(v => progressMap.get(v.id)?.is_completed).length;
    const progressPercent = requiredVideos.length > 0 ? Math.round((completedRequired / requiredVideos.length) * 100) : 0;

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      rewardTier: course.completion_tier,
      isFinished: course.is_finished,
      isCompleted: completed.has(course.id),
      isEnrolled: enrolled.has(course.id),
      enrollmentCount: enrollmentCounts.get(course.id) ?? 0,
      videos: courseVideos,
      progressPercent: completed.has(course.id) ? 100 : progressPercent
    };
  });

  return (
    <CourseCatalog
      courses={cards}
      memberName={profileResult.data?.full_name?.trim() || "Practitioner"}
      platformRole={profileResult.data?.platform_role ?? "member"}
      currentTier={currentTier}
      isMaster={tierResult.data?.is_master ?? false}
      routeBase={routeBase}
    />
  );
}

export default async function CoursesPage() {
  return renderCoursesPage();
}
