"use client";

import Link from "next/link";
import { Calendar, ChevronDown, LoaderCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { AppShell, type Notification } from "@/components/layout/AppShell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * The creator's home. Monolith, phase 11a.
 *
 * **Every day in the date picker's calendar was invisible.** The day buttons
 * were `text-accent-contrast` — the near-black meant to sit *on* the lime
 * accent — painted on a dark panel, and disabled days were the same colour at
 * 20% opacity. This is the eighth sighting of that token family and the worst:
 * in phases 6, 7, 8 and 10 it was a hover state, so the label reappeared when
 * the pointer left. Here it was the resting state of every number in the grid.
 *
 * **The picker was a hand-rolled popover** — a `fixed inset-0 z-40` click-catcher
 * behind an `absolute z-50` panel, with no Escape, no focus return and two
 * z-indexes that are not on the project's scale. It is `ui/popover` now, which
 * portals, positions, restores focus and closes on Escape and outside click.
 *
 * **Five `bg-white` hover washes**, the whole remaining population outside
 * `ui/slider` and the member dashboard — every hoverable row and metric tile on
 * this screen lifted by painting white over the panel instead of moving to the
 * raised surface the system defines for exactly that.
 *
 * **The chart tooltip's text was the literal `#fff`.** Monolith deleted 371
 * `text-white` classes; this one sat in a style object, where no class-name
 * ratchet could ever have seen it.
 *
 * Also gone: the staggered `animate-fade-in-up` on every section with inline
 * `animationDelay`s, the stock `red-*` alert, a `periods` constant kept alive
 * by `void periods`, and an `EmptyState` action branch no call site used.
 */

type TurnoverMetrics = { turnoverThisWeek: number; allTimeTurnover: number; updatedAt: string | null };

type ScheduleEvent = { id: string; title: string; startsAt: string; status: "upcoming" | "live"; enrollmentCount: number };

type OverviewData = {
  activeMemberCount: number;
  totalMemberCount: number;
  newMemberCount: number;
  previousNewMemberCount: number;
  revenue: number;
  previousRevenue: number;
  todayEventCount: number;
  todaySchedule: ScheduleEvent[];
  attention: { missingRoomLinkCount: number; pendingReviewCount: number; draftLessonCount: number; draftEventCount: number };
  trendData: { date: string; revenue: number; newMembers: number; totalMembers: number }[];
};

type FilterOption = "today" | "yesterday" | "last_week" | "last_month" | "last_3_months" | "last_year" | "custom";
type DateRange = { start: string; end: string } | null;

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-US");

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_week", label: "Last week" },
  { id: "last_month", label: "Last month" },
  { id: "last_3_months", label: "Last 3 months" },
  { id: "last_year", label: "Last year" },
] as const;

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function delta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "No change" : "New this period";
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change >= 0 ? "+" : ""}${change}% vs previous period`;
}

function eventTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getDateRangeForOption(option: FilterOption, customRange: DateRange) {
  if (option === "custom" && customRange) {
    return { start: new Date(customRange.start).toISOString(), end: new Date(customRange.end).toISOString() };
  }

  const start = new Date();
  const end = new Date();

  switch (option) {
    case "today":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "yesterday":
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case "last_week":
      start.setDate(start.getDate() - 7);
      break;
    case "last_3_months":
      start.setDate(start.getDate() - 90);
      break;
    case "last_year":
      start.setDate(start.getDate() - 365);
      break;
    case "last_month":
    default:
      start.setDate(start.getDate() - 30);
      break;
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

function DateRangeFilter({
  value,
  customRange,
  onChange,
}: {
  value: FilterOption;
  customRange: DateRange;
  onChange: (option: FilterOption, range: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tempStart, setTempStart] = useState<Date | null>(customRange ? new Date(customRange.start) : null);
  const [tempEnd, setTempEnd] = useState<Date | null>(customRange ? new Date(customRange.end) : null);
  const [navDate, setNavDate] = useState(new Date());

  const year = navDate.getFullYear();
  const month = navDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const days: (Date | null)[] = [
    ...Array.from({ length: firstDayIndex }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(year, month, index + 1)),
  ];

  const chooseDay = (day: Date) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(day);
      setTempEnd(null);
    } else if (day < tempStart) {
      setTempStart(day);
      setTempEnd(null);
    } else {
      setTempEnd(day);
    }
  };

  const applyCustomRange = () => {
    if (!tempStart || !tempEnd) return;
    onChange("custom", { start: tempStart.toISOString(), end: tempEnd.toISOString() });
    setOpen(false);
  };

  const displayLabel = () => {
    if (value === "custom" && customRange) {
      const options = { month: "short", day: "numeric", year: "numeric" } as const;
      return `${new Date(customRange.start).toLocaleDateString(undefined, options)} – ${new Date(customRange.end).toLocaleDateString(undefined, options)}`;
    }
    return PRESETS.find((preset) => preset.id === value)?.label ?? value;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={buttonVariants({ variant: "outline", size: "chrome" })}>
        <Calendar size={14} className="text-primary" />
        {displayLabel()}
        <ChevronDown size={12} className="text-text-faint" />
      </PopoverTrigger>

      <PopoverContent align="end" className="w-auto flex-row gap-0 p-0">
        <div className="flex w-44 flex-col gap-1 border-r border-border-hairline p-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                onChange(preset.id, null);
                setOpen(false);
              }}
              aria-pressed={value === preset.id}
              className={`focus-ring w-full rounded-md px-3 py-2 text-left text-content-sm transition-colors ${
                value === preset.id
                  ? "bg-surface-raised text-text-strong"
                  : "text-text-muted hover:bg-surface-raised hover:text-text-strong"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon-chrome"
              onClick={() => setNavDate(new Date(year, month - 1, 1))}
              aria-label="Previous month"
            >
              &larr;
            </Button>
            <span className="text-content-sm font-medium text-text-strong">
              {MONTHS[month]} {year}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-chrome"
              onClick={() => setNavDate(new Date(year, month + 1, 1))}
              aria-label="Next month"
            >
              &rarr;
            </Button>
          </div>

          <div className="grid w-[232px] grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((day) => (
              <span key={day} className="terminal-label py-1 text-text-faint">
                {day}
              </span>
            ))}
            {days.map((day, index) =>
              day === null ? (
                <div key={`empty-${index}`} className="size-8" />
              ) : (
                <CalendarDay
                  key={day.toISOString()}
                  day={day}
                  start={tempStart}
                  end={tempEnd}
                  onSelect={() => chooseDay(day)}
                />
              ),
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border-hairline pt-3">
            <span className="font-mono text-mono-xs text-text-muted tabular-nums">
              {tempStart ? tempStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Start"}
              {tempEnd ? ` – ${tempEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="chrome"
                onClick={() => {
                  setTempStart(null);
                  setTempEnd(null);
                }}
              >
                Clear
              </Button>
              <Button type="button" size="chrome" disabled={!tempStart || !tempEnd} onClick={applyCustomRange}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CalendarDay({
  day,
  start,
  end,
  onSelect,
}: {
  day: Date;
  start: Date | null;
  end: Date | null;
  onSelect: () => void;
}) {
  const selectable = day <= new Date();
  const isEdge = (start && isSameDay(day, start)) || (end && isSameDay(day, end));
  const inRange = start && end && day > start && day < end;

  /* `text-text-default`, not `text-accent-contrast`. The day numbers used to be
     the accent's own contrast colour on a dark panel, which is near-black on
     near-black — the whole grid read as empty. */
  return (
    <button
      type="button"
      disabled={!selectable}
      onClick={onSelect}
      className={`focus-ring grid size-8 place-items-center rounded-md font-mono text-mono-xs tabular-nums transition-colors ${
        isEdge
          ? "bg-primary text-primary-foreground"
          : inRange
            ? "bg-accent-soft text-text-strong"
            : selectable
              ? "text-text-default hover:bg-surface-raised hover:text-text-strong"
              : "text-text-faint"
      }`}
    >
      {day.getDate()}
    </button>
  );
}

export function CreatorOverviewView({
  memberName,
  notifications,
  turnoverMetrics,
}: {
  memberName: string;
  notifications: Notification[];
  turnoverMetrics: TurnoverMetrics;
}) {
  const [metricsFilter, setMetricsFilter] = useState<FilterOption>("last_month");
  const [metricsCustomRange, setMetricsCustomRange] = useState<DateRange>(null);
  const [trendsFilter, setTrendsFilter] = useState<FilterOption>("last_month");
  const [trendsCustomRange, setTrendsCustomRange] = useState<DateRange>(null);

  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState<"revenue" | "totalMembers" | "newMembers">("revenue");

  useEffect(() => {
    let active = true;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    async function loadOverview() {
      setLoading(true);
      setError(null);
      try {
        const metricsRange = getDateRangeForOption(metricsFilter, metricsCustomRange);
        const trendsRange = getDateRangeForOption(trendsFilter, trendsCustomRange);

        const params = new URLSearchParams({
          timezone,
          metricsStart: metricsRange.start,
          metricsEnd: metricsRange.end,
          trendsStart: trendsRange.start,
          trendsEnd: trendsRange.end,
        });

        const period = metricsFilter === "last_week" ? 7 : metricsFilter === "last_3_months" ? 90 : 30;
        params.append("period", String(period));

        const response = await fetch(`/api/creator/overview?${params}`, { cache: "no-store" });
        const payload = (await response.json()) as { data?: OverviewData; error?: string };
        if (!response.ok || !payload.data) throw new Error(payload.error ?? "Unable to load creator overview.");
        if (active) setData(payload.data);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load creator overview.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOverview();
    return () => {
      active = false;
    };
  }, [metricsFilter, metricsCustomRange, trendsFilter, trendsCustomRange]);

  const attention = data?.attention;
  const attentionTotal = attention
    ? attention.missingRoomLinkCount + attention.pendingReviewCount + attention.draftLessonCount + attention.draftEventCount
    : 0;

  return (
    <AppShell
      active="Overview"
      title="Creator overview"
      memberName={memberName}
      platformRole="influencer"
      notifications={notifications}
      routeBase="/creator"
    >
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <header className="mb-8 flex flex-col gap-4 border-b border-border-hairline pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="terminal-label text-text-faint">Creator workspace</p>
            <h1 className="mt-3 text-title-lg font-medium text-text-strong">Overview</h1>
            <p className="mt-3 max-w-2xl text-content-base text-text-default">
              Monitor growth, revenue, and the work that needs your attention today.
            </p>
          </div>
          <Link href="/creator/members/turnover" className={buttonVariants({ variant: "outline" })}>
            <span className="font-mono tabular-nums">{currency.format(turnoverMetrics.turnoverThisWeek)}</span>
            <span className="text-text-muted">this week</span>
          </Link>
        </header>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-status-danger/40 bg-status-danger/10 p-4 text-content-sm text-status-danger"
          >
            {error}
          </p>
        ) : (
          <div className="flex flex-col gap-10">
            <div className="grid gap-4 xl:grid-cols-5">
              <section className="rounded-lg border border-border-hairline bg-surface-panel p-5 xl:col-span-3">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="terminal-label text-text-faint">Today&rsquo;s schedule</h2>
                  <Link
                    href="/creator/events?create=1"
                    className="focus-ring inline-flex items-center gap-1.5 rounded-md text-content-sm text-primary transition-colors hover:text-text-strong"
                  >
                    <Plus size={14} />
                    Create event
                  </Link>
                </div>
                <div className="border-t border-border-hairline pt-2">
                  {loading ? (
                    <LoadingRow />
                  ) : data?.todaySchedule.length ? (
                    <div className="divide-y divide-border-hairline">
                      {data.todaySchedule.map((event) => (
                        <div
                          key={event.id}
                          className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              {event.status === "live" && (
                                <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                              )}
                              <p
                                className={`font-mono text-mono-xs tabular-nums ${event.status === "live" ? "text-primary" : "text-text-muted"}`}
                              >
                                {event.status === "live" ? "Live now" : eventTime(event.startsAt)}
                              </p>
                            </div>
                            <h3 className="mt-1 text-title-sm font-medium text-text-strong">{event.title}</h3>
                            <p className="mt-1 font-mono text-mono-xs text-text-muted tabular-nums">
                              {number.format(event.enrollmentCount)} enrolled
                            </p>
                          </div>
                          <Link
                            href={`/creator/events#${event.id}`}
                            className="focus-ring rounded-md text-content-sm text-primary transition-colors hover:text-text-strong"
                          >
                            Manage &rarr;
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState text="No live or upcoming events are scheduled for today." />
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-border-hairline bg-surface-panel p-5 xl:col-span-2">
                <h2 className="terminal-label mb-4 text-text-faint">Needs attention</h2>
                <div className="border-t border-border-hairline pt-2">
                  {loading ? (
                    <LoadingRow />
                  ) : attention && attentionTotal > 0 ? (
                    <div className="divide-y divide-border-hairline">
                      <AttentionRow
                        href="/creator/events"
                        label="Upcoming events missing room links"
                        count={attention.missingRoomLinkCount}
                      />
                      <AttentionRow href="/creator/events" label="Unpublished event drafts" count={attention.draftEventCount} />
                      <AttentionRow
                        href="/creator/master"
                        label="Master reviews awaiting action"
                        count={attention.pendingReviewCount}
                      />
                      <AttentionRow href="/creator/courses" label="Draft lessons not published" count={attention.draftLessonCount} />
                    </div>
                  ) : (
                    <EmptyState text="Nothing needs your attention right now." />
                  )}
                </div>
              </section>
            </div>

            <section aria-label="Creator metrics">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="terminal-label text-text-faint">Metrics overview</h2>
                <DateRangeFilter
                  value={metricsFilter}
                  customRange={metricsCustomRange}
                  onChange={(option, range) => {
                    setMetricsFilter(option);
                    setMetricsCustomRange(range);
                  }}
                />
              </div>
              <div className="grid grid-cols-2 divide-x divide-y divide-border-hairline overflow-hidden rounded-lg border border-border-hairline bg-surface-panel lg:grid-cols-4 lg:divide-y-0">
                <MetricItem
                  label="Active members"
                  value={data ? number.format(data.activeMemberCount) : "—"}
                  detail="Currently active"
                  loading={loading}
                />
                <MetricItem
                  label="Total members"
                  value={data ? number.format(data.totalMemberCount) : "—"}
                  detail="All-time members"
                  loading={loading}
                />
                <MetricItem
                  label="New members"
                  value={data ? number.format(data.newMemberCount) : "—"}
                  detail={data ? delta(data.newMemberCount, data.previousNewMemberCount) : "Compared with prior period"}
                  loading={loading}
                />
                <MetricItem
                  label="Revenue"
                  value={data ? currency.format(data.revenue) : "—"}
                  detail={data ? delta(data.revenue, data.previousRevenue) : "Compared with prior period"}
                  loading={loading}
                />
              </div>
            </section>

            <section aria-label="Trends">
              <div className="mb-4 flex flex-col gap-4 border-b border-border-hairline pb-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-1">
                  {(
                    [
                      { id: "revenue", label: "Revenue" },
                      { id: "totalMembers", label: "All-time members" },
                      { id: "newMembers", label: "New members" },
                    ] as const
                  ).map((metric) => {
                    const selected = activeMetric === metric.id;
                    return (
                      <button
                        key={metric.id}
                        type="button"
                        onClick={() => setActiveMetric(metric.id)}
                        aria-pressed={selected}
                        className={`focus-ring relative inline-flex min-h-11 items-center px-3 text-content-sm transition-colors ${
                          selected ? "text-text-strong" : "text-text-muted hover:text-text-strong"
                        }`}
                      >
                        {metric.label}
                        {selected && <span aria-hidden className="absolute inset-x-2 -bottom-2.5 h-0.5 bg-primary" />}
                      </button>
                    );
                  })}
                </div>
                <DateRangeFilter
                  value={trendsFilter}
                  customRange={trendsCustomRange}
                  onChange={(option, range) => {
                    setTrendsFilter(option);
                    setTrendsCustomRange(range);
                  }}
                />
              </div>
              <div className="h-[300px] rounded-lg border border-border-hairline bg-surface-panel p-5">
                {loading || !data?.trendData ? (
                  <LoadingRow />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.trendData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor={activeMetric === "revenue" ? "var(--color-chart-1)" : "var(--color-text-default)"}
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor={activeMetric === "revenue" ? "var(--color-chart-1)" : "var(--color-text-default)"}
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        stroke="var(--color-text-muted)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-surface-panel)",
                          borderColor: "var(--color-border-hairline)",
                          borderRadius: "4px",
                          fontSize: "14px",
                          // Was the literal '#fff'. A style object is where a
                          // colour hides from every class-name assertion.
                          color: "var(--color-text-strong)",
                        }}
                        itemStyle={{
                          color: activeMetric === "revenue" ? "var(--color-chart-1)" : "var(--color-text-default)",
                        }}
                        formatter={(value: unknown) => {
                          const numeric = typeof value === "number" ? value : Number(value ?? 0);
                          return activeMetric === "revenue" ? currency.format(numeric) : number.format(numeric);
                        }}
                        labelStyle={{ color: "var(--color-text-muted)", marginBottom: "4px" }}
                      />
                      <Area
                        type="monotone"
                        dataKey={activeMetric}
                        stroke={activeMetric === "revenue" ? "var(--color-chart-1)" : "var(--color-text-default)"}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorMetric)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </AppShell>
  );
}

function MetricItem({
  label,
  value,
  detail,
  loading,
}: {
  label: string;
  value: string;
  detail: string;
  loading: boolean;
}) {
  return (
    <div className="flex min-h-[110px] flex-col justify-between p-5 transition-colors hover:bg-surface-raised">
      <p className="terminal-label text-text-faint">{label}</p>
      <p className={`mt-2 font-mono text-title-md text-text-strong tabular-nums ${loading ? "animate-pulse" : ""}`}>
        {value}
      </p>
      <p className="mt-1 text-content-sm text-text-muted">{detail}</p>
    </div>
  );
}

function AttentionRow({ href, label, count }: { href: string; label: string; count: number }) {
  if (!count) return null;
  return (
    <Link
      href={href}
      className="focus-ring group -mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-3 transition-colors hover:bg-surface-raised"
    >
      <span className="text-content-sm text-text-default transition-colors group-hover:text-text-strong">{label}</span>
      <span className="font-mono text-content-sm text-primary tabular-nums">{count}</span>
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-8 text-content-sm text-text-muted">{text}</p>;
}

function LoadingRow() {
  return (
    <p className="flex items-center gap-2 py-8 text-content-sm text-text-muted">
      <LoaderCircle size={16} className="animate-spin text-primary" />
      Loading…
    </p>
  );
}
