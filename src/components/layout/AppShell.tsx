"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AlertCircle, Bell, ChevronRight, LoaderCircle, Menu, RefreshCw, Search } from "lucide-react";

import { AppRail } from "@/components/layout/AppRail";
import { Overlay, OverlayBody, OverlayContent, OverlayTitle } from "@/components/ui/overlay";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
const eventDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(value),
  );

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

function WorkspaceChrome({
  isMaster = false,
  memberName = "Practitioner",
  platformRole = "member",
  notifications: initialNotifications = EMPTY_NOTIFICATIONS,
  unreadCount: initialUnreadCount,
  routeBase = "",
  children,
}: AppShellProps) {
  const supabase = useMemo(() => createClient(), []);

  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications.slice(0, 5));
  const [unreadCount, setUnreadCount] = useState(
    initialUnreadCount ?? initialNotifications.filter((item) => !item.is_read).length,
  );
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const loadNotifications = useCallback(async (markVisibleRead = false) => {
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const response = await fetch("/api/dashboard/notifications?limit=5", { cache: "no-store" });
      const payload = (await response.json()) as NotificationResponse;
      if (!response.ok) throw new Error(payload.error || "Unable to load notifications");
      const preview = payload.notifications ?? [];
      setNotifications(preview);
      setUnreadCount(payload.unreadCount ?? 0);

      const unreadIds = markVisibleRead ? preview.filter((item) => !item.is_read).map((item) => item.id) : [];
      if (unreadIds.length) {
        setNotifications((current) =>
          current.map((item) => (unreadIds.includes(item.id) ? { ...item, is_read: true } : item)),
        );
        setUnreadCount((count) => Math.max(0, count - unreadIds.length));
        const update = await fetch("/api/dashboard/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_read", ids: unreadIds }),
        });
        if (!update.ok) {
          setNotifications((current) =>
            current.map((item) => (unreadIds.includes(item.id) ? { ...item, is_read: false } : item)),
          );
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
    const refresh = () => {
      void loadNotifications(false);
    };
    const channel = supabase
      .channel("app-shell-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications" }, refresh)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadNotifications, supabase]);

  /*
    Ctrl/Cmd+K opens search.

    The workspace had no keyboard route to its own search at all — the only
    binding in the product was /channels' quick switcher. It is deliberately not
    gated on a typing check: a command-modified key is a command, and somebody
    halfway through a comment still means "search" when they press it.
  */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setSearchOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function onNotificationsOpenChange(open: boolean) {
    setNotificationsOpen(open);
    if (open) void loadNotifications(true);
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
  const railItems = useMemo(() => buildRail({ routeBase, platformRole, isMaster }), [routeBase, platformRole, isMaster]);
  const headerLabel = railItems.find((item) => item.id === activeRailId(pathname ?? "", railItems))?.label ?? "";

  const railProps = { routeBase, platformRole, isMaster, memberName, unreadCount };

  const bell = (
    <NotificationBell
      unreadCount={unreadCount}
      notifications={notifications}
      loading={notificationsLoading}
      error={notificationsError}
      notificationsHref={notificationsHref}
      onRefresh={() => void loadNotifications(false)}
      onNavigate={() => setNotificationsOpen(false)}
      open={notificationsOpen}
      onOpenChange={onNotificationsOpenChange}
    />
  );

  return (
    <ChromeMounted.Provider value={true}>
      <div className="min-h-screen bg-surface-canvas text-text-default md:flex">
        {/*
          Chrome is a hairline, not a band. The header used to be 64px of
          lighter fill sitting over a darker page, which reads as a second
          surface; at 48px on the same canvas it reads as an edge.
        */}
        <header className="safe-t safe-x flex h-chrome-bar items-center gap-1 border-b border-border-hairline bg-surface-canvas pr-2 pl-1 md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="focus-ring grid size-11 shrink-0 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface-panel hover:text-text-strong"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="text-content-sm font-semibold tracking-tight text-text-strong">Stoicverse</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="focus-ring grid size-11 shrink-0 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface-panel hover:text-text-strong"
            aria-label="Search"
          >
            <Search size={19} />
          </button>
          {bell}
        </header>

        {/*
          The drawer is the overlay primitive now: trap, Escape, scroll lock and
          focus restore come from Base UI rather than from two hand-written
          effects, and the rail inside it draws labels, because a tooltip is
          unreachable on a touch screen.
        */}
        <Overlay open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <OverlayContent
            placement="sheet-left"
            size="sm"
            density="chrome"
            showCloseButton={false}
            className="bg-surface-sunken md:hidden"
          >
            {/* Just "Navigation". app-rail.contract.mjs reserves the longer
                phrase the deleted 16rem sidebar was labelled with, so that list
                cannot quietly come back — including from a comment. */}
            <OverlayTitle className="sr-only">Navigation</OverlayTitle>
            <AppRail {...railProps} variant="drawer" onNavigate={() => setMobileMenuOpen(false)} />
          </OverlayContent>
        </Overlay>

        <aside className="sticky top-0 hidden h-screen shrink-0 flex-col md:flex">
          <AppRail {...railProps} onNavigate={() => setMobileMenuOpen(false)} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="hidden h-chrome-bar items-center gap-chrome-gap border-b border-border-hairline bg-surface-canvas px-chrome-x md:flex">
            <span className="text-chrome-base font-medium tracking-tight text-text-strong">{headerLabel}</span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="focus-ring hit-target relative flex h-8 min-w-[16rem] items-center gap-chrome-gap rounded-md border border-border-hairline bg-surface-panel pr-1.5 pl-2.5 text-left text-chrome-sm text-text-muted transition-colors hover:border-border-strong hover:text-text-default"
            >
              <Search size={14} />
              <span>Search</span>
              <kbd className="ml-auto rounded-sm border border-border-hairline bg-surface-canvas px-1.5 py-1 font-mono text-[10px] leading-none text-text-faint">
                Ctrl K
              </kbd>
            </button>
            {bell}
          </header>
          <div className="relative flex-1 bg-surface-canvas">{children}</div>
        </div>

        <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} routeBase={routeBase} />
      </div>
    </ChromeMounted.Provider>
  );
}

/* ------------------------------------------------------------ notifications */

/**
 * The bell and its preview.
 *
 * This replaces a `fixed … z-[60]` panel with a hand-written Tab cycle, an
 * outside-mousedown listener and a focus-restore timeout. The popover portals
 * to `<body>`, so there is no ancestor left to out-rank and the z-index goes
 * away rather than being renumbered.
 */
function NotificationBell({
  unreadCount,
  notifications,
  loading,
  error,
  notificationsHref,
  onRefresh,
  onNavigate,
  open,
  onOpenChange,
}: {
  unreadCount: number;
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  notificationsHref: string;
  onRefresh: () => void;
  onNavigate: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        className="focus-ring hit-target relative grid size-11 shrink-0 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface-panel hover:text-text-strong md:size-8"
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="absolute top-1.5 right-1.5 grid min-w-3.5 place-items-center rounded-full bg-status-danger px-1 font-mono text-[9px] leading-[0.875rem] font-medium text-surface-canvas ring-2 ring-surface-canvas md:top-1 md:right-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[min(21rem,calc(100vw-1.5rem))] gap-0 overflow-hidden rounded-md p-0"
      >
        <div className="flex h-chrome-row shrink-0 items-center gap-chrome-gap border-b border-border-hairline pr-1 pl-chrome-x">
          <h2 className="text-chrome-base font-medium text-text-strong">Notifications</h2>
          <span className="font-mono text-mono-xs text-primary">
            {unreadCount ? `${unreadCount} unread` : "Caught up"}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh notification preview"
            className="focus-ring hit-target relative ml-auto grid size-7 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface-raised hover:text-text-strong"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="max-h-[24rem] overflow-y-auto overscroll-contain">
          {loading && notifications.length === 0 ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-chrome-base text-text-muted">
              <LoaderCircle size={16} className="animate-spin" />
              Loading updates…
            </div>
          ) : error && notifications.length === 0 ? (
            <div className="px-content-gap py-content-gap text-center">
              <AlertCircle className="mx-auto text-status-danger" size={20} />
              <p className="mt-2.5 text-chrome-base text-status-danger">{error}</p>
              <button
                type="button"
                onClick={onRefresh}
                className="focus-ring mt-2.5 rounded-sm text-chrome-base font-medium text-text-strong underline underline-offset-4"
              >
                Try again
              </button>
            </div>
          ) : notifications.length ? (
            <div className="divide-y divide-border-hairline">
              {notifications.map((item) => (
                <Link
                  key={item.id}
                  href={safeNotificationHref(item.action_url, notificationsHref)}
                  onClick={onNavigate}
                  className="focus-ring group flex gap-2.5 px-chrome-x py-2.5 transition-colors hover:bg-surface-raised"
                >
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${item.is_read ? "bg-border-hairline" : "bg-primary"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-chrome-base leading-snug font-medium text-text-strong">{item.title}</span>
                    {item.body ? (
                      <span className="mt-0.5 block line-clamp-2 text-chrome-sm leading-snug text-text-muted">
                        {item.body}
                      </span>
                    ) : null}
                    <span className="mt-1 block font-mono text-mono-xs text-text-faint">{eventDate(item.created_at)}</span>
                  </span>
                  <ChevronRight
                    size={14}
                    className="mt-1 shrink-0 text-text-faint transition-colors group-hover:text-primary"
                  />
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-content-gap py-8 text-center">
              <Bell className="mx-auto text-primary" size={22} />
              <p className="mt-2.5 text-chrome-base font-medium text-text-strong">You are all caught up</p>
              <p className="mt-1 text-chrome-sm leading-snug text-text-muted">New activity will appear here.</p>
            </div>
          )}
        </div>

        {error && notifications.length > 0 ? (
          <p
            role="alert"
            className="border-t border-status-danger/30 bg-status-danger/10 px-chrome-x py-1.5 text-chrome-sm text-status-danger"
          >
            {error}
          </p>
        ) : null}

        <Link
          href={notificationsHref}
          onClick={onNavigate}
          className="focus-ring flex h-chrome-row shrink-0 items-center justify-center gap-1.5 border-t border-border-hairline bg-surface-canvas text-chrome-base font-medium text-primary transition-colors hover:bg-surface-raised"
        >
          View all notifications <ChevronRight size={14} />
        </Link>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ search */

/**
 * Global search, as a command palette.
 *
 * What this replaces had no focus trap, no Escape handler and no scroll lock —
 * it closed on an outside mousedown and nothing else, so Tab walked straight
 * out of it into the page behind the scrim. All four now come from the overlay
 * primitive. The arrow keys and the kind chips are new: seven result groups in
 * one list is not navigable with a pointer alone, and two things that share a
 * name are indistinguishable without saying which is which.
 */
function SearchPalette({
  open,
  onOpenChange,
  routeBase,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeBase: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [cursor, setCursor] = useState(0);

  // One flat sequence in group order, so the arrow keys cross a group boundary
  // the way the eye does rather than stopping at it.
  const ordered = useMemo(
    () => SEARCH_GROUPS.flatMap(({ kind }) => results.filter((result) => result.kind === kind)),
    [results],
  );

  // Clamped at read time rather than reset in an effect: results arrive
  // asynchronously and a shorter list must not leave the cursor past its end.
  const selectedIndex = cursor < ordered.length ? cursor : 0;

  function setOpen(next: boolean) {
    if (!next) {
      setQuery("");
      setResults([]);
      setCursor(0);
    }
    onOpenChange(next);
  }

  useEffect(() => {
    if (!open || query.trim().length < 2) {
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
        const payload = (await response.json()) as { results?: SearchResult[] };
        setResults(response.ok ? (payload.results ?? []) : []);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, routeBase, open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!ordered.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((index) => (index + 1) % ordered.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((index) => (index - 1 + ordered.length) % ordered.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = ordered[selectedIndex];
      if (target) go(target.href);
    }
  }

  return (
    <Overlay open={open} onOpenChange={setOpen}>
      <OverlayContent placement="responsive" size="md" density="chrome" showCloseButton={false} className="overflow-hidden">
        <OverlayTitle className="sr-only">Search Stoicverse</OverlayTitle>

        <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-border-hairline px-chrome-x">
          <Search size={16} className="shrink-0 text-text-faint" />
          <label className="sr-only" htmlFor="dashboard-search">
            Search lessons, events, posts, channels and members
          </label>
          <input
            id="dashboard-search"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search lessons, events, posts…"
            className="min-w-0 flex-1 bg-transparent text-content-base text-text-strong outline-none placeholder:text-text-faint"
          />
          {searching ? <LoaderCircle size={15} className="shrink-0 animate-spin text-text-faint" /> : null}
        </div>

        <OverlayBody className="px-0 py-1.5">
          {SEARCH_GROUPS.map(({ kind, label }) => {
            const items = results.filter((result) => result.kind === kind);
            if (!items.length) return null;
            return (
              <section key={kind}>
                <h3 className="px-chrome-x pt-2.5 pb-1.5 font-mono text-mono-xs tracking-widest text-text-faint uppercase">
                  {label}
                </h3>
                {items.map((result) => {
                  const selected =
                    ordered[selectedIndex]?.id === result.id && ordered[selectedIndex]?.kind === result.kind;
                  return (
                    <button
                      key={`${result.kind}-${result.id}`}
                      type="button"
                      onClick={() => go(result.href)}
                      onPointerMove={() => setCursor(ordered.indexOf(result))}
                      aria-current={selected ? true : undefined}
                      className={`focus-ring relative flex min-h-11 w-full items-center gap-2.5 px-chrome-x text-left transition-colors sm:min-h-[34px] ${
                        selected ? "bg-surface-raised text-text-strong" : "text-text-default hover:bg-surface-raised"
                      }`}
                    >
                      {selected ? (
                        <span
                          aria-hidden="true"
                          className="absolute top-1/2 left-0 h-[18px] w-0.5 -translate-y-1/2 bg-primary"
                        />
                      ) : null}
                      <span className="min-w-0 truncate text-content-sm">{result.title}</span>
                      {result.description ? (
                        <span className="hidden min-w-0 truncate text-chrome-sm text-text-faint sm:block">
                          {result.description}
                        </span>
                      ) : null}
                      <span className="ml-auto shrink-0 rounded-sm border border-border-hairline px-1.5 py-0.5 font-mono text-[10px] text-text-faint">
                        {result.kind}
                      </span>
                    </button>
                  );
                })}
              </section>
            );
          })}

          {query.trim().length >= 2 && !searching && results.length === 0 ? (
            <div className="py-8 text-center text-chrome-base text-text-muted">
              <AlertCircle size={18} className="mx-auto mb-2 opacity-60" />
              No accessible results found.
            </div>
          ) : null}

          {query.trim().length < 2 ? (
            <p className="py-8 text-center text-chrome-base text-text-faint">Type at least two characters to search.</p>
          ) : null}
        </OverlayBody>

        <div className="hidden h-chrome-row shrink-0 items-center gap-4 border-t border-border-hairline bg-surface-canvas px-chrome-x font-mono text-mono-xs text-text-faint sm:flex">
          <span>
            <Key>↑</Key>
            <Key>↓</Key> move
          </span>
          <span>
            <Key>↵</Key> open
          </span>
          <span>
            <Key>esc</Key> close
          </span>
        </div>
      </OverlayContent>
    </Overlay>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="mr-1 inline-block rounded-sm border border-border-hairline px-1 text-text-muted">{children}</kbd>;
}
