"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Menu, Search, X, Crown, LogOut, ChevronRight, AlertCircle } from "lucide-react";

import { buildAppNav } from "@/lib/navigation/app-nav";

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
};

type SearchResult = {
  id: string;
  title: string;
  description: string | null;
  href: string;
  kind: "lesson" | "event";
};

export interface AppShellProps {
  active: string;
  title: string;
  isMaster?: boolean;
  memberName?: string;
  platformRole?: string;
  currentTier?: number;
  notifications?: Notification[];
  children: React.ReactNode;
}

const roleName = (role: string) => role.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const eventDate = (value: string) => new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));

const EMPTY_NOTIFICATIONS: Notification[] = [];

export function AppShell({
  active,
  title,
  isMaster = false,
  memberName = "Practitioner",
  platformRole = "member",
  currentTier = 1,
  notifications: initialNotifications = EMPTY_NOTIFICATIONS,
  children,
}: AppShellProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const navItems = useMemo(() => buildAppNav({ isMaster }), [isMaster]);
  const visibleResults = query.trim().length >= 2 ? results : [];

  // Sync notifications prop changes safely
  useEffect(() => {
    const hasChanged =
      initialNotifications.length !== notifications.length ||
      initialNotifications.some((n, idx) => n.id !== notifications[idx]?.id || n.is_read !== notifications[idx]?.is_read);

    if (hasChanged) {
      setNotifications(initialNotifications);
    }
  }, [initialNotifications, notifications]);

  useEffect(() => {
    if (isSearchOpen) searchInput.current?.focus();
  }, [isSearchOpen]);

  // Search logic
  useEffect(() => {
    if (!isSearchOpen || query.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/dashboard/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const payload = await response.json() as { results?: SearchResult[] };
        setResults(response.ok ? payload.results ?? [] : []);
      } catch (err) {
        // Ignored
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [query, isSearchOpen]);

  async function openNotifications() {
    setNotificationsOpen(true);
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (!unreadIds.length) return;
    
    // Optimistic update
    setNotifications((prev) => prev.map((n) => unreadIds.includes(n.id) ? { ...n, is_read: true } : n));
    
    try {
      const response = await fetch("/api/dashboard/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds })
      });
      if (!response.ok) {
        // Rollback
        setNotifications((prev) => prev.map((n) => unreadIds.includes(n.id) ? { ...n, is_read: false } : n));
      }
    } catch (err) {
      setNotifications((prev) => prev.map((n) => unreadIds.includes(n.id) ? { ...n, is_read: false } : n));
    }
  }

  // Sidebar Render Component
  const renderSidebar = () => (
    <>
      <div className="border-b border-sidebar-border p-4 flex items-center justify-between">
        <Link href="/" className="block">
          <div className="font-headline text-lg text-white font-extrabold tracking-tight">Stoicverse</div>
          <div className="mt-1 font-label text-[10px] text-fog-muted uppercase tracking-[0.12em]">Community Hub</div>
        </Link>
      </div>
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || active === item.label;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex min-h-11 items-center gap-3 px-3 py-2 rounded font-label text-xs uppercase tracking-wider transition ${isActive ? "bg-sidebar-accent text-sidebar-primary border-r-2 border-sidebar-primary font-bold" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary"}`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4 space-y-4 bg-sidebar/80">
        <div className="flex items-center gap-3 px-2">
          <div className="size-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-primary border border-sidebar-border font-bold">
            {memberName[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{memberName}</p>
            <p className="truncate text-[10px] text-fog-muted capitalize font-label">{roleName(platformRole)}</p>
          </div>
        </div>
        <Link href="/subscription" className="flex w-full items-center justify-center gap-2 rounded bg-sidebar-primary hover:bg-opacity-90 py-3 font-label text-xs text-on-primary-fixed uppercase tracking-wider transition duration-200 shadow-md hover:brightness-105">
          <Crown size={14} />
          <span>Upgrade Plan</span>
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface md:flex">
      {/* Mobile Top Bar */}
      <header className="flex h-16 items-center justify-between border-b border-surgical-steel bg-sidebar px-4 md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(true)} className="text-on-surface-variant hover:text-primary-container" aria-label="Open menu">
            <Menu size={24} />
          </button>
          <span className="font-headline text-lg font-extrabold text-white tracking-tight">Stoicverse</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSearchOpen(true)} aria-label="Search" className="p-2 text-on-surface-variant hover:text-primary-container">
            <Search size={18} />
          </button>
          <button onClick={openNotifications} aria-label="Notifications" className="relative p-2 text-on-surface-variant hover:text-primary-container">
            <Bell size={18} />
            {unreadCount > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500" />}
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Slide-out */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 md:hidden ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {renderSidebar()}
      </aside>

      {/* Desktop Sidebar (Fixed) */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:min-h-screen md:flex-col">
        {renderSidebar()}
      </aside>

      {/* Main Workspace Column */}
      <div className="min-w-0 flex-1 flex flex-col">
        {/* Desktop Header */}
        <header className="sticky top-0 z-20 hidden md:flex min-h-16 items-center justify-between border-b border-surgical-steel bg-surface px-8">
          <div>
            <h1 className="font-headline text-lg text-white font-extrabold">{title}</h1>
            <p className="font-label text-[10px] text-fog-muted uppercase tracking-wider">Level 0{currentTier} • {isMaster ? "Master Account" : "Practitioner Access"}</p>
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

        {/* Content Body */}
        <div className="flex-1 bg-surface relative overflow-y-auto">
          {children}
        </div>
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
                <span className="border border-surgical-steel bg-surface-container-low px-2.5 py-1 rounded font-label text-xs">
                  {roleName(platformRole)}
                </span>
                <span className="border border-surgical-steel bg-surface-container-low px-2.5 py-1 rounded font-label text-xs">
                  {isMaster ? "Master Status" : `Tier 0${currentTier}`}
                </span>
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
