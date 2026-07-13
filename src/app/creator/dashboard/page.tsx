import { DashboardView, type DashboardData } from "@/components/dashboard/DashboardView";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorDashboardPage() {
  const { supabase, user } = await requireInfluencerWorkspace("/creator/dashboard");

  const now = new Date().toISOString();
  const [profileResult, tierResult, progressResult, lessonsResult, eventsResult, notificationsResult] = await Promise.all([
    supabase.from("profiles").select("full_name, platform_role").eq("id", user.id).maybeSingle(),
    supabase.from("member_tiers").select("current_tier, is_master").eq("user_id", user.id).maybeSingle(),
    supabase.from("lesson_progress").select("lesson_id, is_completed, completion_percentage, last_watched_at").eq("user_id", user.id).order("last_watched_at", { ascending: false, nullsFirst: false }),
    supabase.from("lessons").select("id, title, description, sort_order, tiers(level, title)").or(`status.eq.published,status.eq.draft`).order("sort_order"),
    supabase.from("events").select("id, title, description, starts_at, min_tier, status").in("status", ["upcoming", "live"]).gte("starts_at", now).order("starts_at").limit(1),
    supabase.from("notifications").select("id, type, title, body, action_url, is_read, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
  ]);

  const results = [profileResult, tierResult, progressResult, lessonsResult, eventsResult, notificationsResult];
  if (results.some((result) => result.error)) {
    throw new Error("Unable to load creator dashboard data.");
  }

  const progress = progressResult.data ?? [];
  const lessons = lessonsResult.data ?? [];
  const completedLessonIds = new Set(progress.filter((item) => item.is_completed).map((item) => item.lesson_id));
  const activeProgress = progress.find((item) => !item.is_completed);
  const activeLesson = lessons.find((lesson) => lesson.id === activeProgress?.lesson_id) ?? lessons.find((lesson) => !completedLessonIds.has(lesson.id)) ?? null;
  const currentTier = tierResult.data?.current_tier ?? 1;
  const currentTierLessons = lessons.filter((lesson) => lesson.tiers?.[0]?.level === currentTier);
  const currentTierCompleted = currentTierLessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;

  const data: DashboardData = {
    memberName: profileResult.data?.full_name?.trim() || "Practitioner",
    platformRole: profileResult.data?.platform_role ?? "influencer",
    currentTier,
    isMaster: tierResult.data?.is_master ?? false,
    currentTierTitle: currentTier === 5 ? "Master Zone" : currentTierLessons[0]?.tiers?.[0]?.title ?? `Tier ${currentTier}`,
    completedLessons: completedLessonIds.size,
    totalLessons: lessons.length,
    currentTierCompleted,
    currentTierTotal: currentTierLessons.length,
    activeLesson: activeLesson ? { id: activeLesson.id, title: activeLesson.title, description: activeLesson.description, progress: Number(activeProgress?.completion_percentage ?? 0) } : null,
    upcomingEvent: eventsResult.data?.[0] ?? null,
    notifications: notificationsResult.data ?? [],
  };

  return <DashboardView data={data} routeBase="/creator" />;
}
