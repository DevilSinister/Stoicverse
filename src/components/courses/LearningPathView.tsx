"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { BookOpen, CalendarDays, CheckCircle2, ChevronRight, Clock, Crown, GraduationCap, LayoutDashboard, Lock, LockKeyhole, LogOut, Menu, MessageSquare, Play, PlayCircle, Search, User } from "lucide-react";
import { buildAppNav } from "@/lib/navigation/app-nav";

export type LessonProgressItem = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  duration: number | null;
  isCompleted: boolean;
  completionPercentage: number;
  isLocked: boolean;
  isUpcoming: boolean;
};

export type TierProgressItem = {
  level: number;
  title: string;
  description: string | null;
  lessons: LessonProgressItem[];
  isLocked: boolean;
  completedCount: number;
  totalCount: number;
};

export type LearningPathData = {
  memberName: string;
  platformRole: string;
  currentTier: number;
  isMaster: boolean;
  tiers: TierProgressItem[];
};

type FilterType = "all" | "in-progress" | "available" | "completed" | "locked";

export function LearningPathView({ data }: { data: LearningPathData }) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = useMemo(() => buildAppNav({ isMaster: data.isMaster }), [data.isMaster]);

  // Aggregate all lessons across all tiers
  const allLessons = useMemo(() => {
    return data.tiers.flatMap((tier) => 
      tier.lessons.map((lesson) => ({
        ...lesson,
        tierLevel: tier.level,
        tierTitle: tier.title,
      }))
    );
  }, [data.tiers]);

  // Filtered lessons list
  const filteredLessons = useMemo(() => {
    return allLessons.filter((lesson) => {
      if (filter === "all") return true;
      if (filter === "completed") return lesson.isCompleted;
      if (filter === "locked") return lesson.isLocked;
      if (filter === "in-progress") {
        return !lesson.isCompleted && !lesson.isLocked && lesson.completionPercentage > 0;
      }
      if (filter === "available") {
        return !lesson.isCompleted && !lesson.isLocked && lesson.completionPercentage === 0;
      }
      return true;
    });
  }, [allLessons, filter]);

  // Calculate overall progress percentage
  const overallProgress = useMemo(() => {
    const total = allLessons.length;
    if (total === 0) return 0;
    const completed = allLessons.filter((l) => l.isCompleted).length;
    return Math.round((completed / total) * 100);
  }, [allLessons]);

  const activeTier = useMemo(() => {
    if (data.isMaster) return 5;
    return data.currentTier;
  }, [data.isMaster, data.currentTier]);

  return (
    <div className="min-h-screen bg-surface text-on-surface md:flex">
      {/* Mobile Header */}
      <header className="flex h-16 items-center justify-between border-b border-surgical-steel bg-surface px-4 md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(true)} className="text-on-surface-variant hover:text-primary-container" aria-label="Open menu">
            <Menu size={24} />
          </button>
          <span className="font-headline-sm text-headline-sm font-bold text-primary tracking-tight">Stoicverse</span>
        </div>
        <span className="font-label-sm text-label-sm bg-primary-container/10 text-primary-container px-3 py-1 rounded">
          T{activeTier}
        </span>
      </header>

      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/80 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-surgical-steel bg-surface-container-low transition-transform duration-300 md:static md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="border-b border-surgical-steel p-4 flex items-center justify-between">
          <Link href="/" className="block">
            <div className="font-headline-sm text-headline-sm text-primary font-bold">Stoicverse</div>
            <div className="mt-1 font-label-sm text-label-sm text-fog-muted uppercase tracking-[0.1em]">Community Hub</div>
          </Link>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/courses";
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex min-h-11 items-center gap-3 px-3 py-2 rounded-lg font-label-md text-label-md transition ${isActive ? "bg-surface-container-high text-primary-container border-r-2 border-primary-container" : "text-on-surface-variant hover:bg-surface-container-high hover:text-primary-container"}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-surgical-steel p-4 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="size-8 rounded-full bg-surface-container-high flex items-center justify-center text-primary-container border border-surgical-steel font-bold">
              {data.memberName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{data.memberName}</p>
              <p className="truncate text-xs text-fog-muted capitalize">{data.platformRole}</p>
            </div>
          </div>
          <Link href="/subscription" className="flex w-full items-center justify-center gap-2 rounded bg-primary-container hover:bg-opacity-90 py-3 font-label-md text-label-md text-on-primary-fixed uppercase tracking-wider transition">
            <Crown size={16} />
            <span>Upgrade to Master</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 min-h-screen px-4 md:px-8 py-8 max-w-[1440px] mx-auto space-y-8">
        {/* Header & Overall Progress */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-surgical-steel">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-white">Learning Path</h1>
            <p className="font-body text-body-lg text-on-surface-variant mt-2 max-w-lg">
              A rigorous curriculum designed for disciplined capital management and psychological fortitude.
            </p>
          </div>
          <div className="w-full md:w-80 space-y-2">
            <div className="flex justify-between items-end">
              <span className="font-label text-label-sm text-on-surface-variant uppercase tracking-wider">Overall Progress</span>
              <span className="font-label text-label-sm text-primary-container font-semibold">{overallProgress}% Mastery</span>
            </div>
            <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden border border-surgical-steel">
              <div className="h-full bg-primary-container rounded-full transition-all duration-500 emerald-glow" style={{ width: `${overallProgress}%` }} />
            </div>
          </div>
        </header>

        {/* Tier Overview Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {data.tiers.map((tier) => {
            const isCompleted = tier.completedCount === tier.totalCount && tier.totalCount > 0;
            const isActive = activeTier === tier.level;

            return (
              <div
                key={tier.level}
                className={`relative p-5 rounded-lg border transition-all duration-300 flex flex-col justify-between min-h-[140px] ${tier.isLocked ? "bg-surface-container-low/40 border-surgical-steel/40 opacity-50" : isActive ? "bg-monolith-surface border-primary-container/50 emerald-glow ring-1 ring-primary-container/20" : "bg-monolith-surface border-surgical-steel hover:border-primary-container/30"}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="font-label text-xs font-semibold text-primary-container uppercase tracking-wider">Tier 0{tier.level}</span>
                  {tier.isLocked ? (
                    <Lock size={16} className="text-fog-muted" />
                  ) : isCompleted ? (
                    <span className="text-primary-container flex items-center gap-1 font-label text-xs bg-primary-container/10 px-2 py-0.5 rounded">
                      COMPLETE
                    </span>
                  ) : isActive ? (
                    <span className="text-primary-container flex items-center gap-1 font-label text-xs bg-primary-container/20 px-2 py-0.5 rounded font-bold">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="text-fog-muted font-label text-xs">
                      {tier.completedCount}/{tier.totalCount} Lessons
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-headline text-lg font-bold text-white mb-1">{tier.title}</h3>
                  <p className="font-body text-xs text-on-surface-variant line-clamp-2">{tier.description}</p>
                </div>
                {!tier.isLocked && <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary-container to-transparent" />}
              </div>
            );
          })}
        </section>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-surgical-steel pb-4">
          {(["all", "in-progress", "available", "completed", "locked"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-1.5 rounded-full font-label text-xs uppercase tracking-wider transition ${filter === t ? "bg-primary-container text-on-primary-fixed border border-primary-container" : "bg-transparent text-on-surface-variant hover:text-white border border-transparent hover:border-surgical-steel"}`}
            >
              {t.replace("-", " ")}
            </button>
          ))}
        </div>

        {/* Lessons List Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredLessons.map((lesson) => {
            const inProgress = !lesson.isCompleted && !lesson.isLocked && lesson.completionPercentage > 0;
            const isCompleted = lesson.isCompleted;
            const isLocked = lesson.isLocked;

            return (
              <div
                key={lesson.id}
                className={`p-5 rounded-lg border transition-all duration-300 flex flex-col md:flex-row gap-5 ${isLocked ? "bg-surface-container-low/40 border-surgical-steel/40 opacity-40" : "bg-monolith-surface border-surgical-steel hover:border-primary-container/40"}`}
              >
                {/* Thumbnail Block */}
                <div className="w-full md:w-36 aspect-video md:aspect-auto md:h-28 shrink-0 bg-surface-container-lowest border border-surgical-steel rounded overflow-hidden relative flex items-center justify-center group">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-container/10 to-transparent group-hover:opacity-100 transition-opacity" />
                  {isLocked ? (
                    <Lock size={32} className="text-fog-muted z-10" />
                  ) : isCompleted ? (
                    <CheckCircle2 size={32} className="text-primary-container z-10" />
                  ) : (
                    <PlayCircle size={32} className="text-primary-container opacity-80 group-hover:scale-110 transition z-10" />
                  )}
                  {inProgress && (
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-surface-container-high">
                      <div className="h-full bg-primary-container" style={{ width: `${lesson.completionPercentage}%` }} />
                    </div>
                  )}
                </div>

                {/* Lesson Info */}
                <div className="flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-label text-[10px] text-fog-muted bg-surface-container-high px-2 py-0.5 rounded border border-surgical-steel">
                          T0{lesson.tierLevel}
                        </span>
                        {isLocked ? (
                          <span className="font-label text-[10px] text-fog-muted uppercase tracking-wider">LOCKED</span>
                        ) : isCompleted ? (
                          <span className="font-label text-[10px] text-primary-container font-bold uppercase tracking-wider">COMPLETED</span>
                        ) : inProgress ? (
                          <span className="font-label text-[10px] text-primary-container bg-primary-container/10 px-2 py-0.5 rounded uppercase tracking-wider">IN PROGRESS</span>
                        ) : (
                          <span className="font-label text-[10px] text-secondary bg-secondary/10 px-2 py-0.5 rounded uppercase tracking-wider">AVAILABLE</span>
                        )}
                      </div>
                      {lesson.duration && (
                        <div className="flex items-center gap-1 text-xs text-fog-muted font-label">
                          <Clock size={12} />
                          <span>{lesson.duration}m</span>
                        </div>
                      )}
                    </div>
                    <h2 className="font-headline text-base font-bold text-white mt-2">{lesson.title}</h2>
                    <p className="font-body text-sm text-on-surface-variant">{lesson.description}</p>
                  </div>

                  {/* Actions */}
                  {!isLocked && (
                    <div className="pt-2">
                      <Link
                        href={`/courses/lesson/${lesson.id}`}
                        className={`inline-flex items-center gap-2 rounded px-4 py-2 font-label text-xs uppercase tracking-wider transition ${isCompleted ? "border border-surgical-steel text-on-surface-variant hover:text-white hover:border-primary-container/50" : inProgress ? "bg-primary-container text-on-primary-fixed hover:bg-opacity-90" : "border border-primary-container text-primary-container hover:bg-primary-container/10"}`}
                      >
                        {isCompleted ? "Review" : inProgress ? "Resume" : "Start"}
                        <ChevronRight size={14} />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filteredLessons.length === 0 && (
            <div className="col-span-full py-16 text-center border border-dashed border-surgical-steel rounded-lg bg-surface-container-low/20">
              <GraduationCap size={48} className="mx-auto text-fog-muted mb-4" />
              <p className="font-headline text-lg font-semibold text-white">No lessons found</p>
              <p className="font-body text-sm text-on-surface-variant mt-1">Try changing your filter options above.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
