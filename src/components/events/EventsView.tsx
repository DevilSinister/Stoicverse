"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Clock3, Lock, Users, Video, X, CheckCircle, HelpCircle } from "lucide-react";
import { enrollInEvent } from "@/app/events/actions";
import { AppShell } from "@/components/layout/AppShell";

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

const label = (tier: number) => (tier === 5 ? "Masters" : `Tier ${tier}+`);

const state = (event: EventRecord, now: number) => {
  if (event.status === "cancelled") return "cancelled";
  if (event.endsAt && new Date(event.endsAt).getTime() <= now) return "completed";
  if (new Date(event.startsAt).getTime() <= now) return "live";
  return "upcoming";
};

const duration = (event: EventRecord) => {
  if (event.endsAt) {
    const diffMs = new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime();
    return `${Math.round(diffMs / 60_000)} min`;
  }
  return "Duration unavailable";
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
  const [now, setNow] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const selected = useMemo(() => {
    return events.find((event) => event.id === params.get("event")) ?? null;
  }, [events, params]);

  const setSelected = (event: EventRecord | null) => {
    const next = new URLSearchParams(params);
    if (event) {
      next.set("event", event.id);
    } else {
      next.delete("event");
    }
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  };

  const enroll = (id: string) => {
    startTransition(async () => {
      const result = await enrollInEvent(id);
      setMessage(result.error ?? "You’re enrolled. Your event desk is ready.");
    });
  };

  const upcoming = events.filter((event) => {
    const s = state(event, now);
    return ["upcoming", "live"].includes(s);
  });

  const recent = events.filter((event) => {
    const s = state(event, now);
    if (s === "cancelled") {
      const cancelledTime = event.cancelledAt ? new Date(event.cancelledAt).getTime() : new Date(event.startsAt).getTime();
      return cancelledTime > now - 86_400_000;
    }
    return (
      s === "completed" &&
      new Date(event.endsAt ?? event.startsAt).getTime() > now - 86_400_000
    );
  });

  return (
    <AppShell
      active="Events"
      title="Events Directory"
      isMaster={isMaster}
      currentTier={currentTier}
      memberName={memberName}
      routeBase={routeBase}
    >
      <main className="mx-auto max-w-7xl p-4 md:p-8 space-y-8">
        <header className="mb-4">
          <p className="font-label text-xs tracking-[.14em] text-primary-container uppercase font-bold">Session Ledger</p>
          <h1 className="mt-2 font-headline text-3xl font-extrabold text-white tracking-tight md:text-4xl">
            Scheduled practice, held live.
          </h1>
          <p className="mt-2 font-body text-sm text-fog-muted">
            Open a session to review its details, then enroll once to secure your place.
          </p>
        </header>

        {message && (
          <div
            role="status"
            className="mb-5 border border-primary-container/30 bg-primary-container/10 p-4 rounded-xl text-sm text-white flex items-center gap-3"
          >
            <CheckCircle className="text-primary-container shrink-0" size={18} />
            <span>{message}</span>
          </div>
        )}

        {!enrollmentAvailable && (
          <div
            role="status"
            className="mb-5 border border-amber-500/30 bg-amber-500/5 p-4 rounded-xl text-sm text-amber-200 flex items-center gap-3"
          >
            <HelpCircle className="text-amber-400 shrink-0" size={18} />
            <span>Enrollment is currently being prepared. Check back shortly.</span>
          </div>
        )}

        <div className="space-y-10">
          <EventList
            title="On the schedule"
            events={upcoming}
            onOpen={setSelected}
            onEnroll={enroll}
            now={now}
            currentTier={currentTier}
            isMaster={isMaster}
            isStaff={isStaff}
            pending={pending}
            enrollmentAvailable={enrollmentAvailable}
          />
          {recent.length > 0 && (
            <EventList
              title={recent.some(e => e.status === "cancelled") ? "Concluded & cancelled" : "Recently concluded"}
              events={recent}
              onOpen={setSelected}
              onEnroll={enroll}
              now={now}
              currentTier={currentTier}
              isMaster={isMaster}
              isStaff={isStaff}
              pending={pending}
              enrollmentAvailable={enrollmentAvailable}
            />
          )}
        </div>
      </main>

      {selected && (
        <MemberEventDetails
          event={selected}
          currentTier={currentTier}
          isMaster={isMaster}
          isStaff={isStaff}
          pending={pending}
          enrollmentAvailable={enrollmentAvailable}
          onClose={() => setSelected(null)}
          onEnroll={enroll}
          now={now}
        />
      )}
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
    <section className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="font-headline text-xl font-bold text-white tracking-tight shrink-0">{title}</h2>
        <div className="h-px flex-1 bg-surgical-steel" />
      </div>

      {events.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in">
          {events.map((event) => {
            const isLive = state(event, now) === "live";
            const permitted = isStaff || isMaster || currentTier >= event.minTier;
            const isCancelled = event.status === "cancelled";
            const isConcluded = event.endsAt && new Date(event.endsAt).getTime() <= now;

            return (
              <article
                key={event.id}
                onClick={() => onOpen(event)}
                className={`group relative flex flex-col justify-between text-left rounded-xl border p-6 transition-all duration-200 cursor-pointer ${
                  isCancelled
                    ? "border-red-500/20 bg-red-500/5 hover:border-red-500/30 opacity-75"
                    : isLive
                    ? "border-primary-container/40 bg-surface-container-high/40 hover:border-primary-container"
                    : "border-surgical-steel bg-monolith-surface hover:border-surgical-steel/80"
                }`}
              >
                <div className="space-y-4 w-full">
                  <div className="flex justify-between items-center text-xs font-label">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      isCancelled 
                        ? "border-red-500/30 bg-red-500/10 text-red-400"
                        : "border-surgical-steel bg-surface-container-high text-fog-muted"
                    }`}>
                      {label(event.minTier)}
                    </span>
                    <div className="flex items-center gap-2">
                      {isLive && (
                        <span className="relative inline-flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-container opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-container" />
                        </span>
                      )}
                      <span className={`text-[10px] font-extrabold tracking-widest uppercase px-2.5 py-0.5 rounded-full border ${
                        isCancelled
                          ? "border-red-500/30 bg-red-500/10 text-red-400"
                          : isLive
                          ? "border-primary-container/20 bg-primary-container/10 text-primary-container"
                          : isConcluded
                          ? "border-surgical-steel bg-surface-container-high/30 text-fog-muted/70"
                          : "border-surgical-steel bg-surface-container-high text-white"
                      }`}>
                        {isLive ? "Live Now" : isCancelled ? "Cancelled" : isConcluded ? "Concluded" : "Upcoming"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-headline text-2xl font-bold text-white group-hover:text-primary-container transition-colors leading-snug">
                      {event.title}
                    </h3>
                    <p className="text-xs text-on-surface-variant font-body leading-relaxed line-clamp-2">
                      {event.description || "A focused live session for the Stoicverse community."}
                    </p>
                    <p className="text-[11px] text-fog-muted font-body">
                      Hosted by <span className="text-white/90 font-medium">{event.hostName ?? "Stoicverse Team"}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-surgical-steel/60 w-full flex justify-between items-center text-xs font-label">
                  <div className="flex items-center gap-2 text-fog-muted font-mono text-[11px]">
                    <CalendarDays size={13} className="text-primary-container/70 shrink-0" />
                    <span>{formatter.format(new Date(event.startsAt))}</span>
                  </div>

                  <div className="shrink-0">
                    {isCancelled ? (
                      <span className="text-red-400 border border-red-500/20 bg-red-500/5 py-1 px-3 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                        Cancelled
                      </span>
                    ) : isConcluded ? (
                      <span className="text-fog-muted/60 border border-surgical-steel bg-surface-container-high/30 py-1 px-3 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                        Concluded
                      </span>
                    ) : !permitted ? (
                      <div className="flex items-center gap-1 text-fog-muted bg-surface-container-high/65 border border-surgical-steel/80 py-1 px-3 rounded-full text-[10px] font-semibold uppercase tracking-wider">
                        <Lock size={11} className="text-red-400/80 shrink-0" />
                        <span>{label(event.minTier)} Only</span>
                      </div>
                    ) : event.enrolled ? (
                      <span className="flex items-center gap-1 text-primary-container bg-primary-container/5 border border-primary-container/20 py-1 px-3 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        <CheckCircle size={11} className="shrink-0" />
                        Enrolled
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={pending || !enrollmentAvailable}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEnroll(event.id);
                        }}
                        className="rounded-full bg-primary-container text-on-primary-fixed hover:brightness-110 active:scale-[0.96] transition-all py-1.5 px-4 text-[10px] uppercase tracking-wider font-bold emerald-glow disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {pending ? "..." : "Enroll"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="border border-dashed border-surgical-steel/80 p-8 rounded-xl text-center">
          <p className="text-sm text-fog-muted">No sessions in this window.</p>
        </div>
      )}
    </section>
  );
}

function MemberEventDetails({
  event,
  currentTier,
  isMaster,
  isStaff,
  pending,
  enrollmentAvailable,
  onClose,
  onEnroll,
  now,
}: {
  event: EventRecord;
  currentTier: number;
  isMaster: boolean;
  isStaff: boolean;
  pending: boolean;
  enrollmentAvailable: boolean;
  onClose: () => void;
  onEnroll: (id: string) => void;
  now: number;
}) {
  const close = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    close.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const permitted = isStaff || isMaster || currentTier >= event.minTier;
  const isLive = state(event, now) === "live";

  const join = async () => {
    try {
      const response = await fetch(`/api/events/${event.id}/room`);
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        return window.alert(payload.error ?? "Room unavailable.");
      }
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      window.alert("Unable to fetch event room link. Please try again.");
    }
  };

  const getTierTitle = (level: number) => {
    const titles = ["Basic", "Beginner", "Intermediate", "Advanced", "Master Zone"];
    return titles[level - 1] || `Tier ${level}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-event-title"
      className="fixed inset-0 z-50 grid place-items-center bg-surface-container-lowest/85 backdrop-blur-sm p-4"
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-surgical-steel bg-monolith-surface overflow-hidden shadow-2xl animate-fade-in-up"
      >
        {/* Modal Header */}
        <div className="flex justify-between items-start border-b border-surgical-steel bg-surface-container-high/60 p-5 md:p-6">
          <div>
            <p className="font-label text-xs text-primary-container font-semibold tracking-wider uppercase">Event Details</p>
            <h2 id="member-event-title" className="mt-1.5 font-headline text-2xl font-bold text-white tracking-tight leading-snug">
              {event.title}
            </h2>
          </div>
          <button
            ref={close}
            onClick={onClose}
            className="text-fog-muted hover:text-white p-1 rounded-full hover:bg-surface-container-high transition-colors focus:outline-none focus:ring-2 focus:ring-primary-container"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 md:p-6 space-y-6 text-sm">
          {event.status === "cancelled" && (
            <div className="border border-red-500/20 bg-red-500/5 p-4 rounded-xl space-y-1.5 text-red-200">
              <p className="font-label text-xs font-bold text-red-400 uppercase tracking-wider">Session Cancelled</p>
              <p className="font-body text-sm">
                Reason: {event.cancellationReason || "No cancellation reason provided."}
              </p>
            </div>
          )}

          <div className="font-body text-on-surface-variant leading-relaxed">
            {event.description || "A focused live session for the Stoicverse community."}
          </div>

          {/* Details Table */}
          <div className="grid gap-3.5 border-y border-surgical-steel/60 py-5 font-label text-xs text-fog-muted">
            <div className="flex items-center gap-3">
              <CalendarDays className="text-primary-container shrink-0" size={16} />
              <span>{formatter.format(new Date(event.startsAt))}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock3 className="text-primary-container shrink-0" size={16} />
              <span>{duration(event)}</span>
            </div>
            <div className="flex items-center gap-3">
              <Users className="text-primary-container shrink-0" size={16} />
              <span>Hosted by {event.hostName}</span>
            </div>
            <div className="flex items-center gap-3">
              <Lock className="text-primary-container shrink-0" size={16} />
              <span>Eligibility: {label(event.minTier)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2">
            {!permitted ? (
              <div className="flex flex-col gap-2 p-4 bg-surface-container-high/40 border border-surgical-steel/50 rounded-xl">
                <p className="flex items-center gap-2 font-label text-xs text-fog-muted font-semibold uppercase tracking-wider">
                  <Lock size={14} className="text-red-400" />
                  Access Boundary Gated
                </p>
                <p className="font-body text-xs text-on-surface-variant">
                  This practice session requires **{getTierTitle(event.minTier)}** access. Your current access level is **{getTierTitle(currentTier)}**. Complete your current tier's lessons to unlock the next level.
                </p>
              </div>
            ) : event.status === "cancelled" ? (
              <div className="text-center py-2 text-fog-muted font-body text-xs">
                This event has been cancelled and is unavailable for enrollment.
              </div>
            ) : !event.enrolled ? (
              <button
                disabled={pending || !enrollmentAvailable}
                onClick={() => onEnroll(event.id)}
                className="w-full rounded-full bg-primary-container hover:brightness-110 active:scale-[0.98] transition-all duration-200 p-3.5 font-label-md text-label-md text-on-primary-fixed uppercase tracking-wider font-semibold shadow-md emerald-glow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending ? "Enrolling..." : "Enroll in session"}
              </button>
            ) : isLive ? (
              <button
                onClick={join}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-container hover:brightness-110 active:scale-[0.98] transition-all duration-200 p-3.5 font-label-md text-label-md text-on-primary-fixed uppercase tracking-wider font-semibold shadow-md emerald-glow cursor-pointer"
              >
                <Video size={16} className="animate-pulse" />
                Join Zoom room
              </button>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-primary-container/5 border border-primary-container/20 rounded-xl">
                <CheckCircle className="text-primary-container shrink-0" size={18} />
                <div className="space-y-0.5">
                  <p className="font-label text-xs font-semibold text-primary-container uppercase tracking-wider">You're Enrolled</p>
                  <p className="font-body text-xs text-fog-muted">
                    The Zoom room opens automatically at the scheduled session time.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
