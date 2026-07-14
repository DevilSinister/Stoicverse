import { DashboardView, type DashboardData } from "@/components/dashboard/DashboardView";
import { requireActiveMembership, requireInfluencerWorkspace } from "@/lib/supabase/access";

type DashboardPageOptions = {
  nextPath?: string;
  routeBase?: string;
  creatorWorkspace?: boolean;
};

export async function renderDashboardPage({ nextPath = "/dashboard", routeBase = "", creatorWorkspace = false }: DashboardPageOptions = {}) {
  const { supabase, user } = creatorWorkspace
    ? await requireInfluencerWorkspace(nextPath)
    : await requireActiveMembership(nextPath);

  const now = new Date().toISOString();
  const [profileResult, tierResult, enrollmentResult, coursesResult, courseVideosResult, videoProgressResult, eventsResult, notificationsResult] = await Promise.all([
    supabase.from("profiles").select("full_name, platform_role").eq("id", user.id).maybeSingle(),
    supabase.from("member_tiers").select("current_tier, is_master").eq("user_id", user.id).maybeSingle(),
    supabase.from("course_enrollments").select("course_id, completion_current, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("courses").select("id, title, description, min_tier").eq("status", "published").order("min_tier"),
    supabase.from("course_videos").select("id,course_id,duration_seconds,is_optional,sort_order").order("sort_order"),
    supabase.from("course_video_progress").select("video_id,completion_percentage,is_completed").eq("user_id", user.id),
    supabase.from("events").select("id, title, description, starts_at, min_tier, status").in("status", ["upcoming", "live"]).gte("starts_at", now).order("starts_at").limit(1),
    supabase.from("notifications").select("id, type, title, body, action_url, is_read, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
  ]);

  const results = [profileResult, tierResult, enrollmentResult, coursesResult, courseVideosResult, videoProgressResult, eventsResult, notificationsResult];
  if (results.some((result) => result.error)) {
    throw new Error("Unable to load your dashboard data.");
  }

  const profile = profileResult.data;
  const tier = tierResult.data;
  const enrollments = enrollmentResult.data ?? [];
  const courses = coursesResult.data ?? [];
  const videos = courseVideosResult.data ?? [];
  const videoProgress = new Map((videoProgressResult.data ?? []).map((item) => [item.video_id, item]));
  const completedCourseIds = new Set(enrollments.filter((item) => item.completion_current).map((item) => item.course_id));
  const videosByCourse = new Map<string, typeof videos>();
  for (const video of videos) videosByCourse.set(video.course_id, [...(videosByCourse.get(video.course_id) ?? []), video]);
  const enrolledCourses = enrollments.flatMap((enrollment) => {
    const course = courses.find((item) => item.id === enrollment.course_id);
    if (!course) return [];
    const requiredVideos = (videosByCourse.get(course.id) ?? []).filter((video) => !video.is_optional);
    const watchedPercent = requiredVideos.length ? Math.round(requiredVideos.reduce((sum, video) => sum + Number(videoProgress.get(video.id)?.completion_percentage ?? 0), 0) / requiredVideos.length) : 0;
    const completedVideos = requiredVideos.filter((video) => videoProgress.get(video.id)?.is_completed).length;
    const remainingSeconds = requiredVideos.reduce((sum, video) => sum + Math.ceil(video.duration_seconds * (1 - Number(videoProgress.get(video.id)?.completion_percentage ?? 0) / 100)), 0);
    return [{ id: course.id, title: course.title, description: course.description, progress: enrollment.completion_current ? 100 : watchedPercent, completedVideos, totalVideos: requiredVideos.length, remainingMinutes: Math.ceil(remainingSeconds / 60), isCompleted: enrollment.completion_current }];
  });
  const activeLesson = enrolledCourses.find((course) => !course.isCompleted) ?? enrolledCourses[0] ?? null;
  const currentTier = tier?.current_tier ?? 1;
  const currentTierLessons = courses.filter((course) => course.min_tier === currentTier);
  const currentTierCompleted = currentTierLessons.filter((course) => completedCourseIds.has(course.id)).length;

  const tierProgressDetails = [1, 2, 3, 4].map((level) => {
    const levelLessons = courses.filter((course) => course.min_tier === level);
    const completedCount = levelLessons.filter((course) => completedCourseIds.has(course.id)).length;
    const totalCount = levelLessons.length;

    let status: "locked" | "active" | "completed" = "locked";
    if (tier?.is_master || currentTier > level) {
      status = "completed";
    } else if (currentTier === level) {
      status = "active";
    } else {
      status = "locked";
    }

    const titles = ["Basic", "Beginner", "Intermediate", "Advanced"];
    return {
      level,
      title: titles[level - 1] ?? `Tier ${level}`,
      completedCount,
      totalCount,
      status,
    };
  });

  const data: DashboardData = {
    memberName: profile?.full_name?.trim() || "Practitioner",
    platformRole: profile?.platform_role ?? "member",
    currentTier,
    isMaster: tier?.is_master ?? false,
    currentTierTitle: currentTier === 5 ? "Master Zone" : currentTierLessons[0]?.title ?? ["Basic", "Beginner", "Intermediate", "Advanced"][currentTier - 1] ?? `Tier ${currentTier}`,
    completedLessons: completedCourseIds.size,
    totalLessons: courses.length,
    currentTierCompleted,
    currentTierTotal: currentTierLessons.length,
    activeLesson,
    enrolledCourses,
    upcomingEvent: eventsResult.data?.[0] ?? null,
    notifications: notificationsResult.data ?? [],
    tierProgressDetails,
  };

  return <DashboardView data={data} routeBase={routeBase} />;
}

export default async function DashboardPage() {
  return renderDashboardPage({ routeBase: "/dashboard" });
}
