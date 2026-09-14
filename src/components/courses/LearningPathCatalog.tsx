"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, ChevronRight, CirclePlay, Clock3, Users } from "lucide-react";

import { enrollInCourse } from "@/app/courses/actions";
import { AppShell } from "@/components/layout/AppShell";
import type { CourseCard } from "@/components/courses/CourseCatalog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Overlay,
  OverlayBody,
  OverlayContent,
  OverlayDescription,
  OverlayFooter,
  OverlayHeader,
  OverlayTitle,
} from "@/components/ui/overlay";
import { withRouteBase } from "@/lib/navigation/paths";

/**
 * The course library. Monolith, phase 8.
 *
 * **The enrollment dialog was hand-rolled, and Escape did not close it.** It
 * was a `fixed inset-0 z-50` box dismissed only by `onMouseDown` on its own
 * backdrop: no focus trap, no focus restore, no scroll lock, no Escape, and a
 * raw `z-50` that is not on the project's z-scale. It is `ui/overlay` now,
 * which owns all five, and the hand-rolled overlay count drops by one.
 *
 * **The filter pills turned invisible on hover.** `hover:text-accent-contrast`
 * is the near-black meant to sit *on* the lime accent; over the page's own
 * ground it painted the label black on near-black. Same defect as the
 * notification tabs in phase 6, and the fourth sighting of this token family.
 *
 * **A progress track was painting nothing.** `bg-surface-container-highest` is
 * not a defined token — the scale stops at `-high` — so the groove behind the
 * bar had no background at all.
 */

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

export function LearningPathCatalog({
  courses,
  memberName,
  platformRole,
  currentTier,
  isMaster,
  routeBase = "",
}: {
  courses: CourseCard[];
  memberName: string;
  platformRole: string;
  currentTier: number;
  isMaster: boolean;
  routeBase?: string;
}) {
  const [filter, setFilter] = useState<CourseFilter>("all");
  const [selectedCourse, setSelectedCourse] = useState<CourseCard | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visibleCourses = useMemo(
    () =>
      courses.filter(
        (course) =>
          filter === "all" ||
          (filter === "active" && course.isEnrolled && !course.isCompleted) ||
          (filter === "completed" && course.isCompleted),
      ),
    [courses, filter],
  );
  const completedCount = courses.filter((course) => course.isCompleted).length;
  const enrolled = message?.startsWith("You’re") ?? false;

  const enroll = () => {
    if (!selectedCourse) return;
    startTransition(async () => {
      const result = await enrollInCourse(selectedCourse.id);
      setMessage(result.error ?? "You’re enrolled. Every released lesson is ready to watch.");
    });
  };

  return (
    <AppShell
      active="Courses"
      title="Course library"
      terminalHeader
      memberName={memberName}
      platformRole={platformRole}
      currentTier={currentTier}
      isMaster={isMaster}
      routeBase={routeBase}
    >
      <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <header className="border-b border-border-hairline pb-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="terminal-label text-text-faint">Member curriculum</p>
              <h1 className="mt-3 text-title-lg font-medium text-text-strong">Course library</h1>
              <p className="mt-3 text-content-base text-text-default">
                Every published course is available to active members. Choose any subject, watch released lessons in any
                order, and keep your progress in one place.
              </p>
            </div>
            <div className="border-l border-border-hairline pl-5">
              <p className="terminal-label text-text-faint">Completed</p>
              <p className="mt-2 font-mono text-title-md text-text-strong tabular-nums">
                {completedCount} <span className="text-content-base text-text-muted">of {courses.length}</span>
              </p>
            </div>
          </div>
        </header>

        {/* A ruled row, not pills — and `hover:text-text-strong`, because the
            colour this used to hover to is the one meant for an accent fill. */}
        <div className="flex gap-1 overflow-x-auto border-b border-border-hairline" aria-label="Filter courses">
          {filters.map((item) => {
            const selected = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                aria-pressed={selected}
                className={`focus-ring relative inline-flex min-h-11 shrink-0 items-center px-4 text-content-sm transition-colors ${
                  selected ? "text-text-strong" : "text-text-muted hover:text-text-strong"
                }`}
              >
                {item.label}
                {selected && <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 bg-primary" />}
              </button>
            );
          })}
        </div>

        <section className="mt-5 grid gap-4 lg:grid-cols-2" aria-label="Available courses">
          {visibleCourses.map((course) => (
            <CourseRow
              key={course.id}
              course={course}
              routeBase={routeBase}
              pending={pending}
              onEnroll={() => {
                setSelectedCourse(course);
                setMessage(null);
              }}
            />
          ))}
          {!visibleCourses.length && (
            <p className="rounded-lg border border-border-hairline px-5 py-14 text-center text-content-sm text-text-muted">
              No courses match this filter yet.
            </p>
          )}
        </section>
      </main>

      <Overlay
        open={selectedCourse !== null}
        onOpenChange={(next) => {
          // An enrollment in flight is a write already on its way; closing over
          // it would drop the result the button is waiting to report.
          if (!next && !pending) setSelectedCourse(null);
        }}
      >
        <OverlayContent size="sm">
          <OverlayHeader>
            <p className="terminal-label text-text-faint">Start tracking</p>
            <OverlayTitle>{selectedCourse?.title ?? "Enroll"}</OverlayTitle>
            <OverlayDescription>
              Enrollment adds this course to your dashboard and records progress. The course remains viewable even
              before enrollment.
            </OverlayDescription>
          </OverlayHeader>

          <OverlayBody>
            <dl className="grid grid-cols-2 divide-x divide-border-hairline border-y border-border-hairline py-4 text-center">
              <div>
                <dt className="text-content-sm text-text-muted">Lessons</dt>
                <dd className="mt-1 font-mono text-content-base text-text-strong tabular-nums">
                  {selectedCourse?.videos.length ?? 0}
                </dd>
              </div>
              <div>
                <dt className="text-content-sm text-text-muted">Study time</dt>
                <dd className="mt-1 font-mono text-content-base text-text-strong tabular-nums">
                  {selectedCourse ? duration(selectedCourse.videos) : "—"}
                </dd>
              </div>
            </dl>
            {message && (
              <p
                role="status"
                className={`mt-5 rounded-lg border p-3 text-content-sm ${
                  enrolled
                    ? "border-status-ok/40 bg-status-ok/10 text-status-ok"
                    : "border-status-danger/40 bg-status-danger/10 text-status-danger"
                }`}
              >
                {message}
              </p>
            )}
          </OverlayBody>

          <OverlayFooter>
            <Link
              href={withRouteBase(routeBase, `/courses/${selectedCourse?.id ?? ""}`)}
              className={buttonVariants({ variant: "outline" })}
            >
              View course
            </Link>
            {enrolled ? (
              <Link
                href={withRouteBase(routeBase, `/courses/${selectedCourse?.id ?? ""}`)}
                className={buttonVariants()}
              >
                Start learning
                <ChevronRight size={15} />
              </Link>
            ) : (
              <Button disabled={pending} onClick={enroll}>
                {pending ? "Enrolling…" : "Enroll in course"}
              </Button>
            )}
          </OverlayFooter>
        </OverlayContent>
      </Overlay>
    </AppShell>
  );
}

function CourseRow({
  course,
  routeBase,
  pending,
  onEnroll,
}: {
  course: CourseCard;
  routeBase: string;
  pending: boolean;
  onEnroll: () => void;
}) {
  const Icon = course.isCompleted ? CheckCircle2 : CirclePlay;
  const inProgress = course.isEnrolled && !course.isCompleted;

  return (
    <article
      className={`grid gap-5 rounded-lg border p-5 transition-colors sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:items-center ${
        inProgress
          ? "border-primary/40 bg-surface-panel"
          : "border-border-hairline bg-surface-panel hover:border-border-strong"
      }`}
    >
      <div className="flex min-h-20 flex-col justify-between rounded-md border border-border-hairline bg-surface-sunken p-3 text-primary">
        <Icon size={19} />
        <span className="font-mono text-mono-xs text-text-muted tabular-nums">{course.videos.length} lessons</span>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3 font-mono text-mono-xs text-text-muted">
          <span className="text-primary">
            {course.isCompleted ? "Completed" : course.isEnrolled ? "In progress" : "Available"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={13} />
            {duration(course.videos)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users size={13} />
            {course.enrollmentCount} studying
          </span>
        </div>
        <h2 className="mt-2 text-title-sm font-medium text-text-strong">{course.title}</h2>
        <p className="mt-2 line-clamp-2 text-content-sm text-text-default">
          {course.description || "A focused sequence of Stoic lessons ready to study."}
        </p>
        {course.isEnrolled && (
          <div className="mt-4 flex items-center gap-3">
            {/* `surface-sunken`: `surface-container-highest` is not a token and
                this groove had no background at all. */}
            <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-surface-sunken">
              <div className="h-full bg-primary" style={{ width: `${course.progressPercent}%` }} />
            </div>
            <span className="font-mono text-mono-xs text-primary tabular-nums">{course.progressPercent}%</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:items-end">
        <Link
          href={withRouteBase(routeBase, `/courses/${course.id}`)}
          className={buttonVariants({ variant: "outline" })}
        >
          View
          <ChevronRight size={14} />
        </Link>
        {!course.isEnrolled && (
          <Button variant="ghost" disabled={pending} onClick={onEnroll}>
            Enroll
          </Button>
        )}
      </div>
    </article>
  );
}
