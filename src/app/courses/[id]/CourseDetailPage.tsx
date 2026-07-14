import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Lock, PlayCircle, Info, Users, Clapperboard, Clock, Award } from "lucide-react";
import { requireActiveMembership } from "@/lib/supabase/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/layout/AppShell";
import { withRouteBase } from "@/lib/navigation/paths";
import { EnrollButton } from "./EnrollButton";

interface MinimalCourse {
  id: string;
  title: string;
}

export async function renderCourseDetailPage({
  id,
  routeBase = "",
}: {
  id: string;
  routeBase?: string;
}) {
  const { supabase, user } = await requireActiveMembership(
    routeBase ? `${routeBase}/courses/${id}` : `/courses/${id}`
  );

  // Fetch course and enrollments
  const [courseResult, enrollmentResult, videosResult, progressResult, prerequisitesResult, tierResult, profileResult] =
    await Promise.all([
      supabase.from("courses").select("id,title,description,is_finished,completion_tier,min_tier").eq("id", id).maybeSingle(),
      supabase.from("course_enrollments").select("completion_current,first_completed_at").eq("course_id", id).eq("user_id", user.id).maybeSingle(),
      supabase.from("course_videos").select("id,title,description,duration_seconds,sort_order,is_optional,created_at").eq("course_id", id).order("sort_order"),
      supabase.from("course_video_progress").select("video_id,completion_percentage,is_completed").eq("user_id", user.id),
      supabase.from("course_prerequisites").select("course_id,prerequisite_course_id"),
      supabase.from("member_tiers").select("current_tier,is_master").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("full_name,platform_role").eq("id", user.id).maybeSingle(),
    ]);

  if (courseResult.error || !courseResult.data || videosResult.error || progressResult.error || prerequisitesResult.error || tierResult.error || profileResult.error) {
    notFound();
  }

  const course = courseResult.data;
  const isEnrolled = !!enrollmentResult.data;
  const currentTier = tierResult.data?.current_tier ?? 1;
  const isMaster = tierResult.data?.is_master ?? false;
  const profile = profileResult.data;

  // Use admin client to resolve prerequisite course titles and counts if service role key is available
  let allCourses: MinimalCourse[] = [];
  let enrollmentCount = 0;

  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (hasServiceKey) {
    try {
      const admin = createAdminClient();
      const [allCoursesResult, enrollmentCountResult] = await Promise.all([
        admin.from("courses").select("id,title"),
        admin.from("course_enrollments").select("id", { count: "exact", head: true }).eq("course_id", id)
      ]);
      if (!allCoursesResult.error) allCourses = (allCoursesResult.data as unknown as MinimalCourse[]) ?? [];
      if (!enrollmentCountResult.error) enrollmentCount = enrollmentCountResult.count ?? 0;
    } catch (e) {
      console.warn("Failed to fetch admin course data", e);
    }
  } else {
    // Fallback to user client for course titles (which is allowed by RLS)
    try {
      const { data: userCourses } = await supabase.from("courses").select("id,title");
      if (userCourses) allCourses = userCourses as unknown as MinimalCourse[];
    } catch {
      // Ignore
    }
    // Fallback enrollment count to 1 if enrolled, or 0
    enrollmentCount = isEnrolled ? 1 : 0;
  }

  const courseTitles = new Map<string, string>(allCourses.map(c => [c.id, c.title]));

  // Prerequisites logic
  const prerequisites = (prerequisitesResult.data ?? []).filter(item => item.course_id === id).map(item => item.prerequisite_course_id);
  
  // Prerequisite courses completed by user
  const userCompletedEnrollments = await supabase.from("course_enrollments").select("course_id").eq("user_id", user.id).eq("completion_current", true);
  const completedCourses = new Set((userCompletedEnrollments.data ?? []).map(e => e.course_id));
  
  const missing = prerequisites.filter(pid => !completedCourses.has(pid));
  const missingCourses = missing.map(pid => courseTitles.get(pid) ?? "Prerequisite Course");

  const isLocked = currentTier < course.min_tier || missing.length > 0;

  const progress = new Map((progressResult.data ?? []).map(item => [item.video_id, item]));

  // Calculate course completion progress
  const videos = videosResult.data ?? [];
  const requiredVideos = videos.filter(v => !v.is_optional);
  const completedRequired = requiredVideos.filter(v => progress.get(v.id)?.is_completed).length;
  const totalRequired = requiredVideos.length;
  const progressPercent = totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 0;

  // Calculate total course duration
  const totalSeconds = videos.reduce((acc, v) => acc + v.duration_seconds, 0);
  const totalDurationStr = totalSeconds > 3600 
    ? `${Math.floor(totalSeconds / 3600)}h ${Math.ceil((totalSeconds % 3600) / 60)}m`
    : `${Math.ceil(totalSeconds / 60)} min`;

  let previousComplete = true;

  return (
    <AppShell
      active="Courses"
      title={course.title}
      memberName={profile?.full_name?.trim() || "Practitioner"}
      platformRole={profile?.platform_role ?? "member"}
      currentTier={currentTier}
      isMaster={isMaster}
      routeBase={routeBase}
    >
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8 space-y-8">
        <div>
          <Link
            href={withRouteBase(routeBase, "/courses")}
            className="text-xs uppercase tracking-wider text-primary-container hover:underline"
          >
            &larr; All courses
          </Link>
        </div>

        {/* Header Section */}
        <section className="border border-surgical-steel bg-monolith-surface rounded-lg p-6 md:p-8 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-surgical-steel/50 border border-surgical-steel px-3 py-1 text-xs font-semibold text-primary-container flex items-center gap-1.5">
              <Award size={13} /> Tier {course.min_tier} Course
            </span>
            <span className="text-xs text-fog-muted flex items-center gap-1">
              <Users size={13} /> {enrollmentCount} practitioners studying
            </span>
            <span className="text-xs text-fog-muted flex items-center gap-1">
              <Clapperboard size={13} /> {videos.length} lessons
            </span>
            <span className="text-xs text-fog-muted flex items-center gap-1">
              <Clock size={13} /> {totalDurationStr} total
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="font-headline text-3xl md:text-4xl font-bold text-white tracking-tight leading-none">
              {course.title}
            </h1>
            <p className="text-base text-on-surface-variant max-w-3xl leading-relaxed">
              {course.description || "No description provided."}
            </p>
          </div>

          {/* Enrolled Progress Bar */}
          {isEnrolled && !isLocked && (
            <div className="pt-4 border-t border-surgical-steel/40 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">Course Completion</span>
                <span className="font-mono text-primary-container">{progressPercent}% ({completedRequired}/{totalRequired} required lessons)</span>
              </div>
              <div className="h-2 w-full bg-surface-container-lowest rounded-full overflow-hidden border border-surgical-steel/50">
                <div
                  className="h-full bg-primary-container rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Unenrolled or Locked Actions */}
          {!isEnrolled && (
            <div className="pt-4 border-t border-surgical-steel/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
              {isLocked ? (
                <div className="rounded border border-red-500/20 bg-red-500/5 p-4 text-sm w-full space-y-2">
                  <h3 className="font-semibold text-red-300 flex items-center gap-2">
                    <Info size={16} /> What is missing to unlock this course:
                  </h3>
                  <ul className="space-y-1 text-on-surface-variant pl-5 list-disc text-xs">
                    {currentTier < course.min_tier && (
                      <li>Requires membership Tier {course.min_tier} (Your Tier: {currentTier})</li>
                    )}
                    {missingCourses.map((c, i) => (
                      <li key={i}>Must complete course: &ldquo;{c}&rdquo;</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full bg-primary-container/5 border border-primary-container/20 rounded-lg p-4">
                  <div>
                    <h3 className="font-semibold text-white text-sm">Enroll to unlock curriculum</h3>
                    <p className="text-xs text-fog-muted">Gain access to video player and progress tracking.</p>
                  </div>
                  <EnrollButton courseId={course.id} />
                </div>
              )}
            </div>
          )}
        </section>

        {/* Video List */}
        <section className="space-y-4">
          <h2 className="font-headline text-xl font-bold text-white tracking-tight">Curriculum Lessons</h2>

          <div className="grid gap-3">
            {videos.map((video, idx) => {
              const item = progress.get(video.id);
              const isCompleted = !!item?.is_completed;
              
              // sequential unlock logic: video is unlocked if enrolled AND (first video OR previous video is completed)
              const isVideoUnlocked = isEnrolled && !isLocked && previousComplete;
              previousComplete = isCompleted || video.is_optional;

              return (
                <article
                  key={video.id}
                  className={`flex flex-col md:flex-row md:items-center justify-between gap-4 rounded border p-5 transition-all duration-150 ${
                    isVideoUnlocked
                      ? "border-surgical-steel bg-monolith-surface"
                      : "border-surgical-steel/40 bg-surface-container-low/20 opacity-80"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex-shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="text-primary-container" size={18} />
                      ) : isVideoUnlocked ? (
                        <PlayCircle className="text-primary-container" size={18} />
                      ) : (
                        <Lock className="text-fog-muted" size={18} />
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-fog-muted font-mono">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <h3 className="font-headline text-lg font-semibold text-white leading-tight">
                          {video.title}
                        </h3>
                      </div>
                      
                      {video.description && (
                        <p className="text-sm text-on-surface-variant max-w-2xl">
                          {video.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-3 text-xs text-fog-muted">
                        <span>{Math.ceil(video.duration_seconds / 60)} min</span>
                        <span>&middot;</span>
                        <span>{video.is_optional ? "Optional" : "Required for completion"}</span>
                        {isEnrolled && item && (
                          <>
                            <span>&middot;</span>
                            <span className="text-primary-container">{Number(item.completion_percentage).toFixed(0)}% watched</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex justify-end">
                    {isVideoUnlocked ? (
                      <Link
                        href={withRouteBase(routeBase, `/courses/${course.id}/video/${video.id}`)}
                        className="rounded-full border border-primary-container px-4 py-1.5 text-xs uppercase font-semibold text-primary-container transition hover:bg-primary-container/10 active:scale-95"
                      >
                        {isCompleted ? "Review" : "Watch"}
                      </Link>
                    ) : (
                      <span className="text-xs text-fog-muted flex items-center gap-1 font-semibold uppercase tracking-wider pr-2">
                        <Lock size={12} /> Locked
                      </span>
                    )}
                  </div>
                </article>
              );
            })}

            {videos.length === 0 && (
              <div className="rounded border border-dashed border-surgical-steel p-8 text-center text-fog-muted">
                No lessons have been published in this course yet.
              </div>
            )}
          </div>
        </section>

        {course.is_finished && enrollmentResult.data?.completion_current && (
          <footer className="rounded border border-primary-container/30 bg-primary-container/10 p-5 text-sm text-primary-container flex items-center gap-3">
            <Award size={20} />
            <div>
              <p className="font-semibold text-white">Course complete!</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Your Tier {course.completion_tier} reward has been unlocked and is active.</p>
            </div>
          </footer>
        )}
      </main>
    </AppShell>
  );
}
