"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Play, Sparkles, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { withRouteBase } from "@/lib/navigation/paths";
import type { DashboardData } from "./DashboardView";

/**
 * The member dashboard. Monolith, phase 7.
 *
 * Two of the things this phase changed were not style choices.
 *
 * **`bg-surface-container-highest` does not exist.** The scale stops at
 * `-high`, so the class emitted no CSS at all and two surfaces — the course
 * preview panel and a progress track — were simply painting nothing. It is
 * invisible in review, the build is green, and the typechecker cannot see
 * inside a string. Both are `surface-sunken` now, which is what a recessed
 * groove under content is supposed to be.
 *
 * **The mentorship call to action was `bg-white`.** Monolith deleted 371 uses
 * of `text-white` because pure white on near-black is 20.4:1 and reads as
 * glare; a pure white *fill* is the same mistake from the other side, and it
 * was the only one of its kind in the product. It is the accent now, like every
 * other primary action.
 *
 * The file also stops being written as single-line JSX. It was six sections on
 * six lines, which is why the two defects above survived every reading of it.
 */

const eventDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export function TerminalDashboard({ data, routeBase = "" }: { data: DashboardData; routeBase?: string }) {
  const courseHref = (courseId?: string) => withRouteBase(routeBase, courseId ? `/courses/${courseId}` : "/courses");

  return (
    <AppShell
      active="Dashboard"
      title="Member overview"
      terminalHeader
      isMaster={data.isMaster}
      memberName={data.memberName}
      platformRole={data.platformRole}
      currentTier={data.currentTier}
      notifications={data.notifications}
      routeBase={routeBase}
    >
      <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <header className="mb-8">
          <p className="terminal-label text-text-faint">Member home</p>
          <h1 className="mt-3 text-title-lg font-medium text-text-strong">Welcome back, {data.memberName}</h1>
          <p className="mt-3 max-w-2xl text-content-base text-text-default">
            Your complete Stoic curriculum is open. Continue a course or choose any released lesson that fits today&rsquo;s
            practice.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-12">
          <section aria-label="Member turnover" className="lg:col-span-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <TurnoverMetricCard
                label="Turnover this week"
                value={currency.format(data.turnoverThisWeek)}
                detail="Current weekly figure"
              />
              <TurnoverMetricCard
                label="All-time turnover"
                value={currency.format(data.allTimeTurnover)}
                detail={
                  data.turnoverUpdatedAt
                    ? `Updated ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(data.turnoverUpdatedAt))}`
                    : "Lifetime reported figure"
                }
              />
            </div>
          </section>

          {/* The accent as a 2px rule, which is the rail's idiom for state. */}
          <section className="terminal-card border-t-2 border-t-primary p-6 lg:col-span-4">
            <p className="terminal-label text-primary">No learning gates</p>
            <h2 className="mt-3 text-title-sm font-medium text-text-strong">Study in your own order</h2>
            <p className="mt-2 text-content-sm text-text-muted">
              Course tiers and prerequisites no longer restrict what you can watch. Scheduled lessons appear when their
              release time arrives.
            </p>
          </section>

          <section className="terminal-card overflow-hidden lg:col-span-8 lg:grid lg:min-h-[315px] lg:grid-cols-2">
            <div className="flex flex-col justify-center p-7 sm:p-8">
              <p className="terminal-label text-text-faint">Continue learning</p>
              <h2 className="mt-3 text-title-md font-medium text-text-strong">
                {data.activeLesson?.title ?? "Choose your next course"}
              </h2>
              <p className="mt-4 text-content-sm text-text-default">
                {data.activeLesson?.description ??
                  "Browse the full library and begin with the subject most useful to your current practice."}
              </p>
              {data.activeLesson && (
                <p className="mt-4 font-mono text-mono-xs text-primary">
                  {data.activeLesson.completedVideos} / {data.activeLesson.totalVideos} lessons complete ·{" "}
                  {data.activeLesson.remainingMinutes} min remaining
                </p>
              )}
              <Button render={<Link href={courseHref(data.activeLesson?.id)} />} className="mt-7 w-fit">
                <Play size={14} fill="currentColor" />
                {data.activeLesson ? "Resume course" : "Browse courses"}
              </Button>
            </div>
            <CoursePreview
              progress={data.activeLesson?.progress ?? 0}
              title={data.activeLesson?.title ?? "Open curriculum"}
            />
          </section>

          <section className="terminal-card flex flex-col p-7 lg:col-span-4">
            <div className="flex items-center justify-between gap-3">
              <p className="terminal-label text-text-faint">Upcoming live</p>
              <span className="font-mono text-mono-xs text-primary">{data.upcomingEvent?.status ?? "Calendar"}</span>
            </div>
            {data.upcomingEvent ? (
              <>
                <div className="mt-7 flex-1">
                  <h2 className="text-title-sm font-medium text-text-strong">{data.upcomingEvent.title}</h2>
                  <p className="mt-3 text-content-sm text-text-default">
                    {data.upcomingEvent.description || "A live session for Stoicverse members."}
                  </p>
                  <p className="mt-5 flex items-center gap-2 font-mono text-mono-xs text-text-muted">
                    <Clock3 size={14} />
                    {eventDate(data.upcomingEvent.starts_at)}
                  </p>
                </div>
                <Button variant="outline" render={<Link href={withRouteBase(routeBase, "/events")} />} className="mt-7">
                  <CalendarDays size={15} />
                  View event
                </Button>
              </>
            ) : (
              <>
                <div className="mt-7 flex-1">
                  <h2 className="text-title-sm font-medium text-text-strong">No session scheduled</h2>
                  <p className="mt-3 text-content-sm text-text-default">
                    Visit the events directory as new live sessions are published.
                  </p>
                </div>
                <Button variant="outline" render={<Link href={withRouteBase(routeBase, "/events")} />} className="mt-7">
                  Browse calendar
                  <ArrowRight size={14} />
                </Button>
              </>
            )}
          </section>

          <section className="terminal-card overflow-hidden lg:col-span-7">
            <div className="flex flex-wrap items-end justify-between gap-4 px-6 py-5">
              <div>
                <h2 className="text-title-sm font-medium text-text-strong">Your courses</h2>
                <p className="mt-1 text-content-sm text-text-muted">Enrolled courses and saved progress.</p>
              </div>
              <Button variant="outline" render={<Link href={courseHref()} />}>
                All courses
                <ArrowRight size={14} />
              </Button>
            </div>
            <div className="divide-y divide-border-hairline border-t border-border-hairline">
              {data.enrolledCourses.slice(0, 3).map((course) => (
                <RecordedCourse key={course.id} course={course} href={courseHref(course.id)} />
              ))}
              {!data.enrolledCourses.length && (
                <p className="px-6 py-10 text-center text-content-sm text-text-muted">
                  Enroll from the course library to keep a course on your dashboard.
                </p>
              )}
            </div>
          </section>

          <section className="terminal-card relative flex min-h-[260px] flex-col items-center justify-center overflow-hidden p-7 text-center lg:col-span-5">
            <div aria-hidden className="absolute inset-0 bg-accent-soft opacity-40" />
            <div className="relative grid size-16 place-items-center rounded-lg border border-primary/30 bg-accent-soft text-primary">
              <Sparkles size={28} />
            </div>
            <h2 className="relative mt-6 text-title-sm font-medium text-text-strong">Elite mentorship</h2>
            <p className="relative mt-3 max-w-sm text-content-sm text-text-default">
              Accelerate your practice with personalised guidance and direct access to a Stoic mentor.
            </p>
            <Button render={<Link href={withRouteBase(routeBase, "/mentorship")} />} className="relative mt-6">
              Explore mentorship
            </Button>
          </section>
        </div>
      </main>
    </AppShell>
  );
}

function TurnoverMetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="terminal-card flex min-h-[10.5rem] flex-col justify-between p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="terminal-label text-text-faint">{label}</p>
        <TrendingUp size={18} className="shrink-0 text-text-muted" />
      </div>
      <div>
        {/* Money is measurement: mono, tabular, so digits do not shift width. */}
        <p className="font-mono text-[clamp(1.5rem,4vw,2.1rem)] leading-none font-medium tracking-[-0.02em] text-text-strong tabular-nums">
          {value}
        </p>
        <p className="mt-3 text-content-sm text-text-muted">{detail}</p>
      </div>
    </div>
  );
}

function CoursePreview({ progress, title }: { progress: number; title: string }) {
  return (
    // `surface-sunken`, not `surface-container-highest` — that class is not
    // defined anywhere and this panel had no background at all.
    <div className="relative min-h-[220px] overflow-hidden border-t border-border-hairline bg-surface-sunken lg:min-h-0 lg:border-t-0 lg:border-l">
      <div className="relative flex h-full min-h-[220px] flex-col justify-end p-7">
        <p className="terminal-label text-text-faint">Active course</p>
        <p className="mt-2 line-clamp-2 text-content-base font-medium text-text-strong">{title}</p>
        <div className="mt-5 h-1.5 overflow-hidden rounded-sm bg-surface-raised">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 font-mono text-mono-xs text-primary tabular-nums">{progress}% complete</p>
      </div>
    </div>
  );
}

function RecordedCourse({ course, href }: { course: DashboardData["enrolledCourses"][number]; href: string }) {
  return (
    <Link
      href={href}
      className="focus-ring group grid gap-3 px-6 py-5 transition-colors hover:bg-surface-raised/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div>
        <h3 className="text-content-base font-medium text-text-strong">{course.title}</h3>
        <p className="mt-1 text-content-sm text-text-muted">
          {course.isCompleted
            ? "Completed · ready to revisit"
            : `${course.completedVideos} of ${course.totalVideos} lessons complete · ${course.remainingMinutes} min remaining`}
        </p>
        <div className="mt-3 h-1.5 max-w-lg overflow-hidden rounded-sm bg-surface-sunken">
          <div className="h-full bg-primary" style={{ width: `${course.progress}%` }} />
        </div>
      </div>
      <span className="inline-flex items-center gap-2 font-mono text-mono-sm text-primary tabular-nums">
        {course.isCompleted && <CheckCircle2 size={15} />}
        {course.isCompleted ? "Review" : `${course.progress}%`}
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
