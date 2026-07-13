"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";

import { AppShell, type Notification } from "@/components/layout/AppShell";
import { withRouteBase } from "@/lib/navigation/paths";

type Event = { id: string; title: string; description: string | null; starts_at: string; min_tier: number; status: string };

export type DashboardData = {
  memberName: string; platformRole: string; currentTier: number; isMaster: boolean; currentTierTitle: string;
  completedLessons: number; totalLessons: number; currentTierCompleted: number; currentTierTotal: number;
  activeLesson: { id: string; title: string; description: string | null; progress: number } | null;
  upcomingEvent: Event | null; notifications: Notification[];
};

const roleName = (role: string) => role.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const eventDate = (value: string) => new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));

export function DashboardView({ data, routeBase = "" }: { data: DashboardData; routeBase?: string }) {
  const tierProgress = data.currentTierTotal ? Math.round((data.currentTierCompleted / data.currentTierTotal) * 100) : 0;
  const roles = useMemo(() => ["Subscriber", roleName(data.platformRole), data.isMaster ? "Master" : `Tier ${data.currentTier} (${data.currentTierTitle})`], [data]);

  return (
    <AppShell
      active="Dashboard"
      title={`Welcome back, ${data.memberName}`}
      isMaster={data.isMaster}
      memberName={data.memberName}
      platformRole={data.platformRole}
      currentTier={data.currentTier}
      notifications={data.notifications}
      routeBase={routeBase}
    >
      {/* Dashboard Grid */}
      <main className="relative grid gap-6 p-4 md:p-8 md:grid-cols-12 max-w-[1440px] mx-auto">
        {/* Subtle Grid Background */}
        <div className="pointer-events-none absolute inset-0 opacity-10 [background-image:linear-gradient(#334155_1px,transparent_1px),linear-gradient(90deg,#334155_1px,transparent_1px)] [background-size:64px_64px]" />

        {/* Left Column: Progress & Active Study */}
        <div className="relative space-y-6 md:col-span-8">
          <Panel title="Training vector">
            <div className="p-6 space-y-6">
              <div>
                <p className="font-label text-xs font-semibold text-primary-container uppercase tracking-wider">Current tier</p>
                <h2 className="mt-2 font-headline text-2xl font-bold text-white">{data.currentTierTitle} — Level 0{data.currentTier}</h2>
              </div>
              
              <div className="space-y-2 pt-2">
                <div className="flex justify-between font-label text-xs">
                  <span className="text-fog-muted">{data.currentTierCompleted} completed / {data.currentTierTotal} in this tier</span>
                  <span className="text-primary-container font-semibold">{tierProgress}%</span>
                </div>
                <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden border border-surgical-steel">
                  <div className="h-full bg-primary-container rounded-full transition-all duration-500 emerald-glow" style={{ width: `${tierProgress}%` }} />
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Continue learning">
            <div className="p-6">
              {data.activeLesson ? (
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <span className="border border-surgical-steel bg-surface-container-high px-2 py-0.5 rounded font-label text-[10px] text-fog-muted">ACTIVE</span>
                    <h3 className="font-headline text-lg font-bold text-white">{data.activeLesson.title}</h3>
                    <p className="max-w-xl font-body text-sm text-on-surface-variant">{data.activeLesson.description || "Continue your current lesson."}</p>
                    <p className="font-label text-xs text-primary-container font-semibold uppercase tracking-wider">{Math.round(data.activeLesson.progress)}% complete</p>
                  </div>
                  <Link href={withRouteBase(routeBase, `/courses/lesson/${data.activeLesson.id}`)} className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary-container px-6 font-label-md text-label-md text-on-primary-fixed uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all emerald-glow shrink-0">
                    Resume lesson
                    <ArrowRight size={16} className="ml-1.5" />
                  </Link>
                </div>
              ) : (
                <div className="text-center py-4 space-y-2">
                  <h3 className="font-headline text-lg font-bold text-white">Your curriculum is clear</h3>
                  <p className="text-sm text-on-surface-variant">New lessons will appear here as they are released.</p>
                </div>
              )}
            </div>
          </Panel>

          <div className="grid gap-6 md:grid-cols-2">
            <Metric label="Lessons completed" value={`${data.completedLessons} / ${data.totalLessons}`} />
            <Metric label="Current access" value={data.isMaster ? "Master" : `Tier ${data.currentTier}`} />
          </div>
        </div>

        {/* Right Column: Events & Roles */}
        <div className="relative space-y-6 md:col-span-4">
          <Panel title="Upcoming event">
            <div className="p-6 space-y-4">
              {data.upcomingEvent ? (
                <>
                  <div>
                    <span className="border border-primary-container bg-primary-container/10 px-2.5 py-0.5 rounded font-label text-[10px] text-primary-container font-semibold uppercase tracking-wider">
                      {data.upcomingEvent.status}
                    </span>
                  </div>
                  <h3 className="font-headline text-lg font-bold text-white leading-snug">{data.upcomingEvent.title}</h3>
                  <p className="text-sm text-on-surface-variant">{data.upcomingEvent.description || "Live member session"}</p>
                  <div className="border-t border-surgical-steel pt-4 font-label text-xs text-primary-container uppercase tracking-wider font-semibold">
                    {eventDate(data.upcomingEvent.starts_at)}
                  </div>
                </>
              ) : (
                <p className="text-sm text-on-surface-variant py-2">No upcoming events are scheduled.</p>
              )}
            </div>
          </Panel>

          <Panel title="Account roles">
            <div className="flex flex-wrap gap-2 p-5">
              {roles.map((role) => (
                <span key={role} className="border border-surgical-steel bg-surface-container-low px-3 py-1 rounded font-label text-xs text-primary-container font-semibold">
                  {role}
                </span>
              ))}
            </div>
          </Panel>
        </div>
      </main>
    </AppShell>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-surgical-steel bg-monolith-surface rounded overflow-hidden">
      <div className="min-h-11 border-b border-surgical-steel bg-surface-container-high px-4 py-3 font-label text-xs uppercase tracking-[0.16em] text-fog-muted font-bold">
        {title}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-surgical-steel bg-monolith-surface p-5 rounded">
      <p className="font-label text-xs uppercase tracking-[0.14em] text-fog-muted font-bold">{label}</p>
      <p className="mt-3 font-headline text-2xl font-bold text-primary-container">{value}</p>
    </div>
  );
}
