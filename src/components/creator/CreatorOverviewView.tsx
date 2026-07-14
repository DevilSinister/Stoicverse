"use client";

import Link from "next/link";
import { LoaderCircle, Plus, Calendar, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { AppShell, type Notification } from "@/components/layout/AppShell";

type ScheduleEvent = { id: string; title: string; startsAt: string; status: "upcoming" | "live"; enrollmentCount: number };
type OverviewData = {
  activeMemberCount: number; totalMemberCount: number; newMemberCount: number; previousNewMemberCount: number; revenue: number; previousRevenue: number; todayEventCount: number;
  todaySchedule: ScheduleEvent[];
  attention: { missingRoomLinkCount: number; pendingReviewCount: number; draftLessonCount: number; draftEventCount: number };
  trendData: { date: string; revenue: number; newMembers: number; totalMembers: number }[];
};

const periods = [7, 30, 90] as const;
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-US");

function delta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "No change" : "New this period";
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change >= 0 ? "+" : ""}${change}% vs previous period`;
}

function eventTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

type FilterOption = 'today' | 'yesterday' | 'last_week' | 'last_month' | 'last_3_months' | 'last_year' | 'custom';

const presets = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_week", label: "Last Week" },
  { id: "last_month", label: "Last Month" },
  { id: "last_3_months", label: "Last 3 Months" },
  { id: "last_year", label: "Last Year" },
] as const;

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function getDateRangeForOption(option: FilterOption, customRange: { start: string; end: string } | null) {
  if (option === 'custom' && customRange) {
    return {
      start: new Date(customRange.start).toISOString(),
      end: new Date(customRange.end).toISOString(),
    };
  }

  const start = new Date();
  const end = new Date();

  switch (option) {
    case 'today': {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'yesterday': {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'last_week': {
      start.setDate(start.getDate() - 7);
      break;
    }
    case 'last_month': {
      start.setDate(start.getDate() - 30);
      break;
    }
    case 'last_3_months': {
      start.setDate(start.getDate() - 90);
      break;
    }
    case 'last_year': {
      start.setDate(start.getDate() - 365);
      break;
    }
    default: {
      start.setDate(start.getDate() - 30);
      break;
    }
  }

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function PremiumDateFilter({
  value,
  customRange,
  onChange
}: {
  value: FilterOption;
  customRange: { start: string; end: string } | null;
  onChange: (option: FilterOption, range: { start: string; end: string } | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStart, setTempStart] = useState<Date | null>(customRange ? new Date(customRange.start) : null);
  const [tempEnd, setTempEnd] = useState<Date | null>(customRange ? new Date(customRange.end) : null);
  const [navDate, setNavDate] = useState(new Date());

  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const year = navDate.getFullYear();
  const month = navDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const days: (Date | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  const prevMonth = () => {
    setNavDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setNavDate(new Date(year, month + 1, 1));
  };

  const handlePresetClick = (presetId: FilterOption) => {
    onChange(presetId, null);
    setIsOpen(false);
  };

  const handleDayClick = (day: Date) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(day);
      setTempEnd(null);
    } else {
      if (day < tempStart) {
        setTempStart(day);
        setTempEnd(null);
      } else {
        setTempEnd(day);
      }
    }
  };

  const applyCustomRange = () => {
    if (tempStart && tempEnd) {
      onChange("custom", {
        start: tempStart.toISOString(),
        end: tempEnd.toISOString()
      });
      setIsOpen(false);
    }
  };

  const getDisplayLabel = (opt: FilterOption, range: { start: string; end: string } | null) => {
    if (opt === 'custom' && range) {
      const startStr = new Date(range.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const endStr = new Date(range.end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startStr} - ${endStr}`;
    }
    return presets.find(p => p.id === opt)?.label ?? opt.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-monolith-surface border border-surgical-steel rounded-full text-white text-xs font-medium hover:border-primary-container transition-colors duration-200 cursor-pointer"
      >
        <Calendar size={14} className="text-primary-container" />
        <span>{getDisplayLabel(value, customRange)}</span>
        <ChevronDown size={12} className="text-fog-muted" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 bg-monolith-surface border border-surgical-steel shadow-2xl rounded-lg flex flex-col md:flex-row overflow-hidden max-w-[95vw] md:max-w-none">
            {/* Presets Sidebar */}
            <div className="w-full md:w-44 border-b md:border-b-0 md:border-r border-surgical-steel p-2 flex flex-col gap-1 bg-surface-container-low/20">
              {presets.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetClick(preset.id)}
                  className={`w-full text-left px-3 py-2 rounded text-xs font-body transition-colors duration-150 cursor-pointer ${value === preset.id ? "bg-primary-container/20 text-white font-medium" : "text-fog-muted hover:bg-white/[0.04] hover:text-white"}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Calendar panel */}
            <div className="p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-white/[0.04] text-white cursor-pointer">&larr;</button>
                <span className="text-xs font-medium text-white font-sans">{months[month]} {year}</span>
                <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-white/[0.04] text-white cursor-pointer">&rarr;</button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center w-[232px]">
                {weekdays.map(d => (
                  <span key={d} className="text-[10px] font-bold text-fog-muted uppercase py-1">{d}</span>
                ))}
                {days.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} className="w-8 h-8" />;

                  const isSelectedStart = tempStart && isSameDay(day, tempStart);
                  const isSelectedEnd = tempEnd && isSameDay(day, tempEnd);
                  const isInRange = tempStart && tempEnd && day > tempStart && day < tempEnd;
                  const isSelectable = day <= new Date();

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      disabled={!isSelectable}
                      onClick={() => handleDayClick(day)}
                      className={`w-8 h-8 rounded text-xs transition-all duration-150 relative flex items-center justify-center cursor-pointer
                        ${!isSelectable ? "text-white/20 cursor-not-allowed" : "text-white hover:bg-primary-container/30"}
                        ${isSelectedStart ? "bg-primary-container text-on-primary-fixed font-bold" : ""}
                        ${isSelectedEnd ? "bg-primary-container text-on-primary-fixed font-bold" : ""}
                        ${isInRange ? "bg-primary-container/10 text-white" : ""}
                      `}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between border-t border-surgical-steel pt-3">
                <span className="text-[10px] text-fog-muted">
                  {tempStart ? tempStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "Start"}
                  {tempEnd ? ` - ${tempEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ""}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setTempStart(null); setTempEnd(null); }}
                    className="px-2 py-1 text-[10px] text-fog-muted hover:text-white transition-colors duration-150 cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    disabled={!tempStart || !tempEnd}
                    onClick={applyCustomRange}
                    className="px-3 py-1 bg-primary-container text-on-primary-fixed text-[10px] font-bold rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function CreatorOverviewView({ memberName, notifications }: { memberName: string; notifications: Notification[] }) {
  void periods;
  const [metricsFilter, setMetricsFilter] = useState<FilterOption>("last_month");
  const [metricsCustomRange, setMetricsCustomRange] = useState<{ start: string; end: string } | null>(null);

  const [trendsFilter, setTrendsFilter] = useState<FilterOption>("last_month");
  const [trendsCustomRange, setTrendsCustomRange] = useState<{ start: string; end: string } | null>(null);

  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState<"revenue" | "totalMembers" | "newMembers">("revenue");

  useEffect(() => {
    const controller = new AbortController();
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

        let periodVal = 30;
        if (metricsFilter === "last_week") periodVal = 7;
        else if (metricsFilter === "last_3_months") periodVal = 90;
        params.append("period", String(periodVal));

        const response = await fetch(`/api/creator/overview?${params}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json() as { data?: OverviewData; error?: string };
        if (!response.ok || !payload.data) throw new Error(payload.error ?? "Unable to load creator overview.");
        setData(payload.data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load creator overview.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadOverview();
    return () => controller.abort();
  }, [metricsFilter, metricsCustomRange, trendsFilter, trendsCustomRange]);

  return <AppShell active="Overview" title="Creator overview" memberName={memberName} platformRole="influencer" notifications={notifications} routeBase="/creator">
    <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8">
      <div className="animate-fade-in-up mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between" style={{ animationDelay: '0ms' }}>
        <div>
          <h2 className="font-sans text-2xl font-semibold text-white">Overview</h2>
          <p className="mt-1 font-body text-sm text-fog-muted">Monitor growth, revenue, and the work that needs your attention today.</p>
        </div>
      </div>

      {error ? (
        <div role="alert" className="animate-fade-in-up border border-red-500/50 bg-red-500/10 p-4 font-body text-sm text-red-200">
          {error}
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          
          {/* Today's Schedule & Needs Attention Card Grid */}
          <div className="grid gap-8 xl:grid-cols-5">
            <section className="animate-fade-in-up xl:col-span-3 bg-monolith-surface border border-surgical-steel rounded-lg p-6 shadow-md" style={{ animationDelay: '50ms' }}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-sans text-sm font-semibold text-white uppercase tracking-wider">Today’s schedule</h3>
                <Link href="/creator/events?create=1" className="flex items-center gap-1.5 font-label text-xs text-primary-container transition-colors duration-200 hover:text-white">
                  <Plus size={14} /> Create event
                </Link>
              </div>
              <div className="border-t border-surgical-steel/60 pt-2">
                {loading ? <LoadingRow /> : data?.todaySchedule.length ? (
                  <div className="divide-y divide-surgical-steel/40">
                    {data.todaySchedule.map((event) => (
                      <div key={event.id} className="group flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            {event.status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-primary-container animate-pulse" />}
                            <p className={`font-label text-xs ${event.status === "live" ? "text-primary-container font-bold" : "text-fog-muted"}`}>
                              {event.status === "live" ? "LIVE NOW" : eventTime(event.startsAt)}
                            </p>
                          </div>
                          <h4 className="mt-1 font-sans text-base font-medium text-white transition-colors duration-200 group-hover:text-primary-container">{event.title}</h4>
                          <p className="mt-1 font-body text-sm tabular-nums text-fog-muted">{number.format(event.enrollmentCount)} enrolled</p>
                        </div>
                        <Link href={`/creator/events#${event.id}`} className="font-body text-sm text-primary-container transition-colors duration-200 hover:text-white">
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

            <section className="animate-fade-in-up xl:col-span-2 bg-monolith-surface border border-surgical-steel rounded-lg p-6 shadow-md" style={{ animationDelay: '100ms' }}>
              <h3 className="mb-4 font-sans text-sm font-semibold text-white uppercase tracking-wider">Needs attention</h3>
              <div className="border-t border-surgical-steel/60 pt-2">
                {loading ? <LoadingRow /> : data && data.attention.missingRoomLinkCount + data.attention.pendingReviewCount + data.attention.draftLessonCount + data.attention.draftEventCount > 0 ? (
                  <div className="divide-y divide-surgical-steel/40">
                    <AttentionRow href="/creator/events" label="Upcoming events missing room links" count={data.attention.missingRoomLinkCount} />
                    <AttentionRow href="/creator/events" label="Unpublished event drafts" count={data.attention.draftEventCount} />
                    <AttentionRow href="/creator/master" label="Master reviews awaiting action" count={data.attention.pendingReviewCount} />
                    <AttentionRow href="/creator/courses" label="Draft lessons not published" count={data.attention.draftLessonCount} />
                  </div>
                ) : (
                  <EmptyState text="Nothing needs your attention right now." />
                )}
              </div>
            </section>
          </div>

          {/* Metrics Section */}
          <section aria-label="Creator metrics" className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
              <h3 className="font-sans text-sm font-semibold text-white uppercase tracking-wider">Metrics Overview</h3>
              <PremiumDateFilter
                value={metricsFilter}
                customRange={metricsCustomRange}
                onChange={(opt, rng) => { setMetricsFilter(opt); setMetricsCustomRange(rng); }}
              />
            </div>
            <div className="border border-surgical-steel rounded-lg bg-monolith-surface grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-surgical-steel overflow-hidden shadow-lg">
              <MetricItem label="Active members" value={data ? number.format(data.activeMemberCount) : "—"} detail="Currently active" loading={loading} />
              <MetricItem label="Total members" value={data && 'totalMemberCount' in data ? number.format(data.totalMemberCount as number) : "—"} detail="All-time members" loading={loading} />
              <MetricItem label="New members" value={data ? number.format(data.newMemberCount) : "—"} detail={data ? delta(data.newMemberCount, data.previousNewMemberCount) : "Compared with prior period"} loading={loading} />
              <MetricItem label="Revenue" value={data ? currency.format(data.revenue) : "—"} detail={data ? delta(data.revenue, data.previousRevenue) : "Compared with prior period"} loading={loading} />
            </div>
          </section>

          {/* Chart Section */}
          <section aria-label="Trends" className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-surgical-steel pb-2">
              <div className="flex items-center gap-6">
                {[
                  { id: "revenue", label: "Revenue" },
                  { id: "totalMembers", label: "All-time members" },
                  { id: "newMembers", label: "New members" }
                ].map((metric) => (
                  <button
                    key={metric.id}
                    type="button"
                    onClick={() => setActiveMetric(metric.id as "revenue" | "totalMembers" | "newMembers")}
                    className={`font-body text-sm transition-colors duration-200 cursor-pointer ${activeMetric === metric.id ? "font-medium text-white" : "text-fog-muted hover:text-white"}`}
                  >
                    {metric.label}
                  </button>
                ))}
              </div>
              <PremiumDateFilter
                value={trendsFilter}
                customRange={trendsCustomRange}
                onChange={(opt, rng) => { setTrendsFilter(opt); setTrendsCustomRange(rng); }}
              />
            </div>
            <div className="border border-surgical-steel rounded p-6 h-[300px] bg-monolith-surface shadow-lg">
              {loading || !data?.trendData ? <LoadingRow /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trendData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={activeMetric === "revenue" ? "#10B981" : "#E2E8F0"} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={activeMetric === "revenue" ? "#10B981" : "#E2E8F0"} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '4px', fontSize: '14px', color: '#fff' }}
                      itemStyle={{ color: activeMetric === "revenue" ? '#10B981' : '#E2E8F0' }}
                      formatter={(value: unknown) => { const numeric = typeof value === "number" ? value : Number(value ?? 0); return activeMetric === "revenue" ? currency.format(numeric) : number.format(numeric); }}
                      labelStyle={{ color: '#94A3B8', marginBottom: '4px' }}
                    />
                    <Area type="monotone" dataKey={activeMetric} stroke={activeMetric === "revenue" ? "#10B981" : "#E2E8F0"} strokeWidth={2} fillOpacity={1} fill="url(#colorMetric)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

        </div>
      )}
    </main>
  </AppShell>;
}

function MetricItem({ label, value, detail, loading }: { label: string; value: string; detail: string; loading: boolean }) { 
  return (
    <div className="py-6 px-6 transition-colors duration-300 hover:bg-white/[0.02] flex flex-col justify-between min-h-[110px]">
      <p className="font-body text-xs uppercase tracking-wider text-fog-muted">{label}</p>
      <p className={`mt-2 font-sans text-2xl font-semibold tabular-nums text-white ${loading ? "animate-pulse" : ""}`}>{value}</p>
      <p className="mt-1 font-body text-[10px] text-on-surface-variant">{detail}</p>
    </div>
  );
}

function AttentionRow({ href, label, count }: { href: string; label: string; count: number }) { 
  if (!count) return null;
  return (
    <Link href={href} className="group flex items-center justify-between gap-4 py-3 transition-colors duration-200 hover:bg-white/[0.02] px-2 -mx-2 rounded">
      <span className="font-body text-sm text-on-surface-variant transition-colors duration-200 group-hover:text-white">{label}</span>
      <span className="font-label text-sm tabular-nums text-primary-container font-semibold">{count}</span>
    </Link>
  ); 
}

function EmptyState({ text, action }: { text: string; action?: { href: string; label: string } }) { 
  return (
    <div className="py-8">
      <p className="font-body text-sm text-fog-muted">{text}</p>
      {action && (
        <Link href={action.href} className="mt-2 inline-block font-body text-sm text-primary-container transition-colors duration-200 hover:text-white">
          {action.label} &rarr;
        </Link>
      )}
    </div>
  ); 
}

function LoadingRow() { 
  return (
    <div className="flex items-center gap-2 py-8 font-body text-sm text-fog-muted">
      <LoaderCircle size={16} className="animate-spin text-primary-container" /> Loading...
    </div>
  ); 
}
