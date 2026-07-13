"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, ChevronRight, Clock, GraduationCap, Lock, PlayCircle, Plus } from "lucide-react";

import { addLesson } from "@/app/courses/actions";
import { AppShell } from "@/components/layout/AppShell";
import type { LearningPathData, TierProgressItem } from "@/components/courses/LearningPathView";
import { withRouteBase } from "@/lib/navigation/paths";

type FilterType = "all" | "in-progress" | "available" | "completed" | "locked";

export function CreatorCoursesView({ data }: { data: LearningPathData }) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submitLesson = (formData: FormData) => startTransition(async () => {
    const result = await addLesson(formData);
    setMessage(result.error ?? "Lesson created. Published lessons are now visible to members.");
    if (result.success) setIsAddingLesson(false);
  });

  const allLessons = useMemo(() => {
    return data.tiers.flatMap((tier) =>
      tier.lessons.map((lesson) => ({
        ...lesson,
        tierLevel: tier.level,
        tierTitle: tier.title,
      })),
    );
  }, [data.tiers]);

  const filteredLessons = useMemo(() => {
    return allLessons.filter((lesson) => {
      if (filter === "all") return true;
      if (filter === "completed") return lesson.isCompleted;
      if (filter === "locked") return lesson.isLocked;
      if (filter === "in-progress") return !lesson.isCompleted && !lesson.isLocked && lesson.completionPercentage > 0;
      if (filter === "available") return !lesson.isCompleted && !lesson.isLocked && lesson.completionPercentage === 0;
      return true;
    });
  }, [allLessons, filter]);

  const overallProgress = useMemo(() => {
    const total = allLessons.length;
    if (total === 0) return 0;
    const completed = allLessons.filter((lesson) => lesson.isCompleted).length;
    return Math.round((completed / total) * 100);
  }, [allLessons]);

  const activeTier = useMemo(() => (data.isMaster ? 5 : data.currentTier), [data.isMaster, data.currentTier]);

  return (
    <AppShell
      active="Learning"
      title="Creator Curriculum"
      isMaster={data.isMaster}
      memberName={data.memberName}
      platformRole={data.platformRole}
      currentTier={data.currentTier}
      routeBase="/creator"
    >
      <div className="mx-auto max-w-[1440px] space-y-8 px-4 py-8 md:px-8">
        <header className="flex flex-col justify-between gap-6 border-b border-surgical-steel pb-6 md:flex-row md:items-end">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-white">Creator Curriculum</h2>
            <p className="mt-2 max-w-lg font-body text-sm text-on-surface-variant">
              Manage the member learning path from a dedicated creator workspace without exposing these controls on user routes.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 md:w-80">
            <button
              type="button"
              onClick={() => setIsAddingLesson(true)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary-container px-5 font-label text-xs font-semibold uppercase tracking-wider text-on-primary-fixed transition hover:brightness-110"
            >
              <Plus size={16} />
              Add lesson
            </button>
            <div className="space-y-2">
              <div className="flex items-end justify-between">
                <span className="font-label text-label-sm uppercase tracking-wider text-on-surface-variant">Overall Progress</span>
                <span className="font-label text-label-sm font-semibold text-primary-container">{overallProgress}% Mastery</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full border border-surgical-steel bg-surface-container-high">
                <div className="emerald-glow h-full rounded-full bg-primary-container transition-all duration-500" style={{ width: `${overallProgress}%` }} />
              </div>
            </div>
          </div>
        </header>

        {message && (
          <div role="status" className="flex items-center justify-between gap-4 border border-primary-container/50 bg-primary-container/10 px-4 py-3 font-body text-sm text-on-surface">
            <span>{message}</span>
            <button className="font-label text-xs text-primary-container hover:text-white" onClick={() => setMessage(null)}>
              Dismiss
            </button>
          </div>
        )}

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {data.tiers.map((tier) => {
            const isCompleted = tier.completedCount === tier.totalCount && tier.totalCount > 0;
            const isActive = activeTier === tier.level;

            return (
              <div
                key={tier.level}
                className={`relative flex min-h-[140px] flex-col justify-between rounded border p-5 transition-all duration-300 ${tier.isLocked ? "border-surgical-steel/40 bg-surface-container-low/40 opacity-50" : isActive ? "emerald-glow ring-1 ring-primary-container/20 border-primary-container/50 bg-monolith-surface" : "border-surgical-steel bg-monolith-surface hover:border-primary-container/30"}`}
              >
                <div className="mb-4 flex items-start justify-between">
                  <span className="font-label text-xs font-semibold uppercase tracking-wider text-primary-container">Tier 0{tier.level}</span>
                  {tier.isLocked ? (
                    <Lock size={16} className="text-fog-muted" />
                  ) : isCompleted ? (
                    <span className="rounded bg-primary-container/10 px-2 py-0.5 font-label text-xs text-primary-container">COMPLETE</span>
                  ) : isActive ? (
                    <span className="rounded bg-primary-container/20 px-2 py-0.5 font-label text-xs font-bold text-primary-container">ACTIVE</span>
                  ) : (
                    <span className="font-label text-xs text-fog-muted">{tier.completedCount}/{tier.totalCount} Lessons</span>
                  )}
                </div>
                <div>
                  <h3 className="mb-1 font-headline text-lg font-bold text-white">{tier.title}</h3>
                  <p className="line-clamp-2 font-body text-xs text-on-surface-variant">{tier.description}</p>
                </div>
                {!tier.isLocked && <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-primary-container to-transparent" />}
              </div>
            );
          })}
        </section>

        <div className="flex flex-wrap items-center gap-2 border-b border-surgical-steel pb-4">
          {(["all", "in-progress", "available", "completed", "locked"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={`rounded-full px-4 py-1.5 font-label text-xs uppercase tracking-wider transition ${filter === option ? "border border-primary-container bg-primary-container text-on-primary-fixed" : "border border-transparent bg-transparent text-on-surface-variant hover:border-surgical-steel hover:text-white"}`}
            >
              {option.replace("-", " ")}
            </button>
          ))}
        </div>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {filteredLessons.map((lesson) => {
            const inProgress = !lesson.isCompleted && !lesson.isLocked && lesson.completionPercentage > 0;
            const isCompleted = lesson.isCompleted;
            const isLocked = lesson.isLocked;

            return (
              <div
                key={lesson.id}
                className={`flex flex-col gap-5 rounded border p-5 transition-all duration-300 md:flex-row ${isLocked ? "border-surgical-steel/40 bg-surface-container-low/40 opacity-40" : "border-surgical-steel bg-monolith-surface hover:border-primary-container/40"}`}
              >
                <div className="group relative flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded border border-surgical-steel bg-surface-container-lowest md:h-28 md:w-36 md:aspect-auto">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-container/10 to-transparent transition-opacity group-hover:opacity-100" />
                  {isLocked ? <Lock size={32} className="z-10 text-fog-muted" /> : isCompleted ? <CheckCircle2 size={32} className="z-10 text-primary-container" /> : <PlayCircle size={32} className="z-10 text-primary-container opacity-80 transition group-hover:scale-110" />}
                  {inProgress && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-surface-container-high">
                      <div className="h-full bg-primary-container" style={{ width: `${lesson.completionPercentage}%` }} />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between space-y-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-surgical-steel bg-surface-container-high px-2 py-0.5 font-label text-[10px] text-fog-muted">T0{lesson.tierLevel}</span>
                        {isLocked ? (
                          <span className="font-label text-[10px] uppercase tracking-wider text-fog-muted">LOCKED</span>
                        ) : isCompleted ? (
                          <span className="font-label text-[10px] font-bold uppercase tracking-wider text-primary-container">COMPLETED</span>
                        ) : inProgress ? (
                          <span className="rounded bg-primary-container/10 px-2 py-0.5 font-label text-[10px] uppercase tracking-wider text-primary-container">IN PROGRESS</span>
                        ) : (
                          <span className="rounded bg-secondary/10 px-2 py-0.5 font-label text-[10px] uppercase tracking-wider text-secondary">AVAILABLE</span>
                        )}
                      </div>
                      {lesson.duration && (
                        <div className="flex items-center gap-1 font-label text-xs text-fog-muted">
                          <Clock size={12} />
                          <span>{lesson.duration}m</span>
                        </div>
                      )}
                    </div>
                    <h2 className="mt-2 font-headline text-base font-bold text-white">{lesson.title}</h2>
                    <p className="font-body text-sm text-on-surface-variant">{lesson.description}</p>
                  </div>

                  {!isLocked && (
                    <div className="pt-2">
                      <Link
                        href={withRouteBase("/creator", `/courses/lesson/${lesson.id}`)}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-label text-xs uppercase tracking-wider transition ${isCompleted ? "border border-surgical-steel text-on-surface-variant hover:border-primary-container/50 hover:text-white" : inProgress ? "bg-primary-container text-on-primary-fixed hover:bg-opacity-90" : "border border-primary-container text-primary-container hover:bg-primary-container/10"}`}
                      >
                        {isCompleted ? "Review" : inProgress ? "Resume" : "Start"}
                        <ChevronRight size={14} />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filteredLessons.length === 0 && (
            <div className="col-span-full rounded border border-dashed border-surgical-steel bg-surface-container-low/20 py-16 text-center">
              <GraduationCap size={48} className="mx-auto mb-4 text-fog-muted" />
              <p className="font-headline text-lg font-semibold text-white">No lessons found</p>
              <p className="mt-1 font-body text-sm text-on-surface-variant">Try changing your filter options above.</p>
            </div>
          )}
        </section>
      </div>
      {isAddingLesson && <AddLessonDialog tiers={data.tiers} pending={isPending} onClose={() => setIsAddingLesson(false)} onSubmit={submitLesson} />}
    </AppShell>
  );
}

function AddLessonDialog({ tiers, pending, onClose, onSubmit }: { tiers: TierProgressItem[]; pending: boolean; onClose: () => void; onSubmit: (formData: FormData) => void }) {
  const input = "h-10 border border-surgical-steel bg-surface-container-low px-3 font-body text-sm text-white outline-none placeholder:text-fog-muted focus:border-primary-container";
  return <div role="dialog" aria-modal="true" aria-labelledby="add-lesson-title" className="fixed inset-0 z-50 grid place-items-center bg-surface-container-lowest/85 p-4" onMouseDown={onClose}><form action={onSubmit} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-xl rounded-lg border border-surgical-steel bg-monolith-surface"><div className="border-b border-surgical-steel bg-surface-container-high px-5 py-4"><p className="font-label text-xs text-primary-container">CURRICULUM CONTROL</p><h2 id="add-lesson-title" className="mt-1 font-headline text-lg font-semibold text-white">Add lesson</h2></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="grid gap-1.5 sm:col-span-2"><span className="font-label text-xs text-fog-muted">Lesson title</span><input className={input} name="title" required /></label><label className="grid gap-1.5"><span className="font-label text-xs text-fog-muted">Tier</span><select className={input} name="tierId" required>{tiers.map((tier) => <option key={tier.id} value={tier.id}>Tier {tier.level}: {tier.title}</option>)}</select></label><label className="grid gap-1.5"><span className="font-label text-xs text-fog-muted">Status</span><select className={input} name="status" defaultValue="draft"><option value="draft">Draft</option><option value="published">Published</option></select></label><label className="grid gap-1.5 sm:col-span-2"><span className="font-label text-xs text-fog-muted">Google Drive file ID</span><input className={input} name="videoFileId" placeholder="File ID only, not a sharing URL" required /></label><label className="grid gap-1.5"><span className="font-label text-xs text-fog-muted">Duration (seconds)</span><input className={input} name="durationSeconds" type="number" min="0" defaultValue="0" required /></label><label className="grid gap-1.5"><span className="font-label text-xs text-fog-muted">Order</span><input className={input} name="sortOrder" type="number" min="0" defaultValue="0" required /></label><label className="grid gap-1.5 sm:col-span-2"><span className="font-label text-xs text-fog-muted">Description</span><textarea className={input} name="description" rows={3} /></label></div><div className="flex justify-end gap-3 border-t border-surgical-steel px-5 py-4"><button type="button" onClick={onClose} className="min-h-10 px-3 font-label text-xs text-fog-muted hover:text-white">Cancel</button><button disabled={pending} className="min-h-10 rounded-full bg-primary-container px-5 font-label text-xs font-semibold uppercase tracking-wider text-on-primary-fixed disabled:opacity-60">{pending ? "Saving…" : "Save lesson"}</button></div></form></div>;
}
