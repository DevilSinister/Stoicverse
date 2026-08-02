"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, ChevronRight, CirclePlay, Clock3, Users, X } from "lucide-react";

import { enrollInCourse } from "@/app/courses/actions";
import { AppShell } from "@/components/layout/AppShell";
import type { CourseCard } from "@/components/courses/CourseCatalog";
import { withRouteBase } from "@/lib/navigation/paths";

type CourseFilter = "all" | "active" | "completed";

const filters: { id: CourseFilter; label: string }[] = [
  { id: "all", label: "All courses" },
  { id: "active", label: "In progress" },
  { id: "completed", label: "Completed" },
];

const duration = (videos: CourseCard["videos"]) => {
  const minutes = Math.ceil(videos.reduce((sum, video) => sum + video.durationSeconds, 0) / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
};

export function LearningPathCatalog({ courses, memberName, platformRole, currentTier, isMaster, routeBase = "" }: { courses: CourseCard[]; memberName: string; platformRole: string; currentTier: number; isMaster: boolean; routeBase?: string }) {
  const [filter, setFilter] = useState<CourseFilter>("all");
  const [selectedCourse, setSelectedCourse] = useState<CourseCard | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visibleCourses = useMemo(() => courses.filter((course) => filter === "all" || (filter === "active" && course.isEnrolled && !course.isCompleted) || (filter === "completed" && course.isCompleted)), [courses, filter]);
  const completedCount = courses.filter((course) => course.isCompleted).length;

  const enroll = () => {
    if (!selectedCourse) return;
    startTransition(async () => {
      const result = await enrollInCourse(selectedCourse.id);
      setMessage(result.error ?? "You’re enrolled. Every released lesson is ready to watch.");
    });
  };

  return <AppShell active="Courses" title="Course library" terminalHeader memberName={memberName} platformRole={platformRole} currentTier={currentTier} isMaster={isMaster} routeBase={routeBase}>
    <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <header className="border-b border-surgical-steel pb-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="terminal-label">Member curriculum</p><h1 className="mt-2 font-headline text-3xl font-semibold tracking-tight text-white sm:text-4xl">Course library</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-on-surface-variant">Every published course is available to active members. Choose any subject, watch released lessons in any order, and keep your progress in one place.</p></div>
          <div className="border-l border-surgical-steel pl-5"><p className="text-xs text-fog-muted">Completed</p><p className="mt-1 font-headline text-2xl font-semibold text-white">{completedCount} <span className="text-base text-fog-muted">of {courses.length}</span></p></div>
        </div>
      </header>

      <div className="mt-7 flex gap-2 overflow-x-auto pb-2" aria-label="Filter courses">{filters.map((item) => <button key={item.id} type="button" onClick={() => setFilter(item.id)} aria-pressed={filter === item.id} className={`min-h-11 shrink-0 rounded-full px-5 text-sm font-semibold transition-colors focus-ring ${filter === item.id ? "bg-primary-container text-on-primary-fixed" : "border border-surgical-steel text-on-surface-variant hover:border-primary-container hover:text-white"}`}>{item.label}</button>)}</div>

      <section className="mt-5 grid gap-4 lg:grid-cols-2" aria-label="Available courses">
        {visibleCourses.map((course) => <CourseRow key={course.id} course={course} routeBase={routeBase} pending={pending} onEnroll={() => { setSelectedCourse(course); setMessage(null); }} />)}
        {!visibleCourses.length && <p className="rounded-xl border border-surgical-steel px-5 py-14 text-center text-sm text-fog-muted">No courses match this filter yet.</p>}
      </section>
    </main>

    {selectedCourse && <div role="dialog" aria-modal="true" aria-label={`Enroll in ${selectedCourse.title}`} className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onMouseDown={() => setSelectedCourse(null)}><section className="w-full max-w-lg rounded-xl border border-surgical-steel bg-monolith-surface p-6" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-5"><div><p className="terminal-label">Start tracking</p><h2 className="mt-2 font-headline text-2xl font-semibold text-white">{selectedCourse.title}</h2></div><button type="button" onClick={() => setSelectedCourse(null)} aria-label="Close" className="grid size-11 place-items-center rounded-full text-fog-muted hover:bg-surface-container-high hover:text-white"><X size={18} /></button></div><p className="mt-4 text-sm leading-relaxed text-on-surface-variant">Enrollment adds this course to your dashboard and records progress. The course remains viewable even before enrollment.</p><dl className="mt-6 grid grid-cols-2 divide-x divide-surgical-steel border-y border-surgical-steel py-4 text-center"><div><dt className="text-xs text-fog-muted">Lessons</dt><dd className="mt-1 text-sm font-semibold text-white">{selectedCourse.videos.length}</dd></div><div><dt className="text-xs text-fog-muted">Study time</dt><dd className="mt-1 text-sm font-semibold text-white">{duration(selectedCourse.videos)}</dd></div></dl>{message && <p role="status" className={`mt-5 rounded-lg border p-3 text-sm ${message.startsWith("You’re") ? "border-primary-container/40 bg-primary-container/10 text-primary-container" : "border-red-500/40 bg-red-500/10 text-red-300"}`}>{message}</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><Link href={withRouteBase(routeBase, `/courses/${selectedCourse.id}`)} className="inline-flex min-h-11 items-center rounded-full border border-surgical-steel px-5 text-sm font-semibold text-on-surface-variant hover:border-primary-container hover:text-white">View course</Link>{message?.startsWith("You’re") ? <Link href={withRouteBase(routeBase, `/courses/${selectedCourse.id}`)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-container px-5 text-sm font-semibold text-on-primary-fixed">Start learning <ChevronRight size={15} /></Link> : <button type="button" disabled={pending} onClick={enroll} className="min-h-11 rounded-full bg-primary-container px-5 text-sm font-semibold text-on-primary-fixed disabled:opacity-50">{pending ? "Enrolling…" : "Enroll in course"}</button>}</div></section></div>}
  </AppShell>;
}

function CourseRow({ course, routeBase, pending, onEnroll }: { course: CourseCard; routeBase: string; pending: boolean; onEnroll: () => void }) {
  const Icon = course.isCompleted ? CheckCircle2 : CirclePlay;
  return <article className={`grid gap-5 rounded-xl border p-5 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:items-center ${course.isEnrolled && !course.isCompleted ? "border-primary-container/45 bg-primary-container/[0.035]" : "border-surgical-steel bg-surface-container-low/70 hover:border-primary-container/50"}`}><div className="flex min-h-20 flex-col justify-between rounded-lg border border-surgical-steel bg-surface-container-lowest p-3 text-primary-container"><Icon size={19} /><span className="text-xs text-fog-muted">{course.videos.length} lessons</span></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-3 text-xs text-fog-muted"><span className="font-semibold text-primary-container">{course.isCompleted ? "Completed" : course.isEnrolled ? "In progress" : "Available"}</span><span className="inline-flex items-center gap-1.5"><Clock3 size={13} />{duration(course.videos)}</span><span className="inline-flex items-center gap-1.5"><Users size={13} />{course.enrollmentCount} studying</span></div><h2 className="mt-2 font-headline text-xl font-semibold text-white">{course.title}</h2><p className="mt-2 text-sm leading-relaxed text-on-surface-variant line-clamp-2">{course.description || "A focused sequence of Stoic lessons ready to study."}</p>{course.isEnrolled && <div className="mt-4 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container-highest"><div className="h-full rounded-full bg-primary-container" style={{ width: `${course.progressPercent}%` }} /></div><span className="text-xs font-semibold text-primary-container">{course.progressPercent}%</span></div>}</div><div className="flex flex-col gap-2 sm:items-end"><Link href={withRouteBase(routeBase, `/courses/${course.id}`)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary-container px-4 text-xs font-semibold uppercase tracking-wider text-primary-container hover:bg-primary-container/10">View <ChevronRight size={14} /></Link>{!course.isEnrolled && <button type="button" disabled={pending} onClick={onEnroll} className="min-h-10 rounded-full px-4 text-xs font-semibold text-fog-muted hover:text-white disabled:opacity-50">Enroll</button>}</div></article>;
}
