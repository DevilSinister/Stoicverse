import { CreatorCoursesView } from "@/components/creator/CreatorCoursesView";
import type { LearningPathData } from "@/components/courses/LearningPathView";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorCoursesPage() {
  const { supabase, user } = await requireInfluencerWorkspace("/creator/courses");

  const [profileResult, tierResult, progressResult, lessonsResult, tiersResult] = await Promise.all([
    supabase.from("profiles").select("full_name, platform_role").eq("id", user.id).maybeSingle(),
    supabase.from("member_tiers").select("current_tier, is_master").eq("user_id", user.id).maybeSingle(),
    supabase.from("lesson_progress").select("lesson_id, is_completed, completion_percentage").eq("user_id", user.id),
    supabase.from("lessons").select("id, title, description, sort_order, tier_id, duration_seconds, release_at").order("sort_order"),
    supabase.from("tiers").select("id, level, title, description, required_lesson_count").order("level"),
  ]);

  if (profileResult.error || tierResult.error || progressResult.error || lessonsResult.error || tiersResult.error) {
    throw new Error("Unable to load creator curriculum.");
  }

  const progress = progressResult.data ?? [];
  const lessons = lessonsResult.data ?? [];
  const dbTiers = tiersResult.data ?? [];
  const tier = tierResult.data;
  const currentTier = tier?.current_tier ?? 1;
  const isMaster = tier?.is_master ?? false;
  const progressMap = new Map(progress.map((item) => [item.lesson_id, item]));

  const tiers = dbTiers.map((tierRecord) => {
    const tierLessons = lessons.filter((lesson) => lesson.tier_id === tierRecord.id);
    const isTierLocked = !isMaster && currentTier < tierRecord.level;
    const formattedLessons = tierLessons.map((lesson) => {
      const item = progressMap.get(lesson.id);
      const isCompleted = item?.is_completed ?? false;
      const completionPercentage = Number(item?.completion_percentage ?? 0);
      const isUpcoming = lesson.release_at ? new Date(lesson.release_at) > new Date() : false;
      return {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        sortOrder: lesson.sort_order,
        duration: lesson.duration_seconds ? Math.round(lesson.duration_seconds / 60) : null,
        isCompleted,
        completionPercentage,
        isLocked: isTierLocked || isUpcoming,
        isUpcoming,
      };
    });

    return {
      id: tierRecord.id,
      level: tierRecord.level,
      title: tierRecord.title,
      description: tierRecord.description,
      lessons: formattedLessons,
      isLocked: isTierLocked,
      completedCount: formattedLessons.filter((lesson) => lesson.isCompleted).length,
      totalCount: formattedLessons.length,
    };
  });

  const data: LearningPathData = {
    memberName: profileResult.data?.full_name?.trim() || "Practitioner",
    platformRole: profileResult.data?.platform_role ?? "influencer",
    currentTier,
    isMaster,
    tiers,
  };

  return <CreatorCoursesView data={data} />;
}
