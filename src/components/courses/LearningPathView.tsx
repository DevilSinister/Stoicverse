"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, Clock, GraduationCap, Lock, PlayCircle } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { buttonVariants } from "@/components/ui/button";
import { withRouteBase } from "@/lib/navigation/paths";

/**
 * The curriculum path. Monolith, phase 8.
 *
 * **Two controls turned invisible on hover**, both spelled
 * `hover:text-accent-contrast`: the filter row and a completed lesson's Review
 * link. That token is the near-black that belongs *on* the lime accent, so over
 * this page's own ground it painted the label black on near-black. The fourth
 * and fifth sightings of the same token family — see the design note.
 *
 * **The decoration is gone rather than restyled.** Two `bg-gradient-to-*`
 * washes, a `ring-1` glow and three `emerald-glow` shadows were carrying no
 * information: Monolith spends colour on state only, and every one of these sat
 * on a card whose state was already said in words beside it. A tier's status is
 * a label and a rule, not a halo.
 *
 * **`transition-all duration-300` on cards was animating layout.** Cards whose
 * border colour changes on hover now transition `colors` only.
 */

export type LessonProgressItem = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  duration: number | null;
  isCompleted: boolean;
  completionPercentage: number;
  isLocked: boolean;
  isUpcoming: boolean;
};

export type TierProgressItem = {
  id: string;
  level: number;
  title: string;
  description: string | null;
  lessons: LessonProgressItem[];
  isLocked: boolean;
  completedCount: number;
  totalCount: number;
};

export type LearningPathData = {
  memberName: string;
  platformRole: string;
  currentTier: number;
  isMaster: boolean;
  tiers: TierProgressItem[];
};

type FilterType = "all" | "in-progress" | "available" | "completed" | "locked";

const FILTERS: FilterType[] = ["all", "in-progress", "available", "completed", "locked"];

export function LearningPathView({ data, routeBase = "" }: { data: LearningPathData; routeBase?: string }) {
  const [filter, setFilter] = useState<FilterType>("all");

  const allLessons = useMemo(
    () =>
      data.tiers.flatMap((tier) =>
        tier.lessons.map((lesson) => ({ ...lesson, tierLevel: tier.level, tierTitle: tier.title })),
      ),
    [data.tiers],
  );

  const filteredLessons = useMemo(
    () =>
      allLessons.filter((lesson) => {
        if (filter === "all") return true;
        if (filter === "completed") return lesson.isCompleted;
        if (filter === "locked") return lesson.isLocked;
        if (filter === "in-progress") return !lesson.isCompleted && !lesson.isLocked && lesson.completionPercentage > 0;
        if (filter === "available") return !lesson.isCompleted && !lesson.isLocked && lesson.completionPercentage === 0;
        return true;
      }),
    [allLessons, filter],
  );

  const overallProgress = useMemo(() => {
    const total = allLessons.length;
    if (total === 0) return 0;
    return Math.round((allLessons.filter((lesson) => lesson.isCompleted).length / total) * 100);
  }, [allLessons]);

  const activeTier = useMemo(() => (data.isMaster ? 5 : data.currentTier), [data.isMaster, data.currentTier]);

  return (
    <AppShell
      active="Learning"
      title="Learning path"
      isMaster={data.isMaster}
      memberName={data.memberName}
      platformRole={data.platformRole}
      currentTier={data.currentTier}
      routeBase={routeBase}
    >
      <div className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <header className="flex flex-col justify-between gap-6 border-b border-border-hairline pb-7 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="terminal-label text-text-faint">Member curriculum</p>
            <h1 className="mt-3 text-title-lg font-medium text-text-strong">Curriculum path</h1>
            <p className="mt-3 text-content-base text-text-default">
              A rigorous curriculum designed for disciplined capital management and psychological fortitude.
            </p>
          </div>
          <div className="w-full md:w-80">
            <div className="flex items-end justify-between">
              <span className="terminal-label text-text-faint">Overall progress</span>
              <span className="font-mono text-mono-sm text-primary tabular-nums">{overallProgress}% mastery</span>
            </div>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-sm bg-surface-sunken"
              role="progressbar"
              aria-label="Overall curriculum progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={overallProgress}
            >
              <div
                className="h-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </header>

        <section className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.tiers.map((tier) => {
            const isCompleted = tier.completedCount === tier.totalCount && tier.totalCount > 0;
            const isActive = activeTier === tier.level;

            return (
              <div
                key={tier.level}
                className={`relative flex min-h-[140px] flex-col justify-between overflow-hidden rounded-lg border p-5 transition-colors ${
                  tier.isLocked
                    ? "border-border-hairline bg-surface-panel opacity-50"
                    : isActive
                      ? "border-primary/50 bg-surface-panel"
                      : "border-border-hairline bg-surface-panel hover:border-border-strong"
                }`}
              >
                {/* The active tier is marked by the same 2px rule the rail uses,
                    which replaces a gradient that ran across every unlocked card
                    and therefore distinguished nothing. */}
                {isActive && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}

                <div className="mb-4 flex items-start justify-between gap-3">
                  <span className="terminal-label text-text-faint">Tier 0{tier.level}</span>
                  {tier.isLocked ? (
                    <Lock size={15} className="shrink-0 text-text-faint" />
                  ) : isCompleted ? (
                    <span className="font-mono text-mono-xs text-status-ok uppercase">Complete</span>
                  ) : isActive ? (
                    <span className="font-mono text-mono-xs text-primary uppercase">Active</span>
                  ) : (
                    <span className="font-mono text-mono-xs text-text-muted tabular-nums">
                      {tier.completedCount}/{tier.totalCount}
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="text-title-sm font-medium text-text-strong">{tier.title}</h2>
                  <p className="mt-1 line-clamp-2 text-content-sm text-text-muted">{tier.description}</p>
                </div>
              </div>
            );
          })}
        </section>

        {/* Ruled tabs, not pills — and hovering an unselected one no longer
            paints its label in the colour reserved for an accent fill. */}
        <div className="mt-7 flex gap-1 overflow-x-auto border-b border-border-hairline" aria-label="Filter lessons">
          {FILTERS.map((option) => {
            const selected = filter === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                aria-pressed={selected}
                className={`focus-ring relative inline-flex min-h-11 shrink-0 items-center px-4 text-content-sm capitalize transition-colors ${
                  selected ? "text-text-strong" : "text-text-muted hover:text-text-strong"
                }`}
              >
                {option.replace("-", " ")}
                {selected && <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 bg-primary" />}
              </button>
            );
          })}
        </div>

        <section className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredLessons.map((lesson) => {
            const inProgress = !lesson.isCompleted && !lesson.isLocked && lesson.completionPercentage > 0;

            return (
              <div
                key={lesson.id}
                className={`flex flex-col gap-5 rounded-lg border p-5 transition-colors md:flex-row ${
                  lesson.isLocked
                    ? "border-border-hairline bg-surface-panel opacity-40"
                    : "border-border-hairline bg-surface-panel hover:border-border-strong"
                }`}
              >
                <div className="relative flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-md border border-border-hairline bg-surface-sunken md:aspect-auto md:h-28 md:w-36">
                  {lesson.isLocked ? (
                    <Lock size={28} className="text-text-faint" />
                  ) : lesson.isCompleted ? (
                    <CheckCircle2 size={28} className="text-status-ok" />
                  ) : (
                    <PlayCircle size={28} className="text-primary" />
                  )}
                  {inProgress && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-surface-raised">
                      <div className="h-full bg-primary" style={{ width: `${lesson.completionPercentage}%` }} />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-sm border border-border-hairline px-1.5 font-mono text-mono-xs text-text-muted">
                          T0{lesson.tierLevel}
                        </span>
                        <span
                          className={`font-mono text-mono-xs uppercase ${
                            lesson.isLocked
                              ? "text-text-faint"
                              : lesson.isCompleted
                                ? "text-status-ok"
                                : inProgress
                                  ? "text-primary"
                                  : "text-text-muted"
                          }`}
                        >
                          {lesson.isLocked
                            ? "Locked"
                            : lesson.isCompleted
                              ? "Completed"
                              : inProgress
                                ? "In progress"
                                : "Available"}
                        </span>
                      </div>
                      {lesson.duration && (
                        <span className="inline-flex items-center gap-1 font-mono text-mono-xs text-text-muted tabular-nums">
                          <Clock size={12} />
                          {lesson.duration}m
                        </span>
                      )}
                    </div>
                    <h2 className="mt-2 text-title-sm font-medium text-text-strong">{lesson.title}</h2>
                    <p className="mt-1 text-content-sm text-text-default">{lesson.description}</p>
                  </div>

                  {!lesson.isLocked && (
                    <div>
                      <Link
                        href={withRouteBase(routeBase, `/courses/lesson/${lesson.id}`)}
                        className={buttonVariants({ variant: inProgress ? "default" : "outline" })}
                      >
                        {lesson.isCompleted ? "Review" : inProgress ? "Resume" : "Start"}
                        <ChevronRight size={14} />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filteredLessons.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-border-hairline py-16 text-center">
              <GraduationCap size={40} className="mx-auto text-text-faint" />
              <p className="mt-4 text-title-sm font-medium text-text-strong">No lessons found</p>
              <p className="mt-1 text-content-sm text-text-muted">Try changing your filter options above.</p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
