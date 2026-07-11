"use client";

import Link from "next/link";
import { Bell, Menu, Search, X } from "lucide-react";
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

  return <div className="min-h-screen bg-[var(--color-surface-container-lowest)] text-[var(--color-on-surface)] md:flex">
    <aside className="hidden w-64 shrink-0 border-r border-[var(--color-surgical-steel)] bg-[var(--color-monolith-surface)] md:flex md:min-h-screen md:flex-col"><Link href="/" className="border-b border-[var(--color-surgical-steel)] p-4"><div className="font-headline-sm text-headline-sm text-[var(--color-primary)]">Stoicverse</div><div className="mt-1 font-label-sm text-label-sm text-[var(--color-fog-muted)]">Community Hub</div></Link><nav className="flex-1 py-2">{navItems.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={`mx-2 my-1 flex min-h-11 items-center gap-3 px-3 font-label-md text-label-md transition ${item.href === "/dashboard" ? "border-r-2 border-[var(--color-primary-container)] bg-[var(--color-surface-container-high)] text-[var(--color-primary-container)]" : "text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-high)] hover:text-[var(--color-primary-container)]"}`}><Icon size={18} />{item.label}</Link>; })}</nav></aside>
    <div className="min-w-0 flex-1"><header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-[var(--color-surgical-steel)] bg-[var(--color-surface)] px-4 md:px-8"><div className="flex items-center gap-3"><Menu className="md:hidden" size={22} /><div><p className="font-headline-sm text-headline-sm">Welcome back, {data.memberName}</p><p className="text-xs text-[var(--color-fog-muted)]">Your learning command centre</p></div></div><div className="flex items-center gap-2"><button onClick={() => setSearchOpen(true)} aria-label="Search lessons and events" className="grid size-10 place-items-center border border-[var(--color-surgical-steel)] text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary-container)]"><Search size={18} /></button><button onClick={openNotifications} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} className="relative grid size-10 place-items-center border border-[var(--color-surgical-steel)] text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary-container)]"><Bell size={18} />{unreadCount > 0 && <span className="absolute -right-2 -top-2 grid min-w-5 size-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}</button></div></header>
      <main className="relative grid gap-4 p-4 md:grid-cols-12 md:p-8"><div className="pointer-events-none absolute inset-0 opacity-15 [background-image:linear-gradient(#2A2C2E_1px,transparent_1px),linear-gradient(90deg,#2A2C2E_1px,transparent_1px)] [background-size:64px_64px]" /><div className="relative space-y-4 md:col-span-8"><Panel title="Training vector"><div className="p-6"><p className="font-label-sm text-label-sm text-[var(--color-primary-container)]">Current tier</p><h1 className="mt-2 font-headline-md text-headline-md">{data.currentTierTitle} — Level {data.currentTier}</h1><div className="mt-8 flex justify-between font-code-block text-code-block"><span className="text-[var(--color-fog-muted)]">{data.currentTierCompleted} completed / {data.currentTierTotal} in this tier</span><span className="text-[var(--color-primary-container)]">{tierProgress}%</span></div><div className="mt-2 h-1 bg-[var(--color-surgical-steel)]"><div className="h-full bg-[var(--color-primary-container)]" style={{ width: `${tierProgress}%` }} /></div></div></Panel><Panel title="Continue learning"><div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">{data.activeLesson ? <><div><h2 className="font-headline-sm text-headline-sm">{data.activeLesson.title}</h2><p className="mt-2 max-w-xl text-[var(--color-on-surface-variant)]">{data.activeLesson.description || "Continue your current lesson."}</p><p className="mt-4 font-code-block text-xs text-[var(--color-primary-container)]">{Math.round(data.activeLesson.progress)}% complete</p></div><Link href={`/courses/lesson/${data.activeLesson.id}`} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-primary-container)] px-5 font-label-md text-label-md text-[var(--color-on-primary-fixed)]">Resume lesson</Link></> : <div><h2 className="font-headline-sm text-headline-sm">Your curriculum is clear</h2><p className="mt-2 text-[var(--color-on-surface-variant)]">New lessons will appear here as they are released.</p></div>}</div></Panel><div className="grid gap-4 md:grid-cols-2"><Metric label="Lessons completed" value={`${data.completedLessons} / ${data.totalLessons}`} /><Metric label="Current access" value={data.isMaster ? "Master" : `Tier ${data.currentTier}`} /></div></div><div className="relative space-y-4 md:col-span-4"><Panel title="Upcoming event"><div className="p-6">{data.upcomingEvent ? <><span className="border border-[var(--color-primary-container)] px-2 py-1 font-code-block text-[10px] text-[var(--color-primary-container)]">{data.upcomingEvent.status.toUpperCase()}</span><h2 className="mt-4 font-headline-sm text-headline-sm">{data.upcomingEvent.title}</h2><p className="mt-3 text-sm text-[var(--color-on-surface-variant)]">{data.upcomingEvent.description || "Live member session"}</p><div className="mt-6 border-t border-[var(--color-surgical-steel)] pt-4 font-code-block text-sm text-[var(--color-primary-container)]">{eventDate(data.upcomingEvent.starts_at)}</div></> : <p className="text-[var(--color-on-surface-variant)]">No upcoming events are scheduled.</p>}</div></Panel><Panel title="Account roles"><div className="flex flex-wrap gap-2 p-5">{roles.map((role) => <span key={role} className="border border-[var(--color-surgical-steel)] px-2 py-1 font-code-block text-xs text-[var(--color-primary-container)]">{role}</span>)}</div></Panel></div></main></div>
    {isSearchOpen && <Modal title="Search Stoicverse" onClose={() => setSearchOpen(false)}><label className="sr-only" htmlFor="dashboard-search">Search lessons and events</label><input ref={searchInput} id="dashboard-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lessons and events…" className="w-full border border-[var(--color-surgical-steel)] bg-[var(--color-surface-container-lowest)] p-3 text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary-container)]" />{searching && <p className="mt-4 text-sm text-[var(--color-fog-muted)]">Searching…</p>}<div className="mt-4 divide-y divide-[var(--color-surgical-steel)]">{visibleResults.map((result) => <Link onClick={() => setSearchOpen(false)} href={result.href} key={`${result.kind}-${result.id}`} className="block py-3 hover:text-[var(--color-primary-container)]"><p className="font-label-sm text-xs uppercase text-[var(--color-primary-container)]">{result.kind}</p><p className="mt-1">{result.title}</p>{result.description && <p className="mt-1 text-sm text-[var(--color-fog-muted)]">{result.description}</p>}</Link>)}{query.trim().length >= 2 && !searching && visibleResults.length === 0 && <p className="py-4 text-sm text-[var(--color-fog-muted)]">No accessible results found.</p>}</div></Modal>}
    {isNotificationsOpen && <Modal title="Notifications" onClose={() => setNotificationsOpen(false)}><section className="border-b border-[var(--color-surgical-steel)] pb-4"><p className="font-label-sm text-xs uppercase text-[var(--color-primary-container)]">Account access</p><div className="mt-3 flex flex-wrap gap-2">{roles.map((role) => <span key={role} className="border border-[var(--color-surgical-steel)] px-2 py-1 font-code-block text-xs">{role}</span>)}</div></section><div className="divide-y divide-[var(--color-surgical-steel)]">{notifications.map((notification) => <article key={notification.id} className="py-4"><div className="flex gap-3"><span className={`mt-2 size-2 shrink-0 rounded-full ${notification.is_read ? "bg-[var(--color-surgical-steel)]" : "bg-red-500"}`} /><div><p>{notification.title}</p>{notification.body && <p className="mt-1 text-sm text-[var(--color-fog-muted)]">{notification.body}</p>}{notification.action_url && <Link href={notification.action_url} className="mt-2 inline-block text-sm text-[var(--color-primary-container)]">View details</Link>}<p className="mt-2 text-xs text-[var(--color-fog-muted)]">{eventDate(notification.created_at)}</p></div></div></article>)}{notifications.length === 0 && <p className="py-6 text-[var(--color-fog-muted)]">You are all caught up. Account, role, and event updates will appear here.</p>}</div></Modal>}
  </div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border border-[var(--color-surgical-steel)] bg-[var(--color-monolith-surface)]"><div className="min-h-11 border-b border-[var(--color-surgical-steel)] px-4 py-3 font-label-sm text-label-sm uppercase tracking-[0.16em] text-[var(--color-fog-muted)]">{title}</div>{children}</section>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="border border-[var(--color-surgical-steel)] bg-[var(--color-monolith-surface)] p-5"><p className="font-label-sm text-label-sm uppercase tracking-[0.14em] text-[var(--color-fog-muted)]">{label}</p><p className="mt-3 font-headline-sm text-headline-sm text-[var(--color-primary-container)]">{value}</p></div>; }
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onMouseDown={onClose}><div className="max-h-[80vh] w-full max-w-xl overflow-auto border border-[var(--color-surgical-steel)] bg-[var(--color-monolith-surface)] p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="mb-5 flex items-center justify-between border-b border-[var(--color-surgical-steel)] pb-3"><h2 className="font-headline-sm text-headline-sm">{title}</h2><button onClick={onClose} className="p-1 text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary-container)]" aria-label="Close"><X size={20} /></button></div>{children}</div></div>; }
