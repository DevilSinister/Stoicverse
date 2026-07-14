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
  const [profileResult, tierResult, progressResult, lessonsResult, eventsResult, notificationsResult] = await Promise.all([
    supabase.from("profiles").select("full_name, platform_role").eq("id", user.id).maybeSingle(),
    supabase.from("member_tiers").select("current_tier, is_master").eq("user_id", user.id).maybeSingle(),
    supabase.from("course_enrollments").select("course_id, completion_current, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("courses").select("id, title, description, min_tier").eq("status", "published").order("min_tier"),
    supabase.from("events").select("id, title, description, starts_at, min_tier, status").in("status", ["upcoming", "live"]).gte("starts_at", now).order("starts_at").limit(1),
    supabase.from("notifications").select("id, type, title, body, action_url, is_read, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
  ]);

  const results = [profileResult, tierResult, progressResult, lessonsResult, eventsResult, notificationsResult];
  if (results.some((result) => result.error)) {
    throw new Error("Unable to load your dashboard data.");
  }

  const profile = profileResult.data;
  const tier = tierResult.data;
  const progress = progressResult.data ?? [];
  const lessons = lessonsResult.data ?? [];
  const completedLessonIds = new Set(progress.filter((item) => item.completion_current).map((item) => item.course_id));
  const activeProgress = progress.find((item) => !item.completion_current);
  const activeLesson = lessons.find((lesson) => lesson.id === activeProgress?.course_id) ?? lessons.find((lesson) => !completedLessonIds.has(lesson.id)) ?? null;
  const currentTier = tier?.current_tier ?? 1;
  const currentTierLessons = lessons.filter((lesson) => lesson.min_tier === currentTier);
  const currentTierCompleted = currentTierLessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;

  const data: DashboardData = {
    memberName: profile?.full_name?.trim() || "Practitioner",
    platformRole: profile?.platform_role ?? "member",
    currentTier,
    isMaster: tier?.is_master ?? false,
    currentTierTitle: currentTier === 5 ? "Master Zone" : currentTierLessons[0]?.title ?? ["Basic", "Beginner", "Intermediate", "Advanced"][currentTier - 1] ?? `Tier ${currentTier}`,
    completedLessons: completedLessonIds.size,
    totalLessons: lessons.length,
    currentTierCompleted,
    currentTierTotal: currentTierLessons.length,
    activeLesson: activeLesson ? { id: activeLesson.id, title: activeLesson.title, description: activeLesson.description, progress: activeProgress?.completion_current ? 100 : 0 } : null,
    upcomingEvent: eventsResult.data?.[0] ?? null,
    notifications: notificationsResult.data ?? [],
  };

  return <DashboardView data={data} routeBase={routeBase} />;
}

export default async function DashboardPage() {
  return renderDashboardPage({ routeBase: "/dashboard" });
}
