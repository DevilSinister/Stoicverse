"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Lock, PlayCircle, Sparkles } from "lucide-react";
import { useMemo } from "react";

import { AppShell, type Notification } from "@/components/layout/AppShell";
import { withRouteBase } from "@/lib/navigation/paths";

type Event = { id: string; title: string; description: string | null; starts_at: string; min_tier: number; status: string };

export type TierProgressDetail = {
  level: number;
  title: string;
  completedCount: number;
  totalCount: number;
  status: "locked" | "active" | "completed";
};

export type DashboardData = {
  memberName: string;
  platformRole: string;
  currentTier: number;
  isMaster: boolean;
  currentTierTitle: string;
  completedLessons: number;
  totalLessons: number;
  currentTierCompleted: number;
  currentTierTotal: number;
  activeLesson: { id: string; title: string; description: string | null; progress: number; completedVideos: number; totalVideos: number; remainingMinutes: number; isCompleted: boolean } | null;
  enrolledCourses: { id: string; title: string; description: string | null; progress: number; completedVideos: number; totalVideos: number; remainingMinutes: number; isCompleted: boolean }[];
  upcomingEvent: Event | null;
  notifications: Notification[];
  tierProgressDetails: TierProgressDetail[];
};

const roleName = (role: string) => role.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const eventDate = (value: string) => new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));

export function DashboardView({ data, routeBase = "" }: { data: DashboardData; routeBase?: string }) {
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

  // Calculate remaining courses in Tiers 1-4 before reaching Mastery (Tier 5)
  const coursesToMastery = useMemo(() => {
    return data.tierProgressDetails.reduce((sum, tier) => {
      const remaining = Math.max(0, tier.totalCount - tier.completedCount);
      return sum + remaining;
    }, 0);
  }, [data.tierProgressDetails]);

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
            <Metric label="Courses completed" value={`${data.completedLessons} / ${data.totalLessons}`} />
            <Metric label="Next tier to unlock" value={nextTierToUnlock} />
          </div>

          {/* Redesigned 4-Segment Training Vector Panel */}
          <Panel title="Training vector & mastery progress">
            <div className="p-6 md:p-8 space-y-6">
              
              {/* Mastery Heading & Remaining Calculator */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1.5">
                  <span className="font-label text-xs font-semibold text-primary-container uppercase tracking-wider">STOIC PATHWAY</span>
                  <h2 className="font-headline text-3xl font-extrabold text-white tracking-tight mt-1">
                    {data.isMaster ? "Stoic Master" : data.currentTierTitle}
                  </h2>
                  <p className="text-sm text-fog-muted font-body">
                    {data.isMaster 
                      ? "You have completed all tiers and achieved Master status."
                      : `Currently active at Level 0${data.currentTier} of 04.`}
                  </p>
                </div>
                
                <div className="flex items-center gap-4 bg-surface-container-high border border-surgical-steel/60 px-5 py-3.5 rounded-xl shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] font-label text-fog-muted uppercase tracking-wider font-bold">Pathway Status</p>
                    <p className="font-headline text-lg font-bold text-white mt-1">
                      {data.isMaster ? (
                        <span className="text-primary-container flex items-center gap-1.5 font-extrabold text-sm uppercase tracking-wider">
                          <Sparkles size={14} /> Mastered
                        </span>
                      ) : coursesToMastery === 0 ? (
                        <span className="text-primary-container font-extrabold text-sm uppercase tracking-wider">Prereqs Met</span>
                      ) : (
                        <span className="text-white font-extrabold text-sm uppercase tracking-wider">{coursesToMastery} course{coursesToMastery === 1 ? "" : "s"} left</span>
                      )}
                    </p>
                  </div>
                  <div className="w-px h-8 bg-surgical-steel" />
                  <div>
                    <p className="text-[10px] font-label text-fog-muted uppercase tracking-wider font-bold">To Mastery</p>
                    <p className="font-headline text-xs font-semibold text-primary-container mt-1.5">
                      {data.isMaster ? "Completed" : `${coursesToMastery} courses to unlock Master Zone`}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* 4-Segmented Progress Line */}
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2.5">
                  {data.tierProgressDetails.map((tier) => {
                    const segmentProgress = tier.status === "completed" 
                      ? 100 
                      : tier.status === "locked" 
                      ? 0 
                      : tier.totalCount > 0 
                      ? Math.round((tier.completedCount / tier.totalCount) * 100)
                      : 0;

                    return (
                      <div key={tier.level} className="space-y-1.5">
                        <div className="h-3 w-full bg-surface-container-high rounded-full overflow-hidden border border-surgical-steel/70 p-0.5 relative">
                          <div 
                            className={`h-full rounded-full transition-all duration-700 ease-out-expo ${
                              tier.status === "completed" 
                                ? "bg-primary-container emerald-glow"
                                : tier.status === "active"
                                ? "bg-primary-container/80 emerald-glow"
                                : "bg-transparent"
                            }`} 
                            style={{ width: `${segmentProgress}%` }} 
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-label px-0.5">
                          <span className={`${tier.status === "locked" ? "text-fog-muted" : "text-white font-medium"}`}>
                            T0{tier.level}
                          </span>
                          <span className={`${tier.status === "locked" ? "text-fog-muted/65" : "text-primary-container font-mono"}`}>
                            {segmentProgress}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between items-center text-xs font-label text-fog-muted pt-1">
                  <span>{data.isMaster ? "Highest attainment reached." : "Unlock the final Master tier by completing all prerequisite courses."}</span>
                </div>
              </div>

              {/* Individual Tier calculators details */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-4 border-t border-surgical-steel/40">
                {data.tierProgressDetails.map((tier) => {
                  const isActive = tier.status === "active";
                  const isCompleted = tier.status === "completed";
                  
                  return (
                    <div 
                      key={tier.level} 
                      className={`rounded-lg border p-3.5 space-y-2 transition-all ${
                        isActive
                          ? "border-primary-container bg-primary-container/5"
                          : isCompleted
                          ? "border-surgical-steel bg-surface-container-high/40 opacity-90"
                          : "border-surgical-steel/40 bg-surface-container-low/10 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-label uppercase tracking-wider text-fog-muted">
                          Tier 0{tier.level}
                        </span>
                        {isCompleted ? (
                          <CheckCircle2 size={13} className="text-primary-container" />
                        ) : isActive ? (
                          <PlayCircle size={13} className="text-primary-container" />
                        ) : (
                          <Lock size={13} className="text-fog-muted" />
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-headline font-bold text-white leading-tight">
                          {tier.title}
                        </h4>
                        <p className="text-[11px] font-label text-fog-muted mt-1">
                          {tier.completedCount} / {tier.totalCount} Course{tier.totalCount === 1 ? "" : "s"}
                        </p>
                      </div>

                      <div className="text-[10px] font-body">
                        {isCompleted ? (
                          <span className="text-primary-container font-semibold">Tier Completed</span>
                        ) : isActive ? (
                          <span className="text-white font-medium">Currently Studying</span>
                        ) : (
                          <span className="text-fog-muted">Locked</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </Panel>

          {/* Redesigned Clickable Continue Learning Card */}
          <Link 
            href={data.activeLesson ? withRouteBase(routeBase, `/courses/${data.activeLesson.id}`) : withRouteBase(routeBase, "/courses")}
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
                        <span className="text-xs font-label text-primary-container/70 group-hover:text-primary-container transition-colors font-medium">Resume course &rarr;</span>
                      </div>
                      <h3 className="font-headline text-xl font-bold text-white leading-snug group-hover:text-primary-container transition-colors">{data.activeLesson.title}</h3>
                      <p className="max-w-xl font-body text-sm text-on-surface-variant group-hover:text-white transition-colors">{data.activeLesson.description || "Continue your current course."}</p>
                      
                      <div className="space-y-2 pt-2 max-w-md">
                        <div className="flex justify-between font-label text-xs">
                          <span className="text-fog-muted">Course Progress</span>
                          <span className="text-primary-container font-semibold">{Math.round(data.activeLesson.progress)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden border border-surgical-steel">
                          <div className="h-full bg-primary-container rounded-full transition-all duration-500 emerald-glow" style={{ width: `${data.activeLesson.progress}%` }} />
                        </div>
                      </div>
                      <div className="grid max-w-md grid-cols-3 divide-x divide-surgical-steel border border-surgical-steel bg-surface-container-low/30 text-center">
                        <div className="px-3 py-3"><p className="text-[10px] font-label uppercase tracking-wide text-fog-muted">Lessons</p><p className="mt-1 text-sm font-semibold tabular-nums text-white">{data.activeLesson.completedVideos}/{data.activeLesson.totalVideos}</p></div>
                        <div className="px-3 py-3"><p className="text-[10px] font-label uppercase tracking-wide text-fog-muted">Remaining</p><p className="mt-1 text-sm font-semibold tabular-nums text-white">{data.activeLesson.remainingMinutes}m</p></div>
                        <div className="px-3 py-3"><p className="text-[10px] font-label uppercase tracking-wide text-fog-muted">Status</p><p className="mt-1 text-sm font-semibold text-primary-container">{data.activeLesson.isCompleted ? "Complete" : "Active"}</p></div>
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
                    <p className="text-sm text-on-surface-variant max-w-md mx-auto">New courses and videos will appear here as they are released.</p>
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
