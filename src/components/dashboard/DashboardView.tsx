"use client";

import Link from "next/link";
import { Bell, Menu, Search, X, LayoutDashboard, Crown, Play, CalendarDays, BookOpen, AlertCircle, ArrowRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { buildAppNav } from "@/lib/navigation/app-nav";

type Notification = { id: string; type: string; title: string; body: string | null; action_url: string | null; is_read: boolean; created_at: string };
type Event = { id: string; title: string; description: string | null; starts_at: string; min_tier: number; status: string };

export type DashboardData = {
  memberName: string; platformRole: string; currentTier: number; isMaster: boolean; currentTierTitle: string;
  completedLessons: number; totalLessons: number; currentTierCompleted: number; currentTierTotal: number;
  activeLesson: { id: string; title: string; description: string | null; progress: number } | null;
  upcomingEvent: Event | null; notifications: Notification[];
};

type SearchResult = { id: string; title: string; description: string | null; href: string; kind: "lesson" | "event" };
const roleName = (role: string) => role.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const eventDate = (value: string) => new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));

export function DashboardView({ data }: { data: DashboardData }) {
  const [notifications, setNotifications] = useState(data.notifications);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;
  const tierProgress = data.currentTierTotal ? Math.round((data.currentTierCompleted / data.currentTierTotal) * 100) : 0;
  const roles = useMemo(() => ["Subscriber", roleName(data.platformRole), data.isMaster ? "Master" : `Tier ${data.currentTier} (${data.currentTierTitle})`], [data]);
  const navItems = useMemo(() => buildAppNav({ isMaster: data.isMaster }), [data.isMaster]);
  const visibleResults = query.trim().length >= 2 ? results : [];

  useEffect(() => { if (isSearchOpen) searchInput.current?.focus(); }, [isSearchOpen]);
  useEffect(() => {
    if (!isSearchOpen || query.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/dashboard/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const payload = await response.json() as { results?: SearchResult[] };
        setResults(response.ok ? payload.results ?? [] : []);
      } finally { if (!controller.signal.aborted) setSearching(false); }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [query, isSearchOpen]);

  async function openNotifications() {
    setNotificationsOpen(true);
    const unreadIds = notifications.filter((notification) => !notification.is_read).map((notification) => notification.id);
    if (!unreadIds.length) return;
    setNotifications((previous) => previous.map((notification) => unreadIds.includes(notification.id) ? { ...notification, is_read: true } : notification));
    const response = await fetch("/api/dashboard/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: unreadIds }) });
    if (!response.ok) setNotifications((previous) => previous.map((notification) => unreadIds.includes(notification.id) ? { ...notification, is_read: false } : notification));
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface md:flex">
      {/* Mobile Sidebar Toggle Header */}
      <header className="flex h-16 items-center justify-between border-b border-surgical-steel bg-surface px-4 md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(true)} className="text-on-surface-variant hover:text-primary-container" aria-label="Open menu">
            <Menu size={24} />
          </button>
          <span className="font-headline-sm text-headline-sm font-bold text-primary tracking-tight">Stoicverse</span>
        </div>
        <span className="font-label-sm text-label-sm bg-primary-container/10 text-primary-container px-3 py-1 rounded">
          T0{data.currentTier}
        </span>
      </header>

      {/* Mobile menu backdrop */}
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
            const isActive = item.href === "/dashboard";
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
            <span>Upgrade Plan</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="min-w-0 flex-1 flex flex-col">
        {/* Desk Header */}
        <header className="sticky top-0 z-20 hidden md:flex min-h-16 items-center justify-between border-b border-surgical-steel bg-surface px-8">
          <div>
            <h1 className="font-headline-sm text-headline-sm text-white font-bold">Welcome back, {data.memberName}</h1>
            <p className="text-xs text-fog-muted">Your learning command centre</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setSearchOpen(true)} aria-label="Search lessons and events" className="grid size-10 place-items-center rounded border border-surgical-steel text-on-surface-variant hover:border-primary-container hover:text-primary-container focus-ring transition-colors">
              <Search size={18} />
            </button>
            <button onClick={openNotifications} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} className="relative grid size-10 place-items-center rounded border border-surgical-steel text-on-surface-variant hover:border-primary-container hover:text-primary-container focus-ring transition-colors">
              <Bell size={18} />
              {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 size-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <main className="relative grid gap-6 p-4 md:p-8 md:grid-cols-12 max-w-[1440px]">
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
                    <Link href={`/courses/lesson/${data.activeLesson.id}`} className="inline-flex min-h-11 items-center justify-center rounded bg-primary-container px-6 font-label-md text-label-md text-on-primary-fixed uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all emerald-glow shrink-0">
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
      </div>

      {/* Search Modal */}
      {isSearchOpen && (
        <Modal title="Search Stoicverse" onClose={() => setSearchOpen(false)}>
          <div className="space-y-4">
            <label className="sr-only" htmlFor="dashboard-search">Search lessons and events</label>
            <input
              ref={searchInput}
              id="dashboard-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search lessons and events…"
              className="w-full rounded border border-surgical-steel bg-surface-container-lowest p-3.5 text-on-surface outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all"
            />
            {searching && (
              <div className="flex items-center gap-2 text-sm text-fog-muted">
                <div className="size-4 border-2 border-primary-container border-t-transparent rounded-full animate-spin" />
                <span>Searching…</span>
              </div>
            )}
            <div className="divide-y divide-surgical-steel max-h-[40vh] overflow-y-auto">
              {visibleResults.map((result) => (
                <Link
                  onClick={() => setSearchOpen(false)}
                  href={result.href}
                  key={`${result.kind}-${result.id}`}
                  className="block py-3 group hover:text-primary-container transition"
                >
                  <p className="font-label text-[10px] uppercase text-primary-container font-semibold tracking-wider">{result.kind}</p>
                  <p className="mt-1 font-headline text-sm font-semibold text-white group-hover:text-primary-container transition">{result.title}</p>
                  {result.description && <p className="mt-1 font-body text-xs text-fog-muted line-clamp-1">{result.description}</p>}
                </Link>
              ))}
              {query.trim().length >= 2 && !searching && visibleResults.length === 0 && (
                <div className="py-6 text-center text-sm text-fog-muted">
                  <AlertCircle size={20} className="mx-auto mb-2 opacity-50" />
                  <span>No accessible results found.</span>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Notifications Modal */}
      {isNotificationsOpen && (
        <Modal title="Notifications" onClose={() => setNotificationsOpen(false)}>
          <div className="space-y-6">
            <section className="border-b border-surgical-steel pb-4">
              <p className="font-label text-xs uppercase text-primary-container font-semibold tracking-wider">Account access</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {roles.map((role) => (
                  <span key={role} className="border border-surgical-steel bg-surface-container-low px-2.5 py-1 rounded font-label text-xs">
                    {role}
                  </span>
                ))}
              </div>
            </section>
            
            <div className="divide-y divide-surgical-steel max-h-[50vh] overflow-y-auto pr-1">
              {notifications.map((notification) => (
                <article key={notification.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex gap-3">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.is_read ? "bg-surgical-steel" : "bg-red-500"}`} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-semibold text-white leading-snug">{notification.title}</p>
                      {notification.body && <p className="font-body text-xs text-fog-muted leading-relaxed">{notification.body}</p>}
                      <div className="flex items-center justify-between pt-2">
                        {notification.action_url && (
                          <Link href={notification.action_url} className="font-label text-xs text-primary-container hover:underline uppercase tracking-wider font-semibold">
                            View details
                          </Link>
                        )}
                        <p className="font-label text-[10px] text-fog-muted">{eventDate(notification.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {notifications.length === 0 && (
                <div className="py-8 text-center text-fog-muted">
                  <p className="font-headline text-base font-semibold text-white">You are all caught up</p>
                  <p className="font-body text-xs mt-1">Account, role, and event updates will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-surgical-steel bg-monolith-surface rounded-lg overflow-hidden">
      <div className="min-h-11 border-b border-surgical-steel bg-surface-container-high px-4 py-3 font-label text-xs uppercase tracking-[0.16em] text-fog-muted font-bold">
        {title}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-surgical-steel bg-monolith-surface p-5 rounded-lg">
      <p className="font-label text-xs uppercase tracking-[0.14em] text-fog-muted font-bold">{label}</p>
      <p className="mt-3 font-headline text-2xl font-bold text-primary-container">{value}</p>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onMouseDown={onClose}>
      <div className="max-h-[85vh] w-full max-w-xl overflow-auto border border-surgical-steel bg-monolith-surface p-6 rounded-lg shadow-2xl animate-in zoom-in-95 duration-200" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between border-b border-surgical-steel pb-4">
          <h2 className="font-headline text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="p-1 text-on-surface-variant hover:text-primary-container transition" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
