"use client";

import Link from "next/link";
import { LoaderCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { AppShell, type Notification } from "@/components/layout/AppShell";

type ScheduleEvent = { id: string; title: string; startsAt: string; status: "upcoming" | "live"; enrollmentCount: number };
type OverviewData = {
  activeMemberCount: number; newMemberCount: number; previousNewMemberCount: number; revenue: number; previousRevenue: number; todayEventCount: number;
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



export function CreatorOverviewView({ memberName, notifications }: { memberName: string; notifications: Notification[] }) {
  const [period, setPeriod] = useState<(typeof periods)[number]>(30);
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
        const response = await fetch(`/api/creator/overview?${new URLSearchParams({ period: String(period), timezone })}`, { cache: "no-store", signal: controller.signal });
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
  }, [period]);

  return <AppShell active="Overview" title="Creator overview" memberName={memberName} platformRole="influencer" notifications={notifications} routeBase="/creator">
    <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8">
      <div className="animate-fade-in-up mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between" style={{ animationDelay: '0ms' }}>
        <div>
          <h2 className="font-sans text-2xl font-semibold text-white">Overview</h2>
          <p className="mt-1 font-body text-sm text-on-surface-variant">Monitor growth, revenue, and the work that needs your attention today.</p>
        </div>
        <div aria-label="Overview period" className="flex items-center gap-4 border-b border-surgical-steel pb-2">
          {periods.map((value) => (
            <button 
              key={value} 
              type="button" 
              onClick={() => setPeriod(value)} 
              aria-pressed={period === value} 
              className={`font-body text-sm transition-colors duration-200 ${period === value ? "font-medium text-white" : "text-fog-muted hover:text-white"}`}
            >
              {value} days
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div role="alert" className="animate-fade-in-up border border-red-500/50 bg-red-500/10 p-4 font-body text-sm text-red-200">
          {error}
        </div>
      ) : (
        <div className="flex flex-col gap-12">
          
          <section aria-label="Creator metrics" className="animate-fade-in-up border-y border-surgical-steel" style={{ animationDelay: '100ms' }}>
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-surgical-steel">
              <MetricItem label="Active members" value={data ? number.format(data.activeMemberCount) : "—"} detail="Currently active" loading={loading} />
              <MetricItem label="New members" value={data ? number.format(data.newMemberCount) : "—"} detail={data ? delta(data.newMemberCount, data.previousNewMemberCount) : "Compared with prior period"} loading={loading} />
              <MetricItem label="Revenue" value={data ? currency.format(data.revenue) : "—"} detail={data ? delta(data.revenue, data.previousRevenue) : "Successful payments only"} loading={loading} />
              <MetricItem label="Today’s events" value={data ? number.format(data.todayEventCount) : "—"} detail="Live and upcoming" loading={loading} />
            </div>
          </section>

          {/* Chart Section */}
          <section aria-label="Trends" className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="mb-4 flex items-center gap-6 border-b border-surgical-steel pb-2">
              {[
                { id: "revenue", label: "Revenue" },
                { id: "totalMembers", label: "All-time members" },
                { id: "newMembers", label: "New members" }
              ].map((metric) => (
                <button
                  key={metric.id}
                  type="button"
                  onClick={() => setActiveMetric(metric.id as "revenue" | "totalMembers" | "newMembers")}
                  className={`font-body text-sm transition-colors duration-200 ${activeMetric === metric.id ? "font-medium text-white" : "text-fog-muted hover:text-white"}`}
                >
                  {metric.label}
                </button>
              ))}
            </div>
            <div className="border border-surgical-steel rounded p-6 h-[300px] bg-monolith-surface">
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

          <div className="grid gap-12 xl:grid-cols-5">
            <section className="animate-fade-in-up xl:col-span-3" style={{ animationDelay: '300ms' }}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-sans text-sm font-semibold text-white">Today’s schedule</h3>
                <Link href="/creator/events?create=1" className="flex items-center gap-1.5 font-label text-xs text-primary-container transition-colors duration-200 hover:text-white">
                  <Plus size={14} /> Create event
                </Link>
              </div>
              <div className="border-t border-surgical-steel">
                {loading ? <LoadingRow /> : data?.todaySchedule.length ? (
                  <div className="divide-y divide-surgical-steel">
                    {data.todaySchedule.map((event) => (
                      <div key={event.id} className="group flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            {event.status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-primary-container" />}
                            <p className={`font-label text-xs ${event.status === "live" ? "text-primary-container" : "text-fog-muted"}`}>
                              {event.status === "live" ? "LIVE NOW" : eventTime(event.startsAt)}
                            </p>
                          </div>
                          <h4 className="mt-1 font-sans text-base font-medium text-white transition-colors duration-200 group-hover:text-primary-container">{event.title}</h4>
                          <p className="mt-1 font-body text-sm tabular-nums text-on-surface-variant">{number.format(event.enrollmentCount)} enrolled</p>
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

            <section className="animate-fade-in-up xl:col-span-2" style={{ animationDelay: '400ms' }}>
              <h3 className="mb-4 font-sans text-sm font-semibold text-white">Needs attention</h3>
              <div className="border-t border-surgical-steel">
                {loading ? <LoadingRow /> : data && data.attention.missingRoomLinkCount + data.attention.pendingReviewCount + data.attention.draftLessonCount + data.attention.draftEventCount > 0 ? (
                  <div className="divide-y divide-surgical-steel">
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

        </div>
      )}
    </main>
  </AppShell>;
}

function MetricItem({ label, value, detail, loading }: { label: string; value: string; detail: string; loading: boolean }) { 
  return (
    <div className="py-6 sm:px-6 transition-colors duration-300 hover:bg-white/[0.02]">
      <p className="font-body text-sm text-on-surface-variant">{label}</p>
      <p className={`mt-2 font-sans text-2xl font-medium tabular-nums text-white ${loading ? "animate-pulse" : ""}`}>{value}</p>
      <p className="mt-1 font-body text-xs text-fog-muted">{detail}</p>
    </div>
  );
}

function AttentionRow({ href, label, count }: { href: string; label: string; count: number }) { 
  if (!count) return null;
  return (
    <Link href={href} className="group flex items-center justify-between gap-4 py-4 transition-colors duration-200 hover:bg-white/[0.02] px-2 -mx-2 rounded">
      <span className="font-body text-sm text-on-surface-variant transition-colors duration-200 group-hover:text-white">{label}</span>
      <span className="font-label text-sm tabular-nums text-primary-container">{count}</span>
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
