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

  const getTierTitle = (level: number) => {
    const titles = ["Basic", "Beginner", "Intermediate", "Advanced", "Master Zone"];
    return titles[level - 1] || `Tier ${level}`;
  };

  const nextTierToUnlock = useMemo(() => {
    if (data.isMaster || data.currentTier >= 5) {
      return "Master Active";
    }
    const nextLevel = data.currentTier + 1;
    return `Tier ${nextLevel} (${getTierTitle(nextLevel)})`;
  }, [data.currentTier, data.isMaster]);

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
          
          {/* Top Metrics Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            <Metric label="Lessons completed" value={`${data.completedLessons} / ${data.totalLessons}`} />
            <Metric label="Next tier to unlock" value={nextTierToUnlock} />
          </div>

          {/* Redesigned Training Vector Panel */}
          <Panel title="Training vector">
            <div className="p-6 md:p-8 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1.5">
                  <span className="font-label text-xs font-semibold text-primary-container uppercase tracking-wider">Active Training Tier</span>
                  <h2 className="font-headline text-3xl font-extrabold text-white tracking-tight mt-1">{data.currentTierTitle}</h2>
                  <p className="text-sm text-fog-muted font-body">Level 0{data.currentTier} of 05</p>
                </div>
                
                <div className="flex items-center gap-4 bg-surface-container-high border border-surgical-steel/60 px-5 py-3.5 rounded-xl shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] font-label text-fog-muted uppercase tracking-wider font-bold">Tier Progress</p>
                    <p className="font-headline text-2xl font-black text-primary-container mt-0.5">{tierProgress}%</p>
                  </div>
                  <div className="w-px h-8 bg-surgical-steel" />
                  <div>
                    <p className="text-[10px] font-label text-fog-muted uppercase tracking-wider font-bold">Completed</p>
                    <p className="font-headline text-2xl font-bold text-white mt-0.5">{data.currentTierCompleted}<span className="text-sm text-fog-muted font-normal">/{data.currentTierTotal}</span></p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2.5">
                <div className="h-3.5 w-full bg-surface-container-high rounded-full overflow-hidden border border-surgical-steel p-0.5">
                  <div className="h-full bg-primary-container rounded-full transition-all duration-700 ease-out-expo emerald-glow" style={{ width: `${tierProgress}%` }} />
                </div>
                <div className="flex justify-between items-center text-xs font-label text-fog-muted px-1">
                  <span>{data.isMaster ? "Highest Tier Attained" : `Unlocks ${getTierTitle(data.currentTier + 1)} at 100% completion`}</span>
                  <span className="text-primary-container font-medium">{data.currentTierTotal - data.currentTierCompleted} lessons remaining</span>
                </div>
              </div>
            </div>
          </Panel>

          {/* Redesigned Clickable Continue Learning Card */}
          <Link 
            href={data.activeLesson ? withRouteBase(routeBase, `/courses/lesson/${data.activeLesson.id}`) : withRouteBase(routeBase, "/courses")} 
            className="block group"
          >
            <div className="border border-surgical-steel bg-monolith-surface rounded-xl overflow-hidden hover:border-primary-container/40 active:scale-[0.99] transition-all duration-200">
              <div className="min-h-11 border-b border-surgical-steel bg-surface-container-high px-4 py-3 font-label text-xs uppercase tracking-[0.16em] text-fog-muted font-bold group-hover:text-primary-container group-hover:bg-surface-container-high/80 transition-colors flex justify-between items-center">
                <span>Continue learning</span>
                <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-250 text-primary-container" />
              </div>
              <div className="p-6">
                {data.activeLesson ? (
                  <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-3.5 flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="border border-surgical-steel bg-surface-container-high px-2 py-0.5 rounded font-label text-[10px] text-fog-muted font-semibold tracking-wider">ACTIVE</span>
                        <span className="text-xs font-label text-primary-container/70 group-hover:text-primary-container transition-colors font-medium">Resume lesson &rarr;</span>
                      </div>
                      <h3 className="font-headline text-xl font-bold text-white leading-snug group-hover:text-primary-container transition-colors">{data.activeLesson.title}</h3>
                      <p className="max-w-xl font-body text-sm text-on-surface-variant group-hover:text-white transition-colors">{data.activeLesson.description || "Continue your current lesson."}</p>
                      
                      <div className="space-y-2 pt-2 max-w-md">
                        <div className="flex justify-between font-label text-xs">
                          <span className="text-fog-muted">Lesson Progress</span>
                          <span className="text-primary-container font-semibold">{Math.round(data.activeLesson.progress)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden border border-surgical-steel">
                          <div className="h-full bg-primary-container rounded-full transition-all duration-500 emerald-glow" style={{ width: `${data.activeLesson.progress}%` }} />
                        </div>
                      </div>
                    </div>
                    
                    <div className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary-container px-6 font-label-md text-label-md text-on-primary-fixed uppercase tracking-wider group-hover:brightness-110 active:scale-[0.98] transition-all emerald-glow shrink-0 self-start md:self-center">
                      Resume
                      <ArrowRight size={16} className="ml-1.5" />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 space-y-3">
                    <h3 className="font-headline text-lg font-bold text-white">Your curriculum is clear</h3>
                    <p className="text-sm text-on-surface-variant max-w-md mx-auto">New lessons will appear here as they are released. Click to explore all courses.</p>
                    <span className="inline-block text-xs font-label text-primary-container uppercase tracking-wider hover:underline">Explore Curriculum &rarr;</span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        </div>

        {/* Right Column: Events & Roles */}
        <div className="relative space-y-6 md:col-span-4">
          
          {/* Redesigned Clickable Upcoming Event Card */}
          <Link href={withRouteBase(routeBase, "/events")} className="block group">
            <div className="border border-surgical-steel bg-monolith-surface rounded-xl overflow-hidden hover:border-primary-container/40 active:scale-[0.99] transition-all duration-200">
              <div className="min-h-11 border-b border-surgical-steel bg-surface-container-high px-4 py-3 font-label text-xs uppercase tracking-[0.16em] text-fog-muted font-bold group-hover:text-primary-container group-hover:bg-surface-container-high/80 transition-colors flex justify-between items-center">
                <span>Upcoming event</span>
                <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-250 text-primary-container" />
              </div>
              <div className="p-6 space-y-4">
                {data.upcomingEvent ? (
                  <>
                    <div className="flex justify-between items-start gap-4">
                      <span className="border border-primary-container bg-primary-container/10 px-2.5 py-0.5 rounded font-label text-[10px] text-primary-container font-semibold uppercase tracking-wider group-hover:bg-primary-container group-hover:text-on-primary-fixed transition-colors">
                        {data.upcomingEvent.status}
                      </span>
                      <span className="font-label text-xs text-primary-container/70 group-hover:text-primary-container transition-colors font-medium">View Event &rarr;</span>
                    </div>
                    <h3 className="font-headline text-lg font-bold text-white leading-snug group-hover:text-primary-container transition-colors">{data.upcomingEvent.title}</h3>
                    <p className="text-sm text-on-surface-variant line-clamp-2">{data.upcomingEvent.description || "Live member session"}</p>
                    <div className="border-t border-surgical-steel pt-4 font-label text-xs text-primary-container uppercase tracking-wider font-semibold group-hover:text-white transition-colors">
                      {eventDate(data.upcomingEvent.starts_at)}
                    </div>
                  </>
                ) : (
                  <div className="py-4 text-center space-y-2">
                    <p className="text-sm text-on-surface-variant">No upcoming events are scheduled.</p>
                    <span className="inline-block text-xs font-label text-primary-container uppercase tracking-wider hover:underline">Browse calendar &rarr;</span>
                  </div>
                )}
              </div>
            </div>
          </Link>

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
    <section className="border border-surgical-steel bg-monolith-surface rounded-xl overflow-hidden">
      <div className="min-h-11 border-b border-surgical-steel bg-surface-container-high px-4 py-3 font-label text-xs uppercase tracking-[0.16em] text-fog-muted font-bold">
        {title}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-surgical-steel bg-monolith-surface p-5 rounded-xl hover:border-primary-container/20 transition-colors duration-200">
      <p className="font-label text-xs uppercase tracking-[0.14em] text-fog-muted font-bold">{label}</p>
      <p className="mt-2.5 font-headline text-2xl font-bold text-white tracking-tight">{value}</p>
    </div>
  );
}
