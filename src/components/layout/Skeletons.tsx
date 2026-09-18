/**
 * The loading states, one shape per kind of page.
 *
 * Two things were wrong with what these replace. The first is coverage: four
 * routes out of forty-nine had a `loading.tsx`, and a segment without one does
 * not navigate optimistically — the browser sits on the page you are leaving
 * for the whole server round trip with nothing to say for itself. That is the
 * second somebody spends wondering whether their click landed.
 *
 * The second is shape. The skeletons that did exist each drew a whole
 * `<main className="min-h-screen">`, chrome padding and all, because at the
 * time the chrome was inside the page and went away with it. The chrome
 * belongs to the layout now and stays put, so a skeleton draws only the
 * content — and it draws the content this particular route is about to show
 * rather than a generic grey page. A skeleton that does not match what arrives
 * is a second layout shift dressed up as a courtesy.
 *
 * Each carries `role="status"` with `aria-busy`, so the wait is announced once
 * instead of being read out as a screenful of empty boxes.
 */

import { Skeleton } from "@/components/ui/skeleton";

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10"
    >
      {children}
      <span className="sr-only">{label}</span>
    </div>
  );
}

function Heading() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div className="max-w-2xl">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-[min(32rem,80vw)]" />
      </div>
      <Skeleton className="h-11 w-40 rounded-md" />
    </div>
  );
}

function Metric() {
  return (
    <section className="terminal-card min-h-36 p-6">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-7 h-8 w-3/5" />
      <Skeleton className="mt-3 h-3 w-2/5" />
    </section>
  );
}

/** A metric strip over a chart and a side column — both workspace overviews. */
export function OverviewSkeleton({ label }: { label: string }) {
  return (
    <Frame label={label}>
      <Heading />
      <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Metric />
        <Metric />
        <Metric />
        <Metric />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.9fr)]">
        <section className="terminal-card p-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-7 h-64 w-full" />
        </section>
        <section className="terminal-card p-6">
          <Skeleton className="h-4 w-28" />
          <div className="mt-7 space-y-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-4/5" />
          </div>
        </section>
      </div>
    </Frame>
  );
}

/** Filter pills, a metric strip, one wide chart — analytics and revenue. */
export function ChartWorkspaceSkeleton({ label }: { label: string }) {
  return (
    <Frame label={label}>
      <Heading />
      <div className="mt-7 flex flex-wrap gap-3">
        <Skeleton className="h-10 w-32 rounded-md" />
        <Skeleton className="h-10 w-28 rounded-md" />
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Metric />
        <Metric />
        <Metric />
        <Metric />
      </div>
      <section className="terminal-card mt-6 p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-7 h-80 w-full" />
      </section>
    </Frame>
  );
}

/** Search, a filter, then rows — the member registry and turnover. */
export function TableSkeleton({ label }: { label: string }) {
  return (
    <Frame label={label}>
      <Heading />
      <div className="mt-7 flex flex-wrap gap-3">
        <Skeleton className="h-11 w-[min(22rem,70vw)] rounded-md" />
        <Skeleton className="h-11 w-32 rounded-md" />
      </div>
      <section className="terminal-card mt-6 overflow-hidden">
        <div className="border-b border-border-hairline p-4">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="divide-y divide-border-hairline">
          {Array.from({ length: 8 }, (_, row) => (
            <div key={row} className="flex items-center gap-4 p-4">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="mt-2 h-3 w-56 max-w-full" />
              </div>
              <Skeleton className="hidden h-6 w-20 rounded-md sm:block" />
              <Skeleton className="hidden h-6 w-24 rounded-md lg:block" />
            </div>
          ))}
        </div>
      </section>
    </Frame>
  );
}

/** A responsive grid of cards — courses, events, tiers. */
export function CardGridSkeleton({ label }: { label: string }) {
  return (
    <Frame label={label}>
      <Heading />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, card) => (
          <section key={card} className="terminal-card overflow-hidden">
            <Skeleton className="h-36 w-full rounded-none" />
            <div className="p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-4 h-5 w-4/5" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-3/5" />
              <Skeleton className="mt-6 h-10 w-32 rounded-md" />
            </div>
          </section>
        ))}
      </div>
    </Frame>
  );
}

/** A section rail beside a form — account settings and community settings. */
export function SettingsSkeleton({ label }: { label: string }) {
  return (
    <Frame label={label}>
      <Heading />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(12rem,15rem)_minmax(0,1fr)]">
        <nav className="space-y-2" aria-hidden="true">
          {Array.from({ length: 6 }, (_, item) => (
            <Skeleton key={item} className="h-10 w-full" />
          ))}
        </nav>
        <section className="terminal-card p-6">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-3 h-3 w-[min(28rem,80vw)]" />
          <div className="mt-8 space-y-6">
            {Array.from({ length: 4 }, (_, field) => (
              <div key={field}>
                <Skeleton className="h-3 w-28" />
                <Skeleton className="mt-2 h-11 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-8 h-11 w-36 rounded-md" />
        </section>
      </div>
    </Frame>
  );
}

/** A single column of entries — notifications, the master feed. */
export function FeedSkeleton({ label }: { label: string }) {
  return (
    <Frame label={label}>
      <Heading />
      <div className="mt-8 max-w-3xl space-y-4">
        {Array.from({ length: 7 }, (_, entry) => (
          <section key={entry} className="terminal-card flex gap-4 p-5">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-1/3 min-w-32" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-4/5" />
            </div>
          </section>
        ))}
      </div>
    </Frame>
  );
}
