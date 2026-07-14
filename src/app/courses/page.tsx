import { requireActiveMembership } from "@/lib/supabase/access";
import { LearningPathView, type LearningPathData } from "@/components/courses/LearningPathView";

export async function renderCoursesPage({ nextPath = "/courses", routeBase = "" }: { nextPath?: string; routeBase?: string } = {}) {
  const { supabase, user } = await requireActiveMembership(nextPath);
  const [profileResult, tierResult, progressResult, lessonsResult, tiersResult] = await Promise.all([
    supabase.from("profiles").select("full_name, platform_role").eq("id", user.id).maybeSingle(),
    supabase.from("member_tiers").select("current_tier, is_master").eq("user_id", user.id).maybeSingle(),
    supabase.from("lesson_progress").select("lesson_id, is_completed, completion_percentage").eq("user_id", user.id),
    supabase.from("lessons").select("id, title, description, sort_order, tier_id, duration_seconds, release_at").eq("status", "published").order("sort_order"),
    supabase.from("tiers").select("id, level, title, description, required_lesson_count").order("level"),
  ]);

  if (profileResult.error || tierResult.error || progressResult.error || lessonsResult.error || tiersResult.error) {
    throw new Error("Unable to load curriculum and learning path.");
  }

  const profile = profileResult.data;
  const tier = tierResult.data;
  const progress = progressResult.data ?? [];
  const lessons = lessonsResult.data ?? [];
  const dbTiers = tiersResult.data ?? [];

  const currentTier = tier?.current_tier ?? 1;
  const isMaster = tier?.is_master ?? false;

  const progressMap = new Map(progress.map((p) => [p.lesson_id, p]));

  // Build TierProgressItems
  const formattedTiers = dbTiers.map((t) => {
    const tierLessons = lessons.filter((l) => l.tier_id === t.id);
    const isTierLocked = !isMaster && currentTier < t.level;

    const formattedLessons = tierLessons.map((l) => {
      const prog = progressMap.get(l.id);
      const isCompleted = prog?.is_completed ?? false;
      const completionPercentage = Number(prog?.completion_percentage ?? 0);
      const isUpcoming = l.release_at ? new Date(l.release_at) > new Date() : false;

      // A lesson is locked if the tier itself is locked, OR if it's upcoming
      const isLessonLocked = isTierLocked || isUpcoming;

      return {
        id: l.id,
        title: l.title,
        description: l.description,
        sortOrder: l.sort_order,
        duration: l.duration_seconds ? Math.round(l.duration_seconds / 60) : null,
        isCompleted,
        completionPercentage,
        isLocked: isLessonLocked,
        isUpcoming,
      };
    });

    const completedCount = formattedLessons.filter((l) => l.isCompleted).length;

    return {
      id: t.id,
      level: t.level,
      title: t.title,
      description: t.description,
      lessons: formattedLessons,
      isLocked: isTierLocked,
      completedCount,
      totalCount: formattedLessons.length,
    };
  });

  const data: LearningPathData = {
    memberName: profile?.full_name?.trim() || "Practitioner",
    platformRole: profile?.platform_role ?? "member",
    currentTier,
    isMaster,
    tiers: formattedTiers,
  };

  return <LearningPathView data={data} routeBase={routeBase} />;
}

export default async function CoursesPage() {
  return renderCoursesPage();
}
