"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarDays, CheckCheck, ChevronRight, GraduationCap, LoaderCircle, Megaphone, MessageSquareText, RefreshCw, ShieldCheck } from "lucide-react";

import { notificationView, safeNotificationHref, type NotificationItem, type NotificationView } from "@/lib/notifications/model";
import { createClient } from "@/lib/supabase/client";

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

export function NotificationCenter({ initialView }: { initialView: string | undefined }) {
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
    router.replace(`/dashboard/notifications${params}`, { scroll: false });
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
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <header className="flex flex-col gap-6 border-b border-surgical-steel pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-primary-container">Member inbox</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-white sm:text-4xl">Notifications</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant">Event, course, community, and account updates collected in one calm queue.</p>
        </div>
        <button type="button" onClick={markAllRead} disabled={unreadCount === 0 || loading} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-surgical-steel px-4 text-sm font-semibold text-on-surface transition hover:border-primary-container hover:text-primary-container disabled:cursor-not-allowed disabled:opacity-45">
          <CheckCheck size={17} /> Mark all read
        </button>
      </header>

      <div className="flex items-center justify-between gap-4 border-b border-surgical-steel py-4">
        <div className="flex gap-1" role="tablist" aria-label="Notification views">
          {views.map((tab) => (
            <button ref={(element) => { tabButtons.current[tab.id] = element; }} key={tab.id} id={`notification-tab-${tab.id}`} type="button" role="tab" aria-selected={view === tab.id} aria-controls="notification-feed-panel" tabIndex={view === tab.id ? 0 : -1} onKeyDown={(event) => moveTabFocus(event, tab.id)} onClick={() => selectView(tab.id)} className={`focus-ring min-h-10 rounded-full px-4 text-sm font-semibold transition ${view === tab.id ? "bg-primary-container text-on-primary-fixed" : "text-on-surface-variant hover:bg-surface-container-high hover:text-white"}`}>
              {tab.label}{tab.id === "unread" && unreadCount > 0 ? ` ${unreadCount}` : ""}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void reload()} aria-label="Refresh notifications" className="focus-ring grid size-10 place-items-center rounded-full text-fog-muted transition hover:bg-surface-container-high hover:text-white">
          <RefreshCw size={16} />
        </button>
      </div>

      {error && items.length > 0 && <div role="alert" className="mt-5 flex items-center justify-between gap-4 border border-error/35 bg-error/10 px-4 py-3 text-sm text-error"><span>{error}</span><button type="button" onClick={() => void reload()} className="font-semibold underline underline-offset-4">Retry</button></div>}

      <div id="notification-feed-panel" role="tabpanel" aria-labelledby={`notification-tab-${view}`} tabIndex={0}>
      {loading ? (
        <div className="divide-y divide-surgical-steel" aria-label="Loading notifications">
          {[0, 1, 2, 3].map((item) => <div key={item} className="flex gap-4 py-6"><div className="size-10 animate-pulse rounded-full bg-surface-container-high"/><div className="flex-1 space-y-3"><div className="h-4 w-2/5 animate-pulse bg-surface-container-high"/><div className="h-3 w-4/5 animate-pulse bg-surface-container-high"/></div></div>)}
        </div>
      ) : error ? (
        <section role="alert" className="grid min-h-72 place-items-center border-b border-surgical-steel text-center">
          <div className="max-w-sm py-12"><RefreshCw className="mx-auto text-error" size={28}/><h2 className="mt-4 text-lg font-semibold text-white">Notifications are unavailable</h2><p className="mt-2 text-sm leading-6 text-fog-muted">{error}</p><button type="button" onClick={() => void reload()} className="focus-ring mt-5 min-h-11 rounded-full border border-surgical-steel px-5 text-sm font-semibold text-on-surface transition hover:border-primary-container hover:text-primary-container">Try again</button></div>
        </section>
      ) : items.length === 0 ? (
        <section className="grid min-h-72 place-items-center border-b border-surgical-steel text-center">
          <div className="max-w-sm py-12"><Bell className="mx-auto text-primary-container" size={28}/><h2 className="mt-4 text-lg font-semibold text-white">{view === "unread" ? "Nothing needs your attention" : view === "mentions" ? "No mentions yet" : "You are all caught up"}</h2><p className="mt-2 text-sm leading-6 text-fog-muted">New updates will appear here as activity happens across Stoicverse.</p></div>
        </section>
      ) : (
        <div>
          {["Today", "Yesterday", "Earlier"].map((label) => {
            const group = grouped.get(label);
            if (!group?.length) return null;
            return <section key={label} aria-labelledby={`notification-group-${label.toLowerCase()}`} className="border-b border-surgical-steel py-7"><h2 id={`notification-group-${label.toLowerCase()}`} className="mb-2 text-xs font-semibold text-fog-muted">{label}</h2><div className="divide-y divide-surgical-steel">{group.map((item) => { const Icon = iconFor(item.type); return <button key={item.id} type="button" onClick={() => void openNotification(item)} className="focus-ring group flex w-full items-start gap-4 rounded-lg px-2 py-5 text-left transition hover:bg-surface-container-low"><span className={`grid size-10 shrink-0 place-items-center rounded-full border ${item.is_read ? "border-surgical-steel bg-surface-container-low text-fog-muted" : "border-primary-container/50 bg-primary-container/10 text-primary-container"}`}><Icon size={18}/></span><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><span className={`text-sm leading-5 ${item.is_read ? "font-medium text-on-surface" : "font-semibold text-white"}`}>{item.title}</span><span className="shrink-0 text-xs text-fog-muted">{timeAgo(item.created_at)}</span></span>{item.body && <span className="mt-1.5 block max-w-3xl text-sm leading-6 text-on-surface-variant">{item.body}</span>}</span><ChevronRight size={17} className="mt-3 shrink-0 text-fog-muted transition group-hover:translate-x-0.5 group-hover:text-primary-container"/></button>; })}</div></section>;
          })}
        </div>
      )}

      {nextCursor && !loading && <div className="flex justify-center py-8"><button type="button" onClick={() => void loadOlder()} disabled={loadingOlder} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-surgical-steel px-5 text-sm font-semibold text-on-surface transition hover:border-primary-container hover:text-primary-container disabled:opacity-50">{loadingOlder && <LoaderCircle size={16} className="animate-spin"/>}Load older</button></div>}
      </div>
    </main>
  );
}
