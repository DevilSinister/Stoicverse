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
  let previousComplete = true;
  const playlist = (videosResult.data ?? []).map((item) => {
    const itemProgress = progress.get(item.id);
    const isUnlocked = previousComplete;
    // Optional items are recommended; required items hold the sequence.
    previousComplete = !!itemProgress?.is_completed || item.is_optional;
    return {
      id: item.id,
      title: item.title,
      durationSeconds: item.duration_seconds,
      isOptional: item.is_optional,
      isCompleted: !!itemProgress?.is_completed,
      isUnlocked,
    };
  });
  const initialProgress = Number(progress.get(video.id)?.completion_percentage ?? 0);

  return (
    <AppShell
      active="Courses"
      title="Watch Video"
      memberName={profile?.full_name?.trim() || "Practitioner"}
      platformRole={profile?.platform_role ?? "member"}
      currentTier={currentTier}
      isMaster={isMaster}
      routeBase={routeBase}
    >
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 space-y-5">
        <div>
          <Link
            href={withRouteBase(routeBase, `/courses/${id}`)}
            className="text-xs uppercase tracking-wider text-primary-container hover:underline"
          >
            &larr; Back to course
          </Link>
        </div>

        <CourseVideoPlayer videoId={video.id} title={video.title} courseId={id} courseTitle={courseResult.data.title} videos={playlist} initialProgress={initialProgress} routeBase={routeBase} />
        {video.description && <p className="max-w-3xl text-sm leading-6 text-on-surface-variant">{video.description}</p>}
      </main>
    </AppShell>
  );
}
