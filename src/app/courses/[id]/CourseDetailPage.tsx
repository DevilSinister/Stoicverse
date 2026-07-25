import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, ChevronRight, Lock, PlayCircle, Info, Users, Clapperboard, Clock, Award } from "lucide-react";
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

  const lessonItems: CourseLesson[] = videos.map((video, index) => {
    const item = progress.get(video.id);
    const isCompleted = !!item?.is_completed;
    const isUnlocked = isEnrolled && !isLocked && previousComplete;
    previousComplete = isCompleted || video.is_optional;
    return { id: video.id, title: video.title, description: video.description, durationSeconds: video.duration_seconds, isOptional: video.is_optional, index, isCompleted, isUnlocked, watchedPercent: Number(item?.completion_percentage ?? 0) };
  });

  return <CourseDetailWorkspace course={{ id: course.id, title: course.title, description: course.description, minTier: course.min_tier, completionTier: course.completion_tier, isFinished: course.is_finished }} lessons={lessonItems} routeBase={routeBase} memberName={profile?.full_name?.trim() || "Practitioner"} platformRole={profile?.platform_role ?? "member"} currentTier={currentTier} isMaster={isMaster} isEnrolled={isEnrolled} isLocked={isLocked} progressPercent={progressPercent} completedRequired={completedRequired} totalRequired={totalRequired} totalDuration={totalDurationStr} enrollmentCount={enrollmentCount} missingCourses={missingCourses} completionCurrent={!!enrollmentResult.data?.completion_current} />;

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

type CourseLesson = { id: string; title: string; description: string | null; durationSeconds: number; isOptional: boolean; index: number; isCompleted: boolean; isUnlocked: boolean; watchedPercent: number };
type CourseDetail = { id: string; title: string; description: string | null; minTier: number; completionTier: number | null; isFinished: boolean };

function CourseDetailWorkspace({ course, lessons, routeBase, memberName, platformRole, currentTier, isMaster, isEnrolled, isLocked, progressPercent, completedRequired, totalRequired, totalDuration, enrollmentCount, missingCourses, completionCurrent }: { course: CourseDetail; lessons: CourseLesson[]; routeBase: string; memberName: string; platformRole: string; currentTier: number; isMaster: boolean; isEnrolled: boolean; isLocked: boolean; progressPercent: number; completedRequired: number; totalRequired: number; totalDuration: string; enrollmentCount: number; missingCourses: string[]; completionCurrent: boolean }) {
  const tierNames = ["Basic", "Beginner", "Intermediate", "Advanced"];
  const tierName = tierNames[course.minTier - 1] ?? `Tier ${course.minTier}`;
  const nextLesson = lessons.find((lesson) => lesson.isUnlocked && !lesson.isCompleted);

  return <AppShell active="Courses" title={course.title} terminalHeader memberName={memberName} platformRole={platformRole} currentTier={currentTier} isMaster={isMaster} routeBase={routeBase}>
    <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Link href={withRouteBase(routeBase, "/courses")} className="inline-flex min-h-10 items-center gap-2 font-label text-xs uppercase tracking-wider text-fog-muted transition hover:text-primary-container"><ArrowLeft size={15} />Learning path</Link>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-6">
          <section className="terminal-card overflow-hidden"><div className="border-b border-surgical-steel px-6 py-4 sm:px-7"><div className="flex flex-wrap items-center gap-x-4 gap-y-2"><span className="font-label text-xs uppercase tracking-wider text-primary-container">{tierName} course</span><span className="text-xs text-fog-muted">{lessons.length} lessons · {totalDuration}</span><span className="text-xs text-fog-muted">{enrollmentCount} studying</span></div></div><div className="px-6 py-7 sm:px-7"><h1 className="max-w-3xl font-headline text-3xl font-semibold tracking-tight text-white sm:text-4xl [text-wrap:balance]">{course.title}</h1><p className="mt-4 max-w-3xl text-sm leading-relaxed text-on-surface-variant sm:text-base">{course.description || "A focused sequence of lessons for this stage of your learning path."}</p>{isEnrolled && !isLocked && <div className="mt-7 border-t border-surgical-steel pt-4"><div className="flex items-center justify-between gap-4 text-sm"><span className="text-on-surface-variant">Course progress · {completedRequired} of {totalRequired} required lessons</span><span className="font-label text-xs text-primary-container">{progressPercent}%</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-container-highest"><div className="h-full rounded-full bg-primary-container transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${progressPercent}%` }} /></div></div>}</div></section>

          <section className="terminal-card overflow-hidden"><header className="flex flex-wrap items-end justify-between gap-4 border-b border-surgical-steel px-6 py-5 sm:px-7"><div><h2 className="font-headline text-xl font-semibold text-white">Course curriculum</h2><p className="mt-1 text-sm text-fog-muted">Complete each required lesson to open the next one.</p></div><span className="font-label text-xs text-fog-muted">{lessons.length} lessons</span></header><div className="divide-y divide-surgical-steel">{lessons.map((lesson) => <LessonRow key={lesson.id} lesson={lesson} courseId={course.id} routeBase={routeBase} />)}{!lessons.length && <p className="px-6 py-12 text-center text-sm text-fog-muted">No lessons have been published in this course yet.</p>}</div></section>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit"><section className="terminal-card p-6"><p className="terminal-label">Course access</p>{isLocked ? <><h2 className="mt-3 font-headline text-xl font-semibold text-white">Locked for now</h2><p className="mt-2 text-sm leading-relaxed text-fog-muted">{missingCourses.length ? `Complete ${missingCourses.join(", ")} to unlock this course.` : `This course opens at ${tierName}.`}</p><div className="mt-5 rounded-lg border border-surgical-steel bg-surface-container-lowest p-4 text-sm text-on-surface-variant">Your current tier: <span className="font-semibold text-white">{tierNames[currentTier - 1] ?? `Tier ${currentTier}`}</span></div></> : !isEnrolled ? <><h2 className="mt-3 font-headline text-xl font-semibold text-white">Ready when you are</h2><p className="mt-2 text-sm leading-relaxed text-fog-muted">Enroll to open the lessons and record your progress.</p><div className="mt-5"><EnrollButton courseId={course.id} /></div></> : <><h2 className="mt-3 font-headline text-xl font-semibold text-white">{completionCurrent ? "Course complete" : "Continue your study"}</h2><p className="mt-2 text-sm leading-relaxed text-fog-muted">{completionCurrent ? "You can revisit any available lesson whenever you need it." : nextLesson ? `Next up: ${nextLesson.title}` : "Your next lesson will appear here when it becomes available."}</p>{nextLesson && <Link href={withRouteBase(routeBase, `/courses/${course.id}/video/${nextLesson.id}`)} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary-container px-4 font-label text-xs font-semibold uppercase tracking-wider text-on-primary-fixed transition hover:brightness-110">Continue lesson <ChevronRight size={14} /></Link>}</>}</section><section className="terminal-card p-6"><p className="terminal-label">Course details</p><dl className="mt-4 space-y-3 text-sm"><div className="flex items-center justify-between gap-4"><dt className="text-fog-muted">Level</dt><dd className="text-white">{tierName}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-fog-muted">Study time</dt><dd className="text-white">{totalDuration}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-fog-muted">Lessons</dt><dd className="text-white">{lessons.length}</dd></div></dl></section></aside>
      </div>
    </main>
  </AppShell>;
}

function LessonRow({ lesson, courseId, routeBase }: { lesson: CourseLesson; courseId: string; routeBase: string }) {
  const status = lesson.isCompleted ? "Completed" : lesson.isUnlocked ? "Ready" : "Locked";
  const Icon = lesson.isCompleted ? CheckCircle2 : lesson.isUnlocked ? PlayCircle : Lock;
  return <article className={`grid gap-4 px-6 py-5 transition-colors sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center sm:px-7 ${lesson.isUnlocked ? "hover:bg-surface-container-high/35" : "bg-surface-container-low/25"}`}><div className={`grid size-10 place-items-center rounded-full ${lesson.isCompleted ? "bg-primary-container/15 text-primary-container" : lesson.isUnlocked ? "bg-surface-container-high text-primary-container" : "bg-surface-container-high text-fog-muted"}`}><Icon size={18} /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className={`font-label text-[10px] uppercase tracking-wider ${lesson.isUnlocked ? "text-primary-container" : "text-fog-muted"}`}>Lesson {String(lesson.index + 1).padStart(2, "0")}</span><span className="text-xs text-fog-muted">{Math.ceil(lesson.durationSeconds / 60)} min · {lesson.isOptional ? "Optional" : "Required"}</span></div><h3 className="mt-1 font-headline text-base font-semibold text-white [text-wrap:balance]">{lesson.title}</h3>{lesson.description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-on-surface-variant line-clamp-2">{lesson.description}</p>}{lesson.isUnlocked && !lesson.isCompleted && lesson.watchedPercent > 0 && <div className="mt-3 flex items-center gap-3"><div className="h-1.5 w-full max-w-52 overflow-hidden rounded-full bg-surface-container-highest"><div className="h-full rounded-full bg-primary-container" style={{ width: `${lesson.watchedPercent}%` }} /></div><span className="font-label text-xs text-primary-container">{lesson.watchedPercent.toFixed(0)}%</span></div>}</div><div className="flex items-center gap-3 sm:justify-self-end"><span className="hidden font-label text-[10px] uppercase tracking-wider text-fog-muted lg:inline">{status}</span>{lesson.isUnlocked ? <Link href={withRouteBase(routeBase, `/courses/${courseId}/video/${lesson.id}`)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary-container px-4 font-label text-xs font-semibold uppercase tracking-wider text-primary-container transition hover:bg-primary-container/10">{lesson.isCompleted ? "Review" : "Watch"}<ChevronRight size={14} /></Link> : <span className="inline-flex min-h-10 items-center rounded-full border border-surgical-steel px-4 font-label text-xs uppercase tracking-wider text-fog-muted">Locked</span>}</div></article>;
}
