import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, ChevronRight, Clock3, PlayCircle } from "lucide-react";

import { EnrollButton } from "@/app/courses/[id]/EnrollButton";
import { AppShell } from "@/components/layout/AppShell";
import { withRouteBase } from "@/lib/navigation/paths";
import { requireActiveMembership } from "@/lib/supabase/access";

export async function renderCourseDetailPage({ id, routeBase = "" }: { id: string; routeBase?: string }) {
  const { supabase, user } = await requireActiveMembership(routeBase ? `${routeBase}/courses/${id}` : `/courses/${id}`);
  const [courseResult, enrollmentResult, videosResult, progressResult, tierResult, profileResult] = await Promise.all([
    supabase.from("courses").select("id,title,description,is_finished").eq("id", id).eq("status", "published").maybeSingle(),
    supabase.from("course_enrollments").select("completion_current").eq("course_id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("course_videos").select("id,title,description,duration_seconds,sort_order,is_optional").eq("course_id", id).order("sort_order"),
    supabase.from("course_video_progress").select("video_id,completion_percentage,is_completed").eq("user_id", user.id),
    supabase.from("member_tiers").select("current_tier,is_master").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("full_name,platform_role").eq("id", user.id).maybeSingle(),
  ]);

  if (courseResult.error || !courseResult.data || videosResult.error || progressResult.error || tierResult.error || profileResult.error) notFound();

  const course = courseResult.data;
  const videos = videosResult.data ?? [];
  const progress = new Map((progressResult.data ?? []).map((item) => [item.video_id, item]));
  const requiredVideos = videos.filter((video) => !video.is_optional);
  const completedRequired = requiredVideos.filter((video) => progress.get(video.id)?.is_completed).length;
  const progressPercent = requiredVideos.length ? Math.round((completedRequired / requiredVideos.length) * 100) : 0;
  const totalMinutes = Math.ceil(videos.reduce((total, video) => total + video.duration_seconds, 0) / 60);
  const totalDuration = totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes} min`;
  const profile = profileResult.data;
  const currentTier = tierResult.data?.current_tier ?? 1;
  const isMaster = tierResult.data?.is_master ?? false;
  const isEnrolled = Boolean(enrollmentResult.data);
  const completionCurrent = Boolean(enrollmentResult.data?.completion_current);
  const nextVideo = videos.find((video) => !progress.get(video.id)?.is_completed) ?? videos[0];

  return <AppShell active="Courses" title={course.title} terminalHeader memberName={profile?.full_name?.trim() || "Practitioner"} platformRole={profile?.platform_role ?? "member"} currentTier={currentTier} isMaster={isMaster} routeBase={routeBase}>
    <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Link href={withRouteBase(routeBase, "/courses")} className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fog-muted hover:text-primary-container"><ArrowLeft size={15} />Course library</Link>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-6">
          <section className="terminal-card overflow-hidden"><div className="border-b border-surgical-steel px-6 py-4 sm:px-7"><div className="flex flex-wrap items-center gap-4 text-xs text-fog-muted"><span className="font-semibold text-primary-container">Open member course</span><span>{videos.length} lessons</span><span>{totalDuration} study time</span></div></div><div className="px-6 py-7 sm:px-7"><h1 className="max-w-3xl font-headline text-3xl font-semibold tracking-tight text-white sm:text-4xl">{course.title}</h1><p className="mt-4 max-w-3xl text-sm leading-relaxed text-on-surface-variant sm:text-base">{course.description || "A focused sequence of Stoic lessons ready to study."}</p>{isEnrolled && <div className="mt-7 border-t border-surgical-steel pt-4"><div className="flex items-center justify-between gap-4 text-sm"><span className="text-on-surface-variant">{completedRequired} of {requiredVideos.length} required lessons completed</span><span className="text-xs font-semibold text-primary-container">{progressPercent}%</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-container-highest"><div className="h-full rounded-full bg-primary-container" style={{ width: `${progressPercent}%` }} /></div></div>}</div></section>

          <section className="terminal-card overflow-hidden"><header className="border-b border-surgical-steel px-6 py-5 sm:px-7"><h2 className="font-headline text-xl font-semibold text-white">Released lessons</h2><p className="mt-1 text-sm text-fog-muted">Watch any released lesson in the order that works for you.</p></header><div className="divide-y divide-surgical-steel">{videos.map((video, index) => { const item = progress.get(video.id); const completed = Boolean(item?.is_completed); return <article key={video.id} className="grid gap-4 px-6 py-5 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center sm:px-7"><div className={`grid size-10 place-items-center rounded-full ${completed ? "bg-primary-container/15 text-primary-container" : "bg-surface-container-high text-primary-container"}`}>{completed ? <CheckCircle2 size={18} /> : <PlayCircle size={18} />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-3 text-xs text-fog-muted"><span className="font-semibold text-primary-container">Lesson {String(index + 1).padStart(2, "0")}</span><span className="inline-flex items-center gap-1.5"><Clock3 size={13} />{Math.ceil(video.duration_seconds / 60)} min</span><span>{video.is_optional ? "Optional" : "Required for completion"}</span></div><h3 className="mt-1 font-headline text-base font-semibold text-white">{video.title}</h3>{video.description && <p className="mt-1 text-sm leading-relaxed text-on-surface-variant line-clamp-2">{video.description}</p>}{Number(item?.completion_percentage ?? 0) > 0 && !completed && <p className="mt-2 text-xs text-primary-container">{Number(item?.completion_percentage).toFixed(0)}% watched</p>}</div><Link href={withRouteBase(routeBase, `/courses/${course.id}/video/${video.id}`)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary-container px-4 text-xs font-semibold uppercase tracking-wider text-primary-container hover:bg-primary-container/10">{completed ? "Review" : "Watch"}<ChevronRight size={14} /></Link></article>; })}{!videos.length && <p className="px-6 py-12 text-center text-sm text-fog-muted">No lessons have been released yet.</p>}</div></section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit"><section className="terminal-card p-6"><p className="terminal-label">Course status</p>{completionCurrent ? <><h2 className="mt-3 font-headline text-xl font-semibold text-white">Course complete</h2><p className="mt-2 text-sm leading-relaxed text-fog-muted">Your achievement is recorded and every released lesson remains available to revisit.</p></> : isEnrolled ? <><h2 className="mt-3 font-headline text-xl font-semibold text-white">Continue your study</h2><p className="mt-2 text-sm leading-relaxed text-fog-muted">Your progress is saved automatically while you watch.</p>{nextVideo && <Link href={withRouteBase(routeBase, `/courses/${course.id}/video/${nextVideo.id}`)} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary-container px-4 text-xs font-semibold uppercase tracking-wider text-on-primary-fixed">Continue lesson <ChevronRight size={14} /></Link>}</> : <><h2 className="mt-3 font-headline text-xl font-semibold text-white">Open to all members</h2><p className="mt-2 text-sm leading-relaxed text-fog-muted">You can watch immediately. Enroll to add this course to your dashboard and track completion.</p><div className="mt-5"><EnrollButton courseId={course.id} /></div></>}</section></aside>
      </div>
    </main>
  </AppShell>;
}
