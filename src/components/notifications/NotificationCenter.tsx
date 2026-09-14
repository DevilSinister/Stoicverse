"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarDays, CheckCheck, ChevronRight, GraduationCap, LoaderCircle, Megaphone, MessageSquareText, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { notificationView, safeNotificationHref, type NotificationItem, type NotificationView } from "@/lib/notifications/model";
import { createClient } from "@/lib/supabase/client";

/**
 * The notification inbox, for both roles.
 *
 * Monolith, phase 6. What it replaces was the last screen in the product still
 * speaking the pre-Monolith language end to end — pill tabs on an accent fill,
 * `text-3xl font-semibold`, circular icon chips, and the alias tokens
 * throughout.
 *
 * **One of those was not a style problem.** The inactive tabs carried
 * `hover:text-accent-contrast` over a `surface-container-high` hover fill.
 * `--accent-contrast` is the near-black that goes *on* the lime accent, so
 * hovering an unselected tab painted its label black on dark grey and the word
 * disappeared under the cursor. Nothing about that is visible in the source;
 * the class name reads like a contrast colour, and it is — for the opposite
 * background. See `00 - Shared/Cross-Project Lessons.md` lesson 47.
 *
 * **The active tab is a rule, not a fill.** Monolith draws structure with
 * hairlines and reserves the accent for state, which is the same 2px marker
 * idiom the rail uses for its active destination.
 */

type FeedResponse = {
  notifications?: NotificationItem[];
  unreadCount?: number;
  nextCursor?: string | null;
  error?: string;
};

const views: { id: NotificationView; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "mentions", label: "Mentions" },
];

function iconFor(type: string) {
  if (type === "community_mention") return MessageSquareText;
  if (type.includes("event")) return CalendarDays;
  if (type.includes("course") || type.includes("lesson")) return GraduationCap;
  if (type.includes("payment") || type.includes("account") || type.includes("security")) return ShieldCheck;
  if (type.includes("role") || type.includes("achievement") || type.includes("tier") || type.includes("master")) return Megaphone;
  return Bell;
}

function groupLabel(value: string) {
  const created = new Date(value);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startCreated = new Date(created.getFullYear(), created.getMonth(), created.getDate()).getTime();
  const day = 86_400_000;
  if (startCreated === startToday) return "Today";
  if (startCreated === startToday - day) return "Yesterday";
  return "Earlier";
}

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
function timeAgo(value: string) {
  const delta = new Date(value).getTime() - Date.now();
  const minutes = Math.round(delta / 60_000);
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, "hour");
  return relativeTime.format(Math.round(hours / 24), "day");
}

function FeedPlaceholder() {
  return (
    <div className="divide-y divide-border-hairline" aria-label="Loading notifications">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex gap-4 py-5">
          <Skeleton className="size-10 shrink-0 rounded-md" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationCenter({
  initialView,
  basePath = "/dashboard/notifications",
}: {
  initialView: string | undefined;
  /**
   * Where the view tabs write themselves in the URL.
   *
   * Hard-coded to `/dashboard/notifications` before the creator got this
   * screen, which would have bounced an influencer off their own page the
   * moment they changed tab - `proxy.ts` refuses them every /dashboard route.
   */
  basePath?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<NotificationView>(() => notificationView(initialView));
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tabButtons = useRef<Partial<Record<NotificationView, HTMLButtonElement | null>>>({});

  const load = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams({ view, limit: "30" });
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`/api/dashboard/notifications?${params.toString()}`, { cache: "no-store" });
    const payload = await response.json() as FeedResponse;
    if (!response.ok) throw new Error(payload.error || "Unable to load notifications");
    setItems((current) => cursor ? [...current, ...(payload.notifications ?? [])] : payload.notifications ?? []);
    setUnreadCount(payload.unreadCount ?? 0);
    setNextCursor(payload.nextCursor ?? null);
  }, [view]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load notifications");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  useEffect(() => {
    const refresh = () => { void reload(); };
    const channel = supabase
      .channel("member-notification-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications" }, refresh)
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [reload, supabase]);

  function selectView(next: NotificationView) {
    setView(next);
    const params = next === "all" ? "" : `?view=${next}`;
    router.replace(`${basePath}${params}`, { scroll: false });
  }

  function moveTabFocus(event: ReactKeyboardEvent<HTMLButtonElement>, current: NotificationView) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = views.findIndex((item) => item.id === current);
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : event.key === 'ArrowRight' ? (currentIndex + 1) % views.length : (currentIndex - 1 + views.length) % views.length;
    const next = views[nextIndex].id;
    selectView(next);
    window.setTimeout(() => tabButtons.current[next]?.focus(), 0);
  }

  async function markAllRead() {
    const previous = items;
    setItems((current) => current.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
    setError(null);
    const response = await fetch("/api/dashboard/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    if (!response.ok) {
      setItems(previous);
      setUnreadCount(previous.filter((item) => !item.is_read).length);
      setError("Notifications could not be marked as read. Try again.");
      return;
    }
    if (view === "unread") setItems([]);
  }

  async function openNotification(item: NotificationItem) {
    if (!item.is_read) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, is_read: true } : entry));
      setUnreadCount((count) => Math.max(0, count - 1));
      await fetch("/api/dashboard/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", ids: [item.id] }),
      });
    }
    router.push(safeNotificationHref(item.action_url));
  }

  async function loadOlder() {
    if (!nextCursor) return;
    setLoadingOlder(true);
    setError(null);
    try {
      await load(nextCursor);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load older notifications");
    } finally {
      setLoadingOlder(false);
    }
  }

  const grouped = useMemo(() => {
    const result = new Map<string, NotificationItem[]>();
    for (const item of items) {
      const label = groupLabel(item.created_at);
      result.set(label, [...(result.get(label) ?? []), item]);
    }
    return result;
  }, [items]);

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-5 border-b border-border-hairline pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          {/* Was hard-coded "Member inbox", which is the wrong words on the
              creator's own notifications page - the one this screen serves
              since the rail stopped sending them to a route they cannot open. */}
          <p className="font-mono text-mono-xs tracking-widest text-text-faint uppercase">
            {basePath.startsWith("/creator") ? "Creator inbox" : "Member inbox"}
          </p>
          <h1 className="mt-3 text-title-lg font-medium text-text-strong">Notifications</h1>
          <p className="mt-3 text-content-base text-text-default">
            Event, course, community, and account updates collected in one calm queue.
          </p>
        </div>
        <Button variant="outline" onClick={markAllRead} disabled={unreadCount === 0 || loading}>
          <CheckCheck size={16} /> Mark all read
        </Button>
      </header>

      <div className="flex items-center justify-between gap-4 border-b border-border-hairline">
        <div className="flex" role="tablist" aria-label="Notification views">
          {views.map((tab) => {
            const selected = view === tab.id;
            return (
              <button
                ref={(element) => { tabButtons.current[tab.id] = element; }}
                key={tab.id}
                id={`notification-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="notification-feed-panel"
                tabIndex={selected ? 0 : -1}
                onKeyDown={(event) => moveTabFocus(event, tab.id)}
                onClick={() => selectView(tab.id)}
                /*
                  `hover:text-text-strong`, not `hover:text-accent-contrast`.
                  The latter is the near-black that goes on the lime accent, and
                  over this hover fill it painted the label black on dark grey -
                  the tab label vanished under the cursor.
                */
                className={`focus-ring relative inline-flex min-h-11 items-center gap-2 px-4 text-content-sm transition-colors ${
                  selected ? "text-text-strong" : "text-text-muted hover:text-text-strong"
                }`}
              >
                {tab.label}
                {tab.id === "unread" && unreadCount > 0 && (
                  <span className="rounded-md bg-surface-raised px-1.5 font-mono text-mono-xs text-text-default">
                    {unreadCount}
                  </span>
                )}
                {/* The rail's marker idiom: a 2px rule, not a pill fill. */}
                {selected && <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 bg-primary" />}
              </button>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="icon-chrome"
          onClick={() => void reload()}
          aria-label="Refresh notifications"
        >
          <RefreshCw size={16} />
        </Button>
      </div>

      {error && items.length > 0 && (
        <div
          role="alert"
          className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-status-danger/40 bg-status-danger/10 px-4 py-3 text-content-sm text-status-danger"
        >
          <span>{error}</span>
          <button type="button" onClick={() => void reload()} className="focus-ring font-medium underline underline-offset-4">
            Retry
          </button>
        </div>
      )}

      <div id="notification-feed-panel" role="tabpanel" aria-labelledby={`notification-tab-${view}`} tabIndex={0}>
        {loading ? (
          <FeedPlaceholder />
        ) : error ? (
          <section role="alert" className="grid min-h-72 place-items-center border-b border-border-hairline text-center">
            <div className="max-w-sm py-12">
              <RefreshCw className="mx-auto text-status-danger" size={26} />
              <h2 className="mt-4 text-title-sm font-medium text-text-strong">Notifications are unavailable</h2>
              <p className="mt-2 text-content-sm text-text-muted">{error}</p>
              <Button variant="outline" className="mt-5" onClick={() => void reload()}>
                Try again
              </Button>
            </div>
          </section>
        ) : items.length === 0 ? (
          <section className="grid min-h-72 place-items-center border-b border-border-hairline text-center">
            <div className="max-w-sm py-12">
              <Bell className="mx-auto text-primary" size={26} />
              <h2 className="mt-4 text-title-sm font-medium text-text-strong">
                {view === "unread" ? "Nothing needs your attention" : view === "mentions" ? "No mentions yet" : "You are all caught up"}
              </h2>
              <p className="mt-2 text-content-sm text-text-muted">
                New updates will appear here as activity happens across Stoicverse.
              </p>
            </div>
          </section>
        ) : (
          <div>
            {["Today", "Yesterday", "Earlier"].map((label) => {
              const group = grouped.get(label);
              if (!group?.length) return null;
              return (
                <section
                  key={label}
                  aria-labelledby={`notification-group-${label.toLowerCase()}`}
                  className="border-b border-border-hairline py-6"
                >
                  <h2
                    id={`notification-group-${label.toLowerCase()}`}
                    className="mb-2 font-mono text-mono-xs tracking-widest text-text-faint uppercase"
                  >
                    {label}
                  </h2>
                  <div className="divide-y divide-border-hairline">
                    {group.map((item) => {
                      const Icon = iconFor(item.type);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => void openNotification(item)}
                          className="focus-ring group flex w-full items-start gap-4 rounded-lg px-2 py-4 text-left transition-colors hover:bg-surface-panel"
                        >
                          <span
                            className={`grid size-10 shrink-0 place-items-center rounded-md border ${
                              item.is_read
                                ? "border-border-hairline bg-surface-panel text-text-muted"
                                : "border-primary/40 bg-accent-soft text-primary"
                            }`}
                          >
                            <Icon size={18} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-3">
                              <span className={`text-content-sm ${item.is_read ? "text-text-default" : "font-medium text-text-strong"}`}>
                                {item.title}
                              </span>
                              <span className="shrink-0 font-mono text-mono-xs text-text-faint">{timeAgo(item.created_at)}</span>
                            </span>
                            {item.body && (
                              <span className="mt-1.5 block max-w-3xl text-content-sm text-text-muted">{item.body}</span>
                            )}
                          </span>
                          <ChevronRight
                            size={16}
                            className="mt-2 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5"
                          />
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {nextCursor && !loading && (
          <div className="flex justify-center py-8">
            <Button variant="outline" onClick={() => void loadOlder()} disabled={loadingOlder}>
              {loadingOlder && <LoaderCircle size={16} className="animate-spin" />}
              Load older
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
