"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle, Clock3, HelpCircle, Lock, Users, Video } from "lucide-react";

import { enrollInEvent } from "@/app/events/actions";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Overlay,
  OverlayBody,
  OverlayContent,
  OverlayDescription,
  OverlayFooter,
  OverlayHeader,
  OverlayTitle,
} from "@/components/ui/overlay";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";

/**
 * The events directory. Monolith, phase 9.
 *
 * **The detail dialog was hand-rolled** — `fixed inset-0 z-50`, dismissed by
 * `onMouseDown` on its own backdrop, with Escape and an initial focus wired by
 * hand and no focus trap, focus restore or scroll lock. Same shape as the
 * course dialog phase 8 replaced; it is `ui/overlay` now, which owns all five,
 * and the raw `z-50` leaves the tree with it.
 *
 * **Two `window.alert` calls reported the Zoom room's failures.** A native
 * dialog blocks the page and looks like the browser talking rather than the
 * product; both are toasts now, which is where the outcome of an action
 * belongs.
 *
 * **The tier gate rendered its own asterisks.** `**{getTierTitle(…)}**` inside
 * a plain paragraph is not markdown to React — the reader saw
 * `**Intermediate**`, literally, on the one message explaining why they could
 * not enroll.
 *
 * **`text-accent-contrast` on a panel, again.** The "Upcoming" chip painted the
 * near-black meant to sit *on* the lime accent over the page's own dark ground.
 * Sixth sighting of this family; the chips are `ui/status-badge` now, so the
 * question does not arise per call site.
 *
 * **`animate-fade-in` is not a class.** Only `animate-fade-in-up` is defined in
 * `globals.css`, so the grid's entrance animation had never run.
 *
 * Also gone: three `emerald-glow` shadows, the stock `red-*` and `amber-*`
 * colours where the system has `--status-danger` and `--status-warn`, and the
 * card's `onClick` on a `<div>` — the title is a real button now, stretched
 * over the card, so the keyboard reaches what the mouse always could.
 */

export type EventRecord = {
  id: string;
  title: string;
  description: string | null;
  hostName: string;
  startsAt: string;
  endsAt: string | null;
  minTier: number;
  status: "upcoming" | "live" | "completed" | "cancelled";
  enrolled: boolean;
  publishAt?: string | null;
  publishedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
};

const formatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const DAY_MS = 86_400_000;

const label = (tier: number) => (tier === 5 ? "Masters" : `Tier ${tier}+`);

const TIER_TITLES = ["Basic", "Beginner", "Intermediate", "Advanced", "Master Zone"];
const tierTitle = (level: number) => TIER_TITLES[level - 1] ?? `Tier ${level}`;

const state = (event: EventRecord, now: number) => {
  if (event.status === "cancelled") return "cancelled";
  if (event.endsAt && new Date(event.endsAt).getTime() <= now) return "completed";
  if (new Date(event.startsAt).getTime() <= now) return "live";
  return "upcoming";
};

const duration = (event: EventRecord) => {
  if (!event.endsAt) return "Duration unavailable";
  const diffMs = new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime();
  return `${Math.round(diffMs / 60_000)} min`;
};

const STATE_TONE: Record<string, StatusTone> = {
  cancelled: "danger",
  live: "accent",
  completed: "neutral",
  upcoming: "neutral",
};

const STATE_LABEL: Record<string, string> = {
  cancelled: "Cancelled",
  live: "Live now",
  completed: "Concluded",
  upcoming: "Upcoming",
};

export function EventsView({
  events,
  enrollmentAvailable,
  currentTier,
  isMaster,
  isStaff = false,
  memberName,
  routeBase = "",
}: {
  events: EventRecord[];
  enrollmentAvailable: boolean;
  currentTier: number;
  isMaster: boolean;
  isStaff?: boolean;
  memberName?: string;
  routeBase?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const notify = useToast();
  const [now, setNow] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const refreshClock = () => setNow(new Date().getTime());
    refreshClock();
    const interval = window.setInterval(refreshClock, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const selected = useMemo(
    () => events.find((event) => event.id === params.get("event")) ?? null,
    [events, params],
  );

  const setSelected = (event: EventRecord | null) => {
    const next = new URLSearchParams(params);
    if (event) next.set("event", event.id);
    else next.delete("event");
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  };

  const enroll = (id: string) => {
    startTransition(async () => {
      const result = await enrollInEvent(id);
      if (result.error) notify(result.error, "error");
      else notify("You're enrolled. Your event desk is ready.", "success");
    });
  };

  const upcoming = events.filter((event) => ["upcoming", "live"].includes(state(event, now)));

  const recent = events.filter((event) => {
    const current = state(event, now);
    if (current === "cancelled") {
      const cancelledAt = event.cancelledAt ? new Date(event.cancelledAt).getTime() : new Date(event.startsAt).getTime();
      return cancelledAt > now - DAY_MS;
    }
    return current === "completed" && new Date(event.endsAt ?? event.startsAt).getTime() > now - DAY_MS;
  });

  const lists = [
    { key: "upcoming", title: "On the schedule", events: upcoming, always: true },
    {
      key: "recent",
      title: recent.some((event) => event.status === "cancelled") ? "Concluded and cancelled" : "Recently concluded",
      events: recent,
      always: false,
    },
  ];

  return (
    <AppShell
      active="Events"
      title="Events Directory"
      isMaster={isMaster}
      currentTier={currentTier}
      memberName={memberName}
      routeBase={routeBase}
    >
      <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <header className="border-b border-border-hairline pb-7">
          <p className="terminal-label text-text-faint">Session ledger</p>
          <h1 className="mt-3 text-title-lg font-medium text-text-strong">Scheduled practice, held live.</h1>
          <p className="mt-3 max-w-2xl text-content-base text-text-default">
            Open a session to review its details, then enroll once to secure your place.
          </p>
        </header>

        {/* The state of a region stays in the region. Only the outcome of an
            action leaves the layout, and that is a toast now. */}
        {!enrollmentAvailable && (
          <p
            role="status"
            className="mt-5 flex items-center gap-3 rounded-lg border border-status-warn/40 bg-status-warn/10 p-4 text-content-sm text-status-warn"
          >
            <HelpCircle size={17} className="shrink-0" />
            Enrollment is currently being prepared. Check back shortly.
          </p>
        )}

        <div className="mt-8 space-y-10">
          {lists.map((list) =>
            list.always || list.events.length ? (
              <EventList
                key={list.key}
                title={list.title}
                events={list.events}
                onOpen={setSelected}
                onEnroll={enroll}
                now={now}
                currentTier={currentTier}
                isMaster={isMaster}
                isStaff={isStaff}
                pending={pending}
                enrollmentAvailable={enrollmentAvailable}
              />
            ) : null,
          )}
        </div>
      </main>

      <Overlay
        open={selected !== null}
        onOpenChange={(open) => {
          // An enrollment in flight is a write already on its way; closing over
          // it would drop the result the button is waiting to report.
          if (!open && !pending) setSelected(null);
        }}
      >
        <OverlayContent size="md">
          {selected && (
            <EventDetails
              event={selected}
              currentTier={currentTier}
              isMaster={isMaster}
              isStaff={isStaff}
              pending={pending}
              enrollmentAvailable={enrollmentAvailable}
              onEnroll={enroll}
              onError={(message) => notify(message, "error")}
              now={now}
            />
          )}
        </OverlayContent>
      </Overlay>
    </AppShell>
  );
}

function EventList({
  title,
  events,
  onOpen,
  onEnroll,
  now,
  currentTier,
  isMaster,
  isStaff,
  pending,
  enrollmentAvailable,
}: {
  title: string;
  events: EventRecord[];
  onOpen: (event: EventRecord) => void;
  onEnroll: (id: string) => void;
  now: number;
  currentTier: number;
  isMaster: boolean;
  isStaff: boolean;
  pending: boolean;
  enrollmentAvailable: boolean;
}) {
  return (
    <section className="space-y-4" aria-label={title}>
      <div className="flex items-center gap-4">
        <h2 className="shrink-0 text-title-sm font-medium text-text-strong">{title}</h2>
        <div aria-hidden className="h-px flex-1 bg-border-hairline" />
      </div>

      {events.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              now={now}
              permitted={isStaff || isMaster || currentTier >= event.minTier}
              pending={pending}
              enrollmentAvailable={enrollmentAvailable}
              onOpen={() => onOpen(event)}
              onEnroll={() => onEnroll(event.id)}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border-hairline px-5 py-14 text-center text-content-sm text-text-muted">
          No sessions in this window.
        </p>
      )}
    </section>
  );
}

function EventCard({
  event,
  now,
  permitted,
  pending,
  enrollmentAvailable,
  onOpen,
  onEnroll,
}: {
  event: EventRecord;
  now: number;
  permitted: boolean;
  pending: boolean;
  enrollmentAvailable: boolean;
  onOpen: () => void;
  onEnroll: () => void;
}) {
  const current = state(event, now);
  const isLive = current === "live";
  const isCancelled = current === "cancelled";
  const isConcluded = current === "completed";

  return (
    <article
      className={`relative flex flex-col justify-between rounded-lg border p-5 transition-colors ${
        isCancelled
          ? "border-status-danger/30 bg-surface-panel"
          : isLive
            ? "border-primary/40 bg-surface-panel"
            : "border-border-hairline bg-surface-panel hover:border-border-strong"
      }`}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge tone={isCancelled ? "danger" : "neutral"}>{label(event.minTier)}</StatusBadge>
          <div className="flex items-center gap-2">
            {isLive && <span aria-hidden className="size-2 rounded-full bg-primary" />}
            <StatusBadge tone={STATE_TONE[current]}>{STATE_LABEL[current]}</StatusBadge>
          </div>
        </div>

        <h3 className="text-title-sm font-medium text-text-strong">
          {/* Stretched over the card, so the whole panel stays clickable and the
              keyboard reaches it. The enroll control below is raised above it. */}
          <button
            type="button"
            onClick={onOpen}
            className="focus-ring text-left after:absolute after:inset-0 after:rounded-lg"
          >
            {event.title}
          </button>
        </h3>

        <p className="line-clamp-2 text-content-sm text-text-default">
          {event.description || "A focused live session for the Stoicverse community."}
        </p>
        <p className="text-content-sm text-text-muted">
          Hosted by <span className="text-text-default">{event.hostName || "Stoicverse Team"}</span>
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border-hairline pt-4">
        <span className="inline-flex items-center gap-2 font-mono text-mono-xs text-text-muted tabular-nums">
          <CalendarDays size={13} className="shrink-0 text-primary" />
          {formatter.format(new Date(event.startsAt))}
        </span>

        <div className="relative shrink-0">
          {isCancelled ? (
            <StatusBadge tone="danger">Cancelled</StatusBadge>
          ) : isConcluded ? (
            <StatusBadge tone="neutral">Concluded</StatusBadge>
          ) : !permitted ? (
            <StatusBadge tone="neutral">
              <Lock size={11} className="shrink-0" />
              {label(event.minTier)} only
            </StatusBadge>
          ) : event.enrolled ? (
            <StatusBadge tone="accent">
              <CheckCircle size={11} className="shrink-0" />
              Enrolled
            </StatusBadge>
          ) : (
            <Button size="chrome" disabled={pending || !enrollmentAvailable} onClick={onEnroll}>
              {pending ? "Enrolling…" : "Enroll"}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function EventDetails({
  event,
  currentTier,
  isMaster,
  isStaff,
  pending,
  enrollmentAvailable,
  onEnroll,
  onError,
  now,
}: {
  event: EventRecord;
  currentTier: number;
  isMaster: boolean;
  isStaff: boolean;
  pending: boolean;
  enrollmentAvailable: boolean;
  onEnroll: (id: string) => void;
  onError: (message: string) => void;
  now: number;
}) {
  const permitted = isStaff || isMaster || currentTier >= event.minTier;
  const isLive = state(event, now) === "live";

  const join = async () => {
    try {
      const response = await fetch(`/api/events/${event.id}/room`);
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) return onError(payload.error ?? "Room unavailable.");
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch {
      onError("Unable to fetch the event room link. Please try again.");
    }
  };

  const facts = [
    { icon: CalendarDays, text: formatter.format(new Date(event.startsAt)) },
    { icon: Clock3, text: duration(event) },
    { icon: Users, text: `Hosted by ${event.hostName || "Stoicverse Team"}` },
    { icon: Lock, text: `Eligibility: ${label(event.minTier)}` },
  ];

  return (
    <>
      <OverlayHeader>
        <p className="terminal-label text-text-faint">Event details</p>
        <OverlayTitle>{event.title}</OverlayTitle>
        <OverlayDescription>
          {event.description || "A focused live session for the Stoicverse community."}
        </OverlayDescription>
      </OverlayHeader>

      <OverlayBody className="space-y-5">
        {event.status === "cancelled" && (
          <div className="space-y-1.5 rounded-lg border border-status-danger/40 bg-status-danger/10 p-4">
            <p className="terminal-label text-status-danger">Session cancelled</p>
            <p className="text-content-sm text-text-default">
              Reason: {event.cancellationReason || "No cancellation reason provided."}
            </p>
          </div>
        )}

        <dl className="grid gap-3 border-y border-border-hairline py-4 text-content-sm text-text-default">
          {facts.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <Icon size={15} className="shrink-0 text-primary" />
              <dd>{text}</dd>
            </div>
          ))}
        </dl>

        {!permitted && (
          <div className="space-y-2 rounded-lg border border-border-hairline bg-surface-sunken p-4">
            <p className="terminal-label flex items-center gap-2 text-text-muted">
              <Lock size={13} />
              Access boundary
            </p>
            {/* Real emphasis. These two names used to be wrapped in literal
                asterisks, which React renders as asterisks. */}
            <p className="text-content-sm text-text-default">
              This session requires <strong className="font-medium text-text-strong">{tierTitle(event.minTier)}</strong>{" "}
              access. Your current level is{" "}
              <strong className="font-medium text-text-strong">{tierTitle(currentTier)}</strong>. Complete your current
              tier&apos;s lessons to unlock the next level.
            </p>
          </div>
        )}

        {permitted && event.enrolled && !isLive && event.status !== "cancelled" && (
          <p className="flex items-start gap-3 rounded-lg border border-primary/30 bg-accent-soft p-4 text-content-sm text-text-default">
            <CheckCircle size={17} className="shrink-0 text-primary" />
            You&apos;re enrolled. The Zoom room opens automatically at the scheduled session time.
          </p>
        )}
      </OverlayBody>

      <OverlayFooter>
        {permitted && event.status !== "cancelled" && !event.enrolled && (
          <Button disabled={pending || !enrollmentAvailable} onClick={() => onEnroll(event.id)}>
            {pending ? "Enrolling…" : "Enroll in session"}
          </Button>
        )}
        {permitted && event.enrolled && isLive && (
          <Button onClick={join}>
            <Video size={15} />
            Join Zoom room
          </Button>
        )}
      </OverlayFooter>
    </>
  );
}
