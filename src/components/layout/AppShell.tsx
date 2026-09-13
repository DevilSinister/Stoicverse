"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { AlertCircle, Bell, ChevronRight, LoaderCircle, Menu, RefreshCw, Search, X } from "lucide-react";

import { usePathname } from "next/navigation";

import { AppRail } from "@/components/layout/AppRail";
import { activeRailId, buildRail } from "@/lib/navigation/rail";
import { withRouteBase } from "@/lib/navigation/paths";
import { safeNotificationHref, type NotificationItem } from "@/lib/notifications/model";
import { createClient } from "@/lib/supabase/client";

export type Notification = NotificationItem;

type SearchKind = "course" | "video" | "lesson" | "event" | "post" | "channel" | "member";
type SearchResult = { id: string; title: string; description: string | null; href: string; kind: SearchKind };
type NotificationResponse = { notifications?: Notification[]; unreadCount?: number; error?: string };

const SEARCH_GROUPS: { kind: SearchKind; label: string }[] = [
  { kind: "course", label: "Courses" },
  { kind: "video", label: "Videos" },
  { kind: "lesson", label: "Lessons" },
  { kind: "event", label: "Events" },
  { kind: "post", label: "Community posts" },
  { kind: "channel", label: "Channels" },
  { kind: "member", label: "Members" },
];

export interface AppShellProps {
  /**
   * Legacy. It named the nav item to highlight; the rail derives that from the
   * pathname instead, so nothing reads this. Kept because ~19 components pass
   * it and none of them should have to change for a chrome edit.
   */
  active: string;
  title: string;
  terminalHeader?: boolean;
  isMaster?: boolean;
  memberName?: string;
  platformRole?: string;
  currentTier?: number;
  notifications?: Notification[];
  /**
   * The badge's starting value, for the layout that mounts the chrome without
   * the rows. A page passing `notifications` still derives it from those.
   */
  unreadCount?: number;
  routeBase?: string;
  children: React.ReactNode;
}

const EMPTY_NOTIFICATIONS: Notification[] = [];
const eventDate = (value: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));

/**
 * True once an ancestor has drawn the chrome.
 *
 * The workspace layouts render the shell, so the rail and the header belong to
 * the layout and survive a navigation instead of being torn down and rebuilt
 * with the page. But ~19 page components still wrap their own content in
 * `AppShell`, and rewriting all of them to stop would be a large diff in which
 * every file is a chance to break a route that has nothing to do with
 * performance. So a nested shell renders its children and nothing else.
 *
 * The consequence worth stating: props passed to an inner shell — `title`,
 * `notifications`, `memberName` — are ignored, because the outer one already
 * loaded those for the whole segment. They join `active`, which the rail
 * replaced.
 */
const ChromeMounted = createContext(false);

export function AppShell(props: AppShellProps) {
  const alreadyDrawn = useContext(ChromeMounted);
  if (alreadyDrawn) return <>{props.children}</>;
  return <WorkspaceChrome {...props} />;
}

function WorkspaceChrome({ isMaster = false, memberName = "Practitioner", platformRole = "member", notifications: initialNotifications = EMPTY_NOTIFICATIONS, unreadCount: initialUnreadCount, routeBase = "", children }: AppShellProps) {
  const supabase = useMemo(() => createClient(), []);
  const searchInput = useRef<HTMLInputElement>(null);
  const notificationPanel = useRef<HTMLDivElement>(null);
  const notificationTrigger = useRef<HTMLButtonElement | null>(null);
  const mobileMenuTrigger = useRef<HTMLButtonElement>(null);
  const mobileDrawer = useRef<HTMLElement>(null);

  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications.slice(0, 5));
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount ?? initialNotifications.filter((item) => !item.is_read).length);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const loadNotifications = useCallback(async (markVisibleRead = false) => {
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const response = await fetch("/api/dashboard/notifications?limit=5", { cache: "no-store" });
      const payload = await response.json() as NotificationResponse;
      if (!response.ok) throw new Error(payload.error || "Unable to load notifications");
      const preview = payload.notifications ?? [];
      setNotifications(preview);
      setUnreadCount(payload.unreadCount ?? 0);

      const unreadIds = markVisibleRead ? preview.filter((item) => !item.is_read).map((item) => item.id) : [];
      if (unreadIds.length) {
        setNotifications((current) => current.map((item) => unreadIds.includes(item.id) ? { ...item, is_read: true } : item));
        setUnreadCount((count) => Math.max(0, count - unreadIds.length));
        const update = await fetch("/api/dashboard/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_read", ids: unreadIds }),
        });
        if (!update.ok) {
          setNotifications((current) => current.map((item) => unreadIds.includes(item.id) ? { ...item, is_read: false } : item));
          setUnreadCount(payload.unreadCount ?? 0);
          setNotificationsError("The preview opened, but read status could not be saved.");
        }
      }
    } catch (reason) {
      setNotificationsError(reason instanceof Error ? reason.message : "Unable to load notifications");
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    const refresh = () => { void loadNotifications(false); };
    const channel = supabase
      .channel("app-shell-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications" }, refresh)
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [loadNotifications, supabase]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const focusTimer = window.setTimeout(() => {
      notificationPanel.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
    }, 0);
    function closeOnOutside(event: MouseEvent) {
      if (!notificationPanel.current?.contains(event.target as Node) && !notificationTrigger.current?.contains(event.target as Node)) closeNotifications(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeNotifications();
        return;
      }
      if (event.key !== "Tab" || !notificationPanel.current) return;
      const focusable = Array.from(notificationPanel.current.querySelectorAll<HTMLElement>("button, a[href]")).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const focusTimer = window.setTimeout(() => mobileDrawer.current?.querySelector<HTMLElement>("a[href], button")?.focus(), 0);
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMobileMenu();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  useEffect(() => { if (searchOpen) searchInput.current?.focus(); }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen || query.trim().length < 2) {
      const timer = window.setTimeout(() => setResults([]), 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: query.trim() });
        if (routeBase) params.set("base", routeBase);
        const response = await fetch(`/api/dashboard/search?${params.toString()}`, { signal: controller.signal });
        const payload = await response.json() as { results?: SearchResult[] };
        setResults(response.ok ? payload.results ?? [] : []);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [query, routeBase, searchOpen]);

  function closeNotifications(restoreFocus = true) {
    setNotificationsOpen(false);
    if (restoreFocus) window.setTimeout(() => notificationTrigger.current?.focus(), 0);
  }

  function openNotifications(event: ReactMouseEvent<HTMLButtonElement>) {
    notificationTrigger.current = event.currentTarget;
    if (notificationsOpen) {
      closeNotifications();
      return;
    }
    setNotificationsOpen(true);
    void loadNotifications(true);
  }

  function closeMobileMenu(restoreFocus = true) {
    setMobileMenuOpen(false);
    if (restoreFocus) window.setTimeout(() => mobileMenuTrigger.current?.focus(), 0);
  }

  const notificationsHref = withRouteBase(routeBase, "/notifications");

  /*
    The header's label comes from the rail, not from a `title` prop.

    The chrome is mounted by the layout now, and a layout does not re-render
    between sibling routes — which is the point, it is why the rail survives a
    navigation — so it cannot be handed a title by the page it is framing. The
    rail already knows which destination is open, and naming it the same thing
    the tooltip names it is the honest answer anyway: a header that disagrees
    with the navigation is worse than one derived from it.
  */
  const pathname = usePathname();
  const railItems = useMemo(
    () => buildRail({ routeBase, platformRole, isMaster }),
    [routeBase, platformRole, isMaster],
  );
  const headerLabel = railItems.find((item) => item.id === activeRailId(pathname ?? "", railItems))?.label ?? "";

  /*
    The rail replaced this shell's nav list, its brand block and its user
    footer — all three are things the rail now carries, and carries in
    `/channels` too, which is the point. What is left of the sidebar concept is
    the mobile drawer, where the rail sits inside rather than beside, because
    4.5rem of permanent chrome is too much of a phone.
  */
  const rail = (
    <AppRail
      routeBase={routeBase}
      platformRole={platformRole}
      isMaster={isMaster}
      memberName={memberName}
      unreadCount={unreadCount}
      onNavigate={() => setMobileMenuOpen(false)}
    />
  );

  return (
    <ChromeMounted.Provider value={true}>
    <div className="min-h-screen bg-surface text-on-surface md:flex">
      <header className="flex h-16 items-center justify-between border-b border-surgical-steel bg-sidebar px-4 md:hidden">
        <div className="flex items-center gap-3"><button ref={mobileMenuTrigger} type="button" onClick={() => setMobileMenuOpen(true)} className="focus-ring grid size-11 place-items-center rounded-full text-on-surface-variant" aria-label="Open menu" aria-expanded={mobileMenuOpen} aria-controls="mobile-workspace-navigation"><Menu size={22}/></button><span className="text-lg font-extrabold tracking-tight text-text-strong">Stoicverse</span></div>
        <div className="flex items-center gap-1"><button type="button" onClick={() => setSearchOpen(true)} className="focus-ring grid size-11 place-items-center rounded-full text-on-surface-variant" aria-label="Search"><Search size={18}/></button><BellButton unreadCount={unreadCount} open={notificationsOpen} onClick={openNotifications}/></div>
      </header>

      {mobileMenuOpen && <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 bg-scrim md:hidden" onClick={() => closeMobileMenu()}/>}
      {mobileMenuOpen && <aside ref={mobileDrawer} id="mobile-workspace-navigation" className="fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar md:hidden">{rail}</aside>}
      <aside className="sticky top-0 hidden h-screen shrink-0 flex-col md:flex">{rail}</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden h-16 items-center justify-between border-b border-surgical-steel bg-surface-container-low px-6 md:flex lg:px-8">
          <button type="button" onClick={() => setSearchOpen(true)} className="focus-ring flex min-w-[19rem] items-center gap-3 rounded-full border border-surgical-steel bg-surface-container-lowest px-4 py-2 text-left text-sm text-fog-muted transition hover:border-primary-container hover:text-on-surface"><Search size={15}/><span>Search curriculum, sessions, or community…</span></button>
          <div className="flex items-center gap-4"><span className="hidden text-sm font-semibold text-on-surface lg:block">{headerLabel}</span><BellButton unreadCount={unreadCount} open={notificationsOpen} onClick={openNotifications}/></div>
        </header>
        <div className="relative flex-1 bg-surface">{children}</div>
      </div>

      {notificationsOpen && <div ref={notificationPanel} id="notification-preview" role="dialog" aria-label="Notification preview" aria-modal="false" className="fixed right-3 top-[4.5rem] z-[60] w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-surgical-steel bg-monolith-surface shadow-[0_18px_48px_-20px_rgba(0,0,0,0.9)] md:right-8 md:top-14"><div className="flex items-center justify-between border-b border-surgical-steel px-4 py-3"><div><h2 className="text-sm font-semibold text-text-strong">Notifications</h2><p className="mt-0.5 text-xs text-fog-muted">{unreadCount ? `${unreadCount} unread` : "Caught up"}</p></div><button type="button" onClick={() => void loadNotifications(false)} aria-label="Refresh notification preview" className="focus-ring grid size-9 place-items-center rounded-full text-fog-muted transition hover:bg-surface-container-high hover:text-text-strong"><RefreshCw size={15}/></button></div><div className="max-h-[28rem] overflow-y-auto">{notificationsLoading && notifications.length === 0 ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-fog-muted"><LoaderCircle size={17} className="animate-spin"/>Loading updates…</div> : notificationsError && notifications.length === 0 ? <div className="p-6 text-center"><AlertCircle className="mx-auto text-error" size={22}/><p className="mt-3 text-sm text-error">{notificationsError}</p><button type="button" onClick={() => void loadNotifications(false)} className="mt-3 text-sm font-semibold text-text-strong underline underline-offset-4">Try again</button></div> : notifications.length ? <div className="divide-y divide-surgical-steel">{notifications.map((item) => <Link key={item.id} href={safeNotificationHref(item.action_url, notificationsHref)} onClick={() => setNotificationsOpen(false)} className="focus-ring group flex gap-3 px-4 py-4 transition hover:bg-surface-container-high"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.is_read ? "bg-surgical-steel" : "bg-primary-container"}`}/><span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-5 text-text-strong">{item.title}</span>{item.body && <span className="mt-1 block line-clamp-2 text-xs leading-5 text-on-surface-variant">{item.body}</span>}<span className="mt-2 block text-[11px] text-fog-muted">{eventDate(item.created_at)}</span></span><ChevronRight size={16} className="mt-2 shrink-0 text-fog-muted transition group-hover:translate-x-0.5 group-hover:text-primary-container"/></Link>)}</div> : <div className="px-6 py-10 text-center"><Bell className="mx-auto text-primary-container" size={24}/><p className="mt-3 text-sm font-semibold text-text-strong">You are all caught up</p><p className="mt-1 text-xs leading-5 text-fog-muted">New activity will appear here.</p></div>}</div>{notificationsError && notifications.length > 0 && <p role="alert" className="border-t border-error/30 bg-error/10 px-4 py-2 text-xs text-error">{notificationsError}</p>}<Link href={notificationsHref} onClick={() => setNotificationsOpen(false)} className="focus-ring flex min-h-12 items-center justify-center gap-2 border-t border-surgical-steel text-sm font-semibold text-primary-container transition hover:bg-surface-container-high">View all notifications <ChevronRight size={15}/></Link></div>}

      {searchOpen && <Modal title="Search Stoicverse" onClose={() => setSearchOpen(false)}><label className="sr-only" htmlFor="dashboard-search">Search lessons, events, posts, channels and members</label><input ref={searchInput} id="dashboard-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lessons, events, posts…" className="focus-ring w-full rounded-lg border border-surgical-steel bg-surface-container-lowest p-3.5 text-base text-on-surface placeholder:text-fog-muted"/>{searching && <div className="mt-4 flex items-center gap-2 text-sm text-fog-muted"><LoaderCircle size={16} className="animate-spin"/>Searching…</div>}<div className="mt-5 max-h-[50vh] space-y-5 overflow-y-auto">{SEARCH_GROUPS.map(({ kind, label }) => { const items = results.filter((result) => result.kind === kind); if (!items.length) return null; return <section key={kind}><h3 className="text-xs font-semibold text-primary-container">{label}</h3><div className="mt-2 divide-y divide-surgical-steel">{items.map((result) => <Link key={`${result.kind}-${result.id}`} href={result.href} onClick={() => setSearchOpen(false)} className="focus-ring block rounded-lg py-3 transition hover:text-primary-container"><p className="text-sm font-semibold text-text-strong">{result.title}</p>{result.description && <p className="mt-1 line-clamp-1 text-xs text-fog-muted">{result.description}</p>}</Link>)}</div></section>; })}{query.trim().length >= 2 && !searching && results.length === 0 && <div className="py-8 text-center text-sm text-fog-muted"><AlertCircle size={20} className="mx-auto mb-2 opacity-60"/>No accessible results found.</div>}</div></Modal>}
    </div>
    </ChromeMounted.Provider>
  );
}

function BellButton({ unreadCount, open, onClick }: { unreadCount: number; open: boolean; onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void }) {
  return <button type="button" onClick={onClick} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} aria-expanded={open} aria-controls="notification-preview" className="focus-ring relative grid size-11 place-items-center rounded-full border border-surgical-steel text-on-surface-variant transition hover:border-primary-container hover:text-primary-container"><Bell size={18}/>{unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 size-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-text-strong">{unreadCount > 9 ? "9+" : unreadCount}</span>}</button>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[70] grid items-end bg-scrim sm:place-items-center sm:p-4" onMouseDown={onClose}><div className="max-h-[calc(100svh-1rem)] w-full max-w-xl overflow-auto rounded-t-xl border border-surgical-steel bg-monolith-surface p-4 shadow-2xl sm:max-h-[85vh] sm:rounded-xl sm:p-6" onMouseDown={(event) => event.stopPropagation()}><div className="mb-5 flex items-center justify-between border-b border-surgical-steel pb-4 sm:mb-6"><h2 className="text-lg font-bold text-text-strong">{title}</h2><button type="button" onClick={onClose} className="focus-ring grid size-11 place-items-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary-container" aria-label="Close"><X size={18}/></button></div>{children}</div></div>;
}
