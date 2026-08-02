import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseVideoPlayer } from "@/components/courses/CourseVideoPlayer";
import { requireActiveMembership } from "@/lib/supabase/access";
import { AppShell } from "@/components/layout/AppShell";
import { withRouteBase } from "@/lib/navigation/paths";

export async function renderVideoPage({
  id,
  videoId,
  routeBase = "",
}: {
  id: string;
  videoId: string;
  routeBase?: string;
}) {
  const { supabase, user } = await requireActiveMembership(
    routeBase ? `${routeBase}/courses/${id}/video/${videoId}` : `/courses/${id}/video/${videoId}`
  );

  const [courseResult, videoResult, videosResult, progressResult, profileResult, tierResult] = await Promise.all([
    supabase.from("courses").select("title").eq("id", id).maybeSingle(),
    supabase.from("course_videos").select("id,title,description,course_id,duration_seconds,sort_order,is_optional").eq("id", videoId).eq("course_id", id).maybeSingle(),
    supabase.from("course_videos").select("id,title,duration_seconds,sort_order,is_optional").eq("course_id", id).order("sort_order"),
    supabase.from("course_video_progress").select("video_id,completion_percentage,is_completed").eq("user_id", user.id),
    supabase.from("profiles").select("full_name,platform_role").eq("id", user.id).maybeSingle(),
    supabase.from("member_tiers").select("current_tier,is_master").eq("user_id", user.id).maybeSingle(),
  ]);

  if (courseResult.error || !courseResult.data || videoResult.error || !videoResult.data || videosResult.error || progressResult.error || profileResult.error || tierResult.error) {
    notFound();
  }

  const video = videoResult.data;
  const profile = profileResult.data;
  const currentTier = tierResult.data?.current_tier ?? 1;
  const isMaster = tierResult.data?.is_master ?? false;
  const progress = new Map((progressResult.data ?? []).map((item) => [item.video_id, item]));
  const playlist = (videosResult.data ?? []).map((item) => {
    const itemProgress = progress.get(item.id);
    return {
      id: item.id,
      title: item.title,
      durationSeconds: item.duration_seconds,
      isOptional: item.is_optional,
      isCompleted: !!itemProgress?.is_completed,
      isUnlocked: true,
    };
  });
  const initialProgress = Number(progress.get(video.id)?.completion_percentage ?? 0);

  return (
    <AppShell
      active="Courses"
      title="Watch Video"
      terminalHeader
      memberName={profile?.full_name?.trim() || "Practitioner"}
      platformRole={profile?.platform_role ?? "member"}
      currentTier={currentTier}
      isMaster={isMaster}
      routeBase={routeBase}
    >
      <main className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <div className="mb-8 border-b border-surgical-steel pb-5">
          <Link href={withRouteBase(routeBase, `/courses/${id}`)} className="font-label text-xs uppercase tracking-wider text-fog-muted transition hover:text-primary-container">&larr; Back to course</Link>
        </div>

        <CourseVideoPlayer videoId={video.id} title={video.title} description={video.description} courseId={id} courseTitle={courseResult.data.title} videos={playlist} initialProgress={initialProgress} routeBase={routeBase} />
      </main>
    </AppShell>
  );
}
