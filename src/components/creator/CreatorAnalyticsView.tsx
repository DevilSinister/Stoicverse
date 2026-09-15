"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/layout/AppShell";
import { Button, buttonVariants } from "@/components/ui/button";
import { nativeSelectClass } from "@/components/ui/select";
import { csvText, defaultFilters, parseFilters, type AnalyticsFilters, type AnalyticsReport } from "@/lib/analytics/model";

/**
 * Community analytics. Monolith, phase 11a.
 *
 * 74 deprecated-alias call sites, two hand-written control styles, and a whole
 * screen written one component per line — the `Trend` chart, its tooltip, its
 * gradient and its fallback table were a single 1,900-character line. The token
 * work and the rewrite are the same change here: the aliases were only hard to
 * find because nothing in the file could be read.
 *
 * Type is on the Monolith scale now rather than Tailwind's defaults, so the
 * numbers in a metric tile and the numbers in a table are the same size as each
 * other and as the rest of the product.
 *
 * **The filters stay native `<select>` elements.** `ui/select` exists but has
 * no call site anywhere in the product, and these twelve controls are driven by
 * `onChange` into a URL round trip. Converting them is a behaviour change on an
 * unexercised primitive, which is a different piece of work from a repaint.
 */

const TABS = ["overview", "trading", "courses", "events", "referrals"] as const;
type Tab = (typeof TABS)[number];

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

const number = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

const date = (value: string) =>
  value
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
        new Date(value),
      )
    : "—";

const delta = (current: number, previous: number) =>
  previous === 0
    ? current === 0
      ? "No change"
      : "New this period"
    : `${current >= previous ? "+" : ""}${number(((current - previous) / previous) * 100)}% vs previous period`;

/** The one control the system has no primitive for. Tokens, not aliases. */
const ROWS_PER_PAGE = 10;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-2">
      <span className="terminal-label text-text-faint">{label}</span>
      {children}
    </label>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-surface-panel px-4 py-3 text-content-sm text-text-default">
      <CircleHelp size={16} className="mt-0.5 shrink-0 text-primary" />
      <div>{children}</div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 py-5 sm:px-5">
      <p className="terminal-label text-text-faint">{label}</p>
      <p className="mt-2 break-words font-mono text-title-md text-text-strong tabular-nums xl:text-title-lg">{value}</p>
      <p className="mt-2 text-content-sm text-text-muted">{detail}</p>
    </div>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-title-sm font-medium text-text-strong">{title}</h2>
          {description && <p className="mt-1 max-w-[70ch] text-content-sm text-text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

type Cell = string | number | null;
type TableRow = { id: string; cells: Cell[]; detail?: ReactNode };

function ReportTable({
  title,
  headers,
  rows,
  numeric = [],
  filename,
}: {
  title: string;
  headers: string[];
  rows: TableRow[];
  numeric?: number[];
  filename: string;
}) {
  const [sort, setSort] = useState<{ index: number; ascending: boolean } | null>(null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const left = a.cells[sort.index];
      const right = b.cells[sort.index];
      if (left === null) return right === null ? 0 : 1;
      if (right === null) return -1;
      const comparison =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right));
      return (sort.ascending ? comparison : -comparison) || a.id.localeCompare(b.id);
    });
  }, [rows, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const current = Math.min(page, pages - 1);

  const exportRows = () => {
    const blob = new Blob([csvText(headers, sorted.map((row) => row.cells))], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${filename}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border-hairline">
      <div className="flex items-center justify-between gap-3 border-b border-border-hairline bg-surface-panel px-4 py-3">
        <p aria-live="polite" className="text-content-sm text-text-muted">
          {number(rows.length)} {rows.length === 1 ? "result" : "results"} · click a column to sort
        </p>
        <Button
          variant="outline"
          size="chrome"
          onClick={exportRows}
          disabled={!rows.length}
          aria-label={`Export ${title} as CSV`}
        >
          <ArrowDownToLine size={14} />
          Export CSV
        </Button>
      </div>

      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {headers.map((header, index) => (
                  <th
                    key={header}
                    scope="col"
                    aria-sort={sort?.index === index ? (sort.ascending ? "ascending" : "descending") : "none"}
                    className={`px-4 py-2 ${numeric.includes(index) ? "text-right" : ""}`}
                  >
                    <button
                      type="button"
                      className="focus-ring terminal-label min-h-11 rounded-md px-1 text-left text-text-muted transition-colors hover:text-text-strong"
                      onClick={() => {
                        setSort({
                          index,
                          ascending: sort?.index === index ? !sort.ascending : !numeric.includes(index),
                        });
                        setPage(0);
                      }}
                    >
                      {header}
                      {sort?.index === index ? (sort.ascending ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-hairline">
              {sorted.slice(current * ROWS_PER_PAGE, current * ROWS_PER_PAGE + ROWS_PER_PAGE).map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-surface-raised">
                  {row.cells.map((cell, index) => (
                    <td
                      key={index}
                      className={`px-4 py-4 align-top text-content-sm ${
                        numeric.includes(index) ? "text-right font-mono tabular-nums" : ""
                      } ${index === 0 ? "font-medium text-text-strong" : "text-text-default"}`}
                    >
                      {index === 0 && row.detail ? (
                        <details>
                          <summary className="focus-ring cursor-pointer rounded-md">{cell}</summary>
                          <div className="mt-3 max-w-sm space-y-1 text-chrome-base font-normal text-text-muted">
                            {row.detail}
                          </div>
                        </details>
                      ) : typeof cell === "number" ? (
                        number(cell)
                      ) : (
                        (cell ?? "—")
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid min-h-52 place-items-center px-6 text-center">
          <div>
            <Search className="mx-auto text-text-faint" size={22} />
            <p className="mt-3 text-content-base text-text-strong">No matching records</p>
            <p className="mt-2 text-content-sm text-text-muted">Try another period or clear your filters.</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border-hairline px-4 py-3">
        <span className="font-mono text-mono-xs text-text-muted tabular-nums">
          Page {current + 1} of {pages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon-chrome"
            aria-label={`Previous ${title} page`}
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={15} />
          </Button>
          <Button
            variant="outline"
            size="icon-chrome"
            aria-label={`Next ${title} page`}
            disabled={current + 1 >= pages}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight size={15} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Trend({ report }: { report: AnalyticsReport }) {
  const [metric, setMetric] = useState<"turnover" | "newMembers" | "completions" | "enrollments">("turnover");
  const gradientId = useId().replaceAll(":", "");

  const seriesName =
    metric === "turnover"
      ? "Turnover"
      : metric === "newMembers"
        ? "New members"
        : metric === "completions"
          ? "Completions"
          : "Enrolments";

  return (
    <Section
      title="The community, week by week"
      description="Completed weeks. The same member filters apply to every point."
      action={
        <select
          className={`${nativeSelectClass} w-auto`}
          aria-label="Trend metric"
          value={metric}
          onChange={(event) => setMetric(event.target.value as typeof metric)}
        >
          <option value="turnover">Turnover · USD</option>
          <option value="newMembers">New members</option>
          <option value="completions">Course completions</option>
          <option value="enrollments">Event enrolments</option>
        </select>
      }
    >
      <div className="h-64 w-full" role="img" aria-label={`Weekly ${metric} trend. Exact values are in the table below.`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={report.trends} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-border-hairline)" strokeDasharray="3 6" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => String(value).slice(5)}
              stroke="var(--color-text-muted)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              stroke="var(--color-text-muted)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={60}
              tickFormatter={(value) => new Intl.NumberFormat("en", { notation: "compact" }).format(value)}
            />
            <Tooltip
              // 4px, like every other corner in the system. It was 12.
              contentStyle={{
                background: "var(--color-surface-panel)",
                border: "1px solid var(--color-border-hairline)",
                borderRadius: 4,
                color: "var(--color-text-default)",
              }}
              labelFormatter={(value) => `Week of ${date(String(value))}`}
              formatter={(value) => [metric === "turnover" ? money(Number(value)) : number(Number(value)), seriesName]}
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-4">
        <summary className="focus-ring min-h-11 cursor-pointer rounded-md py-3 text-content-sm text-text-muted">
          View exact weekly figures
        </summary>
        <ReportTable
          title="Weekly figures"
          headers={["Week starting (UTC)", "Turnover (USD)", "New members", "Completions", "Enrolments"]}
          numeric={[1, 2, 3, 4]}
          rows={report.trends.map((week) => ({
            id: week.date,
            cells: [week.date, week.turnover, week.newMembers, week.completions, week.enrollments],
          }))}
          filename={`analytics-weekly-${report.filters.start}-${report.filters.end}`}
        />
      </details>
    </Section>
  );
}

export function CreatorAnalyticsView({
  memberName,
  initialFilters,
  initialTab,
}: {
  memberName: string;
  initialFilters: AnalyticsFilters;
  initialTab: string;
}) {
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "overview");
  const [draft, setDraft] = useState(initialFilters);
  const [applied, setApplied] = useState(initialFilters);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/creator/analytics?${new URLSearchParams(applied)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load analytics.");
        if (!controller.signal.aborted) setReport(data);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Unable to load analytics.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [applied, refresh]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ ...applied, tab }).toString();
    window.history.replaceState(null, "", url);
  }, [applied, tab]);

  const apply = (filters: AnalyticsFilters) => {
    try {
      const parsed = parseFilters(new URLSearchParams(filters));
      setDraft(parsed);
      setApplied(parsed);
      setLoading(true);
      setError("");
      setValidation("");
    } catch (cause) {
      setValidation(cause instanceof Error ? cause.message : "Invalid filters");
    }
  };

  const retry = () => {
    setLoading(true);
    setError("");
    setRefresh((count) => count + 1);
  };

  const changed = JSON.stringify(draft) !== JSON.stringify(applied);
  const memberFilterCount = [draft.tier, draft.status, draft.source, draft.q].filter(Boolean).length;

  return (
    <AppShell
      active="Analytics"
      title="Community analytics"
      memberName={memberName}
      platformRole="influencer"
      routeBase="/creator"
    >
      <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-border-hairline pb-7">
          <div>
            <p className="terminal-label text-text-faint">Community intelligence</p>
            <h1 className="mt-3 text-title-lg font-medium text-text-strong">See what moves your community.</h1>
            <p className="mt-3 max-w-2xl text-content-base text-text-default">
              Follow your traders, understand your learners, and find the events people enrol in.
            </p>
          </div>
          <Link href="/creator/revenue" className={buttonVariants({ variant: "outline" })}>
            Revenue
            <ArrowRight size={15} />
          </Link>
        </header>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            apply(draft);
          }}
          className="mt-8 rounded-lg border border-border-hairline bg-surface-panel p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-44 flex-1">
              <Field label="Reporting period">
                <select
                  className={nativeSelectClass}
                  aria-label="Period preset"
                  value=""
                  onChange={(event) => {
                    if (!event.target.value) return;
                    const { start, end } = defaultFilters(new Date(), Number(event.target.value));
                    setDraft({ ...draft, start, end });
                  }}
                >
                  <option value="">Choose completed weeks</option>
                  <option value="4">Last 4 completed weeks</option>
                  <option value="12">Last 12 completed weeks</option>
                  <option value="26">Last 26 completed weeks</option>
                  <option value="52">Last 52 completed weeks</option>
                </select>
              </Field>
            </div>

            <Field label="From · Monday">
              <input
                className={nativeSelectClass}
                type="date"
                value={draft.start}
                onChange={(event) => setDraft({ ...draft, start: event.target.value })}
                required
              />
            </Field>

            <Field label="To · Sunday">
              <input
                className={nativeSelectClass}
                type="date"
                value={draft.end}
                onChange={(event) => setDraft({ ...draft, end: event.target.value })}
                required
              />
            </Field>

            <Button
              type="button"
              variant="outline"
              aria-expanded={expanded}
              aria-controls="analytics-member-filters"
              onClick={() => setExpanded(!expanded)}
            >
              <SlidersHorizontal size={15} />
              Member filters{memberFilterCount ? ` (${memberFilterCount})` : ""}
            </Button>

            <Button type="submit" disabled={loading}>
              <Check size={15} />
              Apply
            </Button>
          </div>

          {expanded && (
            <div
              id="analytics-member-filters"
              className="mt-5 grid gap-4 border-t border-border-hairline pt-5 sm:grid-cols-2 xl:grid-cols-4"
            >
              <Field label="Member name or exact ID">
                <input
                  className={nativeSelectClass}
                  type="search"
                  maxLength={100}
                  value={draft.q}
                  placeholder="Search members"
                  onChange={(event) => setDraft({ ...draft, q: event.target.value })}
                />
              </Field>

              <Field label="Current tier">
                <select
                  className={nativeSelectClass}
                  value={draft.tier}
                  onChange={(event) => setDraft({ ...draft, tier: event.target.value })}
                >
                  <option value="">All tiers</option>
                  {[1, 2, 3, 4, 5].map((tier) => (
                    <option key={tier} value={tier}>
                      {tier === 5 ? "Master" : `Tier ${tier}`}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Current membership status">
                <select
                  className={nativeSelectClass}
                  value={draft.status}
                  onChange={(event) => setDraft({ ...draft, status: event.target.value })}
                >
                  <option value="">All statuses</option>
                  {["active", "expired", "pending", "suspended", "cancelled", "refunded"].map((status) => (
                    <option key={status} value={status}>
                      {status[0].toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Access source">
                <select
                  className={nativeSelectClass}
                  value={draft.source}
                  onChange={(event) => setDraft({ ...draft, source: event.target.value })}
                >
                  <option value="">Paid and gifted</option>
                  <option value="stripe">Paid</option>
                  <option value="gifted">Gifted</option>
                </select>
              </Field>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-content-sm text-text-muted">
              UTC · Monday–Sunday · {changed ? "Unapplied changes" : "Compared with the preceding equal-length period"}
            </p>
            <Button type="button" variant="link" size="chrome" onClick={() => apply(defaultFilters())}>
              Reset filters
            </Button>
          </div>

          {validation && (
            <p role="alert" className="mt-2 text-content-sm text-status-danger">
              {validation}
            </p>
          )}
        </form>

        <nav aria-label="Analytics sections" className="mt-7 flex gap-1 overflow-x-auto border-b border-border-hairline">
          {TABS.map((item) => {
            const selected = tab === item;
            return (
              <button
                key={item}
                type="button"
                aria-current={selected ? "page" : undefined}
                onClick={() => setTab(item)}
                className={`focus-ring relative inline-flex min-h-11 shrink-0 items-center px-4 text-content-sm capitalize transition-colors ${
                  selected ? "text-text-strong" : "text-text-muted hover:text-text-strong"
                }`}
              >
                {item}
                {selected && <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 bg-primary" />}
              </button>
            );
          })}
        </nav>

        {loading ? (
          <div role="status" aria-label="Loading analytics" className="py-10">
            <p className="flex items-center gap-3 text-content-sm text-text-muted">
              <RefreshCw size={16} className="motion-safe:animate-spin" />
              Loading your report…
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="h-28 rounded-lg bg-surface-panel motion-safe:animate-pulse" />
              ))}
            </div>
            <div className="mt-8 h-64 rounded-lg bg-surface-panel motion-safe:animate-pulse" />
          </div>
        ) : error ? (
          <div role="alert" className="my-8 rounded-lg border border-border-hairline p-8">
            <h2 className="text-title-sm font-medium text-text-strong">This report couldn&rsquo;t load</h2>
            <p className="mt-2 text-content-sm text-text-default">{error}</p>
            <Button variant="outline" className="mt-5" onClick={retry}>
              <RefreshCw size={15} />
              Try again
            </Button>
          </div>
        ) : (
          report && (
            <div className="py-7">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-content-sm text-text-muted">
                <p>
                  {date(report.filters.start)} – {date(report.filters.end)}
                  <span className="mx-2 text-text-faint">/</span>
                  Comparing {date(report.previous.start)} – {date(report.previous.end)}
                  {applied.q && ` · Member: ${applied.q}`}
                  {applied.tier && ` · Tier ${applied.tier}`}
                  {applied.status && ` · ${applied.status}`}
                  {applied.source && ` · ${applied.source === "stripe" ? "Paid" : "Gifted"}`}
                </p>
                <Button variant="ghost" size="chrome" onClick={retry}>
                  <RefreshCw size={13} />
                  Updated{" "}
                  {new Date(report.generatedAt).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </Button>
              </div>

              {tab === "overview" && <Overview report={report} navigate={setTab} />}
              {/* `hidden` rather than unmounted: each panel owns filter state a
                  reader expects to find where they left it. */}
              <div hidden={tab !== "trading"}>
                <Trading key={JSON.stringify(applied)} report={report} />
              </div>
              <div hidden={tab !== "courses"}>
                <Courses key={JSON.stringify(applied)} report={report} />
              </div>
              <div hidden={tab !== "events"}>
                <Events key={JSON.stringify(applied)} report={report} />
              </div>
              {tab === "referrals" && <Referrals />}
            </div>
          )
        )}
      </main>
    </AppShell>
  );
}

function Overview({ report, navigate }: { report: AnalyticsReport; navigate: (tab: Tab) => void }) {
  const metrics = report.metrics;

  const leaders = [
    {
      tab: "trading" as const,
      icon: BarChart3,
      title: "Highest turnover",
      name: report.trading.find((row) => row.recordedWeeks)?.name ?? "No recorded turnover",
      detail: report.trading.find((row) => row.recordedWeeks)
        ? money(report.trading.find((row) => row.recordedWeeks)!.amount)
        : "Selected weeks",
    },
    {
      tab: "courses" as const,
      icon: BookOpen,
      title: "Most watched course",
      name: report.courses.find((course) => course.viewers)?.title ?? "No course viewing yet",
      detail: `${number(report.courses[0]?.viewers ?? 0)} unique viewers · lifetime`,
    },
    {
      tab: "events" as const,
      icon: CalendarDays,
      title: "Most enrolled event",
      name: report.events.find((event) => event.enrollments)?.title ?? "No enrolments this period",
      detail: `${number(report.events[0]?.enrollments ?? 0)} enrolments · selected period`,
    },
  ];

  return (
    <div className="space-y-9">
      <div className="grid grid-cols-2 gap-x-4 border-y border-border-hairline sm:divide-x sm:divide-border-hairline lg:grid-cols-4">
        <Metric
          label="Recorded turnover"
          value={money(metrics.turnover)}
          detail={delta(metrics.turnover, metrics.previousTurnover)}
        />
        <Metric
          label="New members"
          value={number(metrics.newMembers)}
          detail={delta(metrics.newMembers, metrics.previousNewMembers)}
        />
        <Metric
          label="First course completions"
          value={number(metrics.completions)}
          detail={delta(metrics.completions, metrics.previousCompletions)}
        />
        <Metric
          label="Event enrolments"
          value={number(metrics.eventEnrollments)}
          detail={delta(metrics.eventEnrollments, metrics.previousEventEnrollments)}
        />
      </div>

      <div className="grid gap-9 xl:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
        <Trend report={report} />

        <Section
          title="Where members are now"
          description={`${number(metrics.members)} matching members · ${number(metrics.activeMemberships)} active memberships`}
        >
          <div className="space-y-5">
            {report.tiers.map((tier) => (
              <div key={tier.tier}>
                <div className="mb-2 flex justify-between text-content-sm">
                  <span className="text-text-default">{tier.tier === 5 ? "Master" : `Tier ${tier.tier}`}</span>
                  <span className="font-mono text-text-strong tabular-nums">{number(tier.count)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-sm bg-surface-sunken">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${metrics.members ? (tier.count / metrics.members) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-content-sm text-text-muted">
            Current membership and tier snapshots. They do not represent historical activity or retention.
          </p>
        </Section>
      </div>

      <Section
        title="Explore the leaders"
        description="Different measures of contribution. Open a report to compare everyone."
      >
        <div className="divide-y divide-border-hairline border-y border-border-hairline">
          {leaders.map((leader) => (
            <button
              key={leader.tab}
              type="button"
              onClick={() => navigate(leader.tab)}
              className="focus-ring flex min-h-24 w-full items-center gap-4 py-4 text-left transition-colors hover:bg-surface-raised sm:px-4"
            >
              <leader.icon size={19} className="shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="terminal-label text-text-faint">{leader.title}</p>
                <p className="mt-1 truncate text-content-base font-medium text-text-strong">{leader.name}</p>
                <p className="mt-1 text-content-sm text-text-muted sm:hidden">{leader.detail}</p>
              </div>
              <p className="hidden text-content-sm text-text-default sm:block">{leader.detail}</p>
              <ArrowRight size={16} className="shrink-0 text-text-faint" />
            </button>
          ))}
        </div>
      </Section>

      <Note>
        Retention, active learning days, and historical watch-time trends need dated activity tracking. Current progress
        is available in Courses; unavailable metrics are never counted as zero.
      </Note>
    </div>
  );
}

function Trading({ report }: { report: AnalyticsReport }) {
  const [entry, setEntry] = useState("all");
  const [minimum, setMinimum] = useState("");

  const rows = report.trading.filter((row) => {
    const coverage = entry === "all" || (entry === "recorded" ? row.recordedWeeks > 0 : row.recordedWeeks === 0);
    return coverage && (!minimum || row.amount >= Number(minimum));
  });

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 border-b border-border-hairline lg:grid-cols-4">
        <Metric
          label="Selected-period turnover"
          value={money(report.metrics.turnover)}
          detail={delta(report.metrics.turnover, report.metrics.previousTurnover)}
        />
        <Metric
          label="Contributing members"
          value={number(report.metrics.contributors)}
          detail="Members with positive turnover"
        />
        <Metric label="Median contribution" value={money(report.metrics.median)} detail="Among positive contributors" />
        <Metric
          label="No entries in period"
          value={number(report.metrics.missingMembers)}
          detail="Missing records, not recorded zero"
        />
      </div>

      <Section
        title="Turnover leaderboard"
        description="Highest selected-period turnover first. Lifetime totals include every saved week."
        action={
          <Link href="/creator/members/turnover" className={buttonVariants({ variant: "outline" })}>
            Open turnover workspace
            <ArrowRight size={14} />
          </Link>
        }
      >
        <div className="mb-5 flex flex-wrap gap-4">
          <Field label="Entry coverage">
            <select className={`${nativeSelectClass} w-auto`} value={entry} onChange={(event) => setEntry(event.target.value)}>
              <option value="all">All members</option>
              <option value="recorded">Has recorded entries</option>
              <option value="missing">No entries in period</option>
            </select>
          </Field>
          <Field label="Minimum period turnover · USD">
            <input
              className={nativeSelectClass}
              type="number"
              min="0"
              step="0.01"
              value={minimum}
              placeholder="No minimum"
              onChange={(event) => setMinimum(event.target.value)}
            />
          </Field>
        </div>

        <ReportTable
          title="Turnover leaderboard"
          filename={`analytics-trading-${report.filters.start}-${report.filters.end}`}
          headers={["Member", "Tier", "Period (USD)", "Previous (USD)", "Lifetime (USD)", "Share (%)", "Weeks recorded"]}
          numeric={[1, 2, 3, 4, 5, 6]}
          rows={rows.map((row) => ({
            id: row.id,
            cells: [
              row.name,
              row.tier,
              row.recordedWeeks ? row.amount : null,
              row.previous,
              row.lifetime,
              row.recordedWeeks ? row.share : null,
              row.recordedWeeks,
            ],
            detail: (
              <>
                <p className="break-all">Member ID: {row.id}</p>
                <p className="capitalize">Membership: {row.status}</p>
                <p>Last saved: {date(row.updated)}</p>
                <p>{delta(row.amount, row.previous)}</p>
              </>
            ),
          }))}
        />
      </Section>

      <Note>
        These are manually recorded turnover amounts. Platform breakdowns and withdrawable balances will appear once
        platform-linked credit records are available. A saved turnover total is not proof of a completed payout.
      </Note>
    </div>
  );
}

function Courses({ report }: { report: AnalyticsReport }) {
  const [course, setCourse] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const courses = report.courses.filter((row) => (!course || row.id === course) && (!status || row.status === status));
  const learners = report.learners.filter((row) => row.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8">
      <Note>
        <strong className="font-medium text-text-strong">Two time scopes:</strong> unique viewers and recorded progress
        hours are lifetime snapshots. Enrolments and first completions use the selected dates. Progress hours are
        accumulated saved progress, not a verified history of playback sessions.
      </Note>

      <Section
        title="Course performance"
        description="Most watched ranks by lifetime unique viewers within your member filters. Expand a course to inspect its lessons."
      >
        <div className="mb-5 flex flex-wrap gap-4">
          <Field label="Course">
            <select
              className={`${nativeSelectClass} w-auto`}
              value={course}
              onChange={(event) => setCourse(event.target.value)}
            >
              <option value="">All courses</option>
              {report.courses.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Course status">
            <select
              className={`${nativeSelectClass} w-auto`}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
        </div>

        <ReportTable
          title="Course performance"
          filename={`analytics-courses-${report.filters.start}-${report.filters.end}`}
          headers={[
            "Course",
            "Unique viewers · lifetime",
            "Progress hours · lifetime",
            "Enrolments · period",
            "First completions · period",
            "Cohort complete (%)",
          ]}
          numeric={[1, 2, 3, 4, 5]}
          rows={courses.map((row) => ({
            id: row.id,
            cells: [row.title, row.viewers, row.hours, row.enrollments, row.completions, row.cohortRate],
            detail: (
              <>
                <p className="capitalize">{row.status}</p>
                <p className="mb-3">
                  {row.cohortCompleted} of {row.enrollments} members enrolled in this period are currently complete.
                  Observed through {date(report.generatedAt)}.
                </p>
                {row.lessons.length ? (
                  <ol className="space-y-2">
                    {row.lessons.map((lesson) => (
                      <li key={lesson.id}>
                        <span className="text-text-default">{lesson.title}</span>
                        <br />
                        {lesson.viewers} viewers · {lesson.completed} completed · lifetime
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>No lessons yet.</p>
                )}
              </>
            ),
          }))}
        />
      </Section>

      <Section
        title="Learner leaderboard"
        description="First course completions, then lesson completions in the selected period. Lifetime progress hours are a separate measure."
      >
        <div className="mb-5 max-w-sm">
          <Field label="Search learners">
            <input
              className={nativeSelectClass}
              type="search"
              value={search}
              placeholder="Learner name"
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
        </div>

        <ReportTable
          title="Learner leaderboard"
          filename={`analytics-learners-${report.filters.start}-${report.filters.end}`}
          headers={[
            "Member",
            "Tier",
            "First courses · period",
            "Lessons completed · period",
            "Progress hours · lifetime",
            "Last learning activity · UTC",
          ]}
          numeric={[1, 2, 3, 4]}
          rows={learners.map((row) => ({
            id: row.id,
            cells: [
              row.name,
              row.tier,
              row.courses,
              row.lessons,
              row.hours,
              row.lastWatched ? row.lastWatched.slice(0, 10) : null,
            ],
            detail: <p className="break-all">Member ID: {row.id}</p>,
          }))}
        />
      </Section>
    </div>
  );
}

function Events({ report }: { report: AnalyticsReport }) {
  const [host, setHost] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const rows = report.events.filter(
    (event) =>
      (!host || event.host_name === host) &&
      (!status || event.status === status) &&
      event.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-8">
      <div className="grid gap-4 border-b border-border-hairline sm:grid-cols-3">
        <Metric
          label="Event enrolments"
          value={number(report.metrics.eventEnrollments)}
          detail={delta(report.metrics.eventEnrollments, report.metrics.previousEventEnrollments)}
        />
        <Metric
          label="Unique enrollees"
          value={number(report.metrics.uniqueEnrollees)}
          detail="Distinct members enrolled this period"
        />
        <Metric
          label="Repeat enrollees"
          value={number(report.metrics.repeatEnrollees)}
          detail="Enrolled in two or more events this period"
        />
      </div>

      <Section
        title="Events people enrol in"
        description="Ranked by enrolments created in the selected period, regardless of the event date."
      >
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <Field label="Find an event">
            <input
              className={nativeSelectClass}
              type="search"
              placeholder="Event title"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
          <Field label="Host">
            <select className={nativeSelectClass} value={host} onChange={(event) => setHost(event.target.value)}>
              <option value="">All hosts</option>
              {[...new Set(report.events.map((event) => event.host_name))].sort().map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </Field>
          <Field label="Event status">
            <select className={nativeSelectClass} value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All published events</option>
              {["upcoming", "live", "completed"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <ReportTable
          title="Event enrolments"
          filename={`analytics-events-${report.filters.start}-${report.filters.end}`}
          headers={[
            "Event",
            "Host",
            "Event date · UTC",
            "Status",
            "Enrolments · period",
            "Previous period",
            "Current total",
          ]}
          numeric={[4, 5, 6]}
          rows={rows.map((event) => ({
            id: event.id,
            cells: [
              event.title,
              event.host_name,
              event.starts_at.slice(0, 10),
              event.status,
              event.enrollments,
              event.previous,
              event.lifetime,
            ],
            detail: <p>Event ID: {event.id}</p>,
          }))}
        />
      </Section>

      <Note>
        Enrolments measure interest, not attendance. Cancelled and draft events are excluded. Withdrawn enrolments are
        removed by the existing event flow, so these figures describe retained enrolments; historical cancellations and
        capacity are not tracked.
      </Note>
    </div>
  );
}

function Referrals() {
  const planned = [
    "Top referrers by qualifying paid members",
    "Referred signups and signup-to-paid conversion",
    "Rewards earned and reversed",
    "Learning and event engagement of referred members",
  ];

  return (
    <section className="grid gap-9 py-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div>
        <Users size={28} className="text-primary" />
        <p className="mt-5 inline-flex rounded-md border border-border-hairline px-3 py-1 text-content-sm text-text-muted">
          Not tracked yet
        </p>
        <h2 className="mt-4 text-title-lg font-medium text-text-strong">Turn recommendations into measurable growth.</h2>
        <p className="mt-4 max-w-lg text-content-base text-text-default">
          Your referral report will connect signups to first membership payments, so you can see who brings paying
          members into the community.
        </p>
        <div className="mt-6 space-y-1 border-y border-border-hairline py-5">
          <p className="text-content-base font-medium text-text-strong">The reward rule</p>
          <p className="text-content-sm text-text-muted">
            A referrer earns $5 credit after the referred member&rsquo;s first successful membership payment. A refund
            reverses that reward.
          </p>
        </div>
      </div>

      <div className="self-center">
        <h3 className="text-title-sm font-medium text-text-strong">What you&rsquo;ll be able to compare</h3>
        <ul className="mt-4 divide-y divide-border-hairline">
          {planned.map((item) => (
            <li key={item} className="flex gap-3 py-4 text-content-sm text-text-default">
              <ArrowRight size={15} className="mt-0.5 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-content-sm text-text-muted">
          Referral attribution and reward records are not connected yet. This section will show real rankings when those
          records are available.
        </p>
      </div>
    </section>
  );
}
