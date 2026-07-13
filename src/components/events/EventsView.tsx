"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, Check, Clock3, Lock, Users, Video } from "lucide-react";

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
};

const formatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});

function timeUntil(iso: string, now: number) {
  const remaining = new Date(iso).getTime() - now;
  if (remaining <= 0) return "Now";
  const totalMinutes = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  return days ? `${days}d ${hours}h` : `${hours}h ${minutes}m`;
}

function eventState(event: EventRecord, now: number) {
  if (event.status === "cancelled") return "cancelled";
  if (event.endsAt && new Date(event.endsAt).getTime() <= now) return "completed";
  if (new Date(event.startsAt).getTime() <= now) return "live";
  return "upcoming";
}

export function EventsView({ events, enrollmentAvailable, currentTier, isMaster, memberName, routeBase = "" }: {
  events: EventRecord[]; enrollmentAvailable: boolean; currentTier: number; isMaster: boolean; memberName?: string; routeBase?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);

  const nextEvent = useMemo(() => events.find((event) => eventState(event, now) === "upcoming"), [events, now]);
  const upcoming = events.filter((event) => ["upcoming", "live"].includes(eventState(event, now)));
  const recentCutoff = now - 24 * 60 * 60 * 1000;
  const recent = events.filter((event) => eventState(event, now) === "completed" && new Date(event.endsAt ?? event.startsAt).getTime() >= recentCutoff);

  const submitEnrollment = (eventId: string) => startTransition(async () => {
    const result = await enrollInEvent(eventId);
    setMessage(result.error ?? "You're enrolled. Your event desk is ready.");
  });

  return (
    <AppShell active="Events" title="Events Directory" isMaster={isMaster} currentTier={currentTier} memberName={memberName} routeBase={routeBase}>
      <main className="mx-auto max-w-7xl p-4 md:p-8">
        <div className="mb-6 flex flex-col gap-4 border-b border-surgical-steel pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-label text-xs tracking-[0.14em] text-primary-container">SESSION LEDGER</p>
            <h1 className="mt-2 font-headline text-2xl font-bold text-white md:text-3xl">Scheduled practice, held live.</h1>
            <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-on-surface-variant">Enroll once to keep your place. Event rooms unlock at their scheduled time for qualified members.</p>
          </div>
        </div>

        {!enrollmentAvailable && <div role="status" className="mb-5 border border-amber-400/50 bg-amber-400/10 px-4 py-3 font-body text-sm text-on-surface">Event enrollment is being prepared. Apply the latest database migration to enable enrollment.</div>}
        {message && <div role="status" className="mb-5 flex items-center justify-between gap-4 border border-primary-container/50 bg-primary-container/10 px-4 py-3 font-body text-sm text-on-surface"><span>{message}</span><button className="font-label text-xs text-primary-container hover:text-white" onClick={() => setMessage(null)}>Dismiss</button></div>}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-8">
            <EventList title="On the schedule" events={upcoming} now={now} currentTier={currentTier} pending={isPending} enrollmentAvailable={enrollmentAvailable} onEnroll={submitEnrollment} />
            {recent.length > 0 && <EventList title="Recently concluded" events={recent} now={now} currentTier={currentTier} pending={isPending} enrollmentAvailable={enrollmentAvailable} onEnroll={submitEnrollment} />}
          </div>
          <aside className="h-fit rounded-lg border border-surgical-steel bg-surface-container-low xl:sticky xl:top-6">
            <div className="border-b border-surgical-steel bg-surface-container-high px-4 py-3"><p className="font-label text-xs tracking-[0.13em] text-fog-muted">NEXT SESSION</p></div>
            <div className="p-4">
              {nextEvent ? <><p className="font-label text-xs text-primary-container">IN {timeUntil(nextEvent.startsAt, now)}</p><h2 className="mt-2 font-headline text-lg font-semibold text-white">{nextEvent.title}</h2><p className="mt-3 border-t border-surgical-steel pt-3 font-label text-xs text-fog-muted">{formatter.format(new Date(nextEvent.startsAt))}</p></> : <p className="font-body text-sm leading-relaxed text-fog-muted">No upcoming sessions have been scheduled.</p>}
            </div>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

function EventList({ title, events, now, currentTier, pending, enrollmentAvailable, onEnroll }: { title: string; events: EventRecord[]; now: number; currentTier: number; pending: boolean; enrollmentAvailable: boolean; onEnroll: (id: string) => void }) {
  return <section><div className="mb-3 flex items-center gap-3"><h2 className="font-headline text-lg font-semibold text-white">{title}</h2><span className="h-px flex-1 bg-surgical-steel" /></div>{events.length ? <div className="grid gap-4 lg:grid-cols-2">{events.map((event) => <EventCard key={event.id} event={event} now={now} currentTier={currentTier} pending={pending} enrollmentAvailable={enrollmentAvailable} onEnroll={onEnroll} />)}</div> : <div className="border border-dashed border-surgical-steel p-6 font-body text-sm text-fog-muted">No sessions in this window.</div>}</section>;
}

function EventCard({ event, now, currentTier, pending, enrollmentAvailable, onEnroll }: { event: EventRecord; now: number; currentTier: number; pending: boolean; enrollmentAvailable: boolean; onEnroll: (id: string) => void }) {
  const state = eventState(event, now);
  const tierAllowed = currentTier >= event.minTier;
  const isLive = state === "live";
  const isCompleted = state === "completed";
  const canEnter = event.enrolled && tierAllowed && isLive;
  const roomLabel = !event.enrolled ? "Enroll to access room" : !tierAllowed ? `Unlock Tier ${event.minTier}` : canEnter ? "Join Zoom room" : `Room opens in ${timeUntil(event.startsAt, now)}`;
  const openRoom = async () => {
    const response = await fetch(`/api/events/${event.id}/room`);
    const payload = await response.json() as { url?: string; error?: string };
    if (!response.ok || !payload.url) { window.alert(payload.error ?? "The room is not available yet."); return; }
    window.open(payload.url, "_blank", "noopener,noreferrer");
  };

  return <article className="flex min-h-[285px] flex-col rounded-lg border border-surgical-steel bg-monolith-surface transition-colors hover:border-slate-500">
    <div className="flex items-center justify-between border-b border-surgical-steel bg-surface-container-high px-4 py-3"><span className="font-label text-xs text-primary-container">TIER {event.minTier}+</span><span className={state === "live" ? "font-label text-xs text-primary-container" : "font-label text-xs text-fog-muted"}>{state === "live" ? "● LIVE NOW" : state === "completed" ? "CONCLUDED" : `STARTS IN ${timeUntil(event.startsAt, now)}`}</span></div>
    <div className="flex flex-1 flex-col p-5"><h3 className="font-headline text-xl font-semibold text-white">{event.title}</h3><p className="mt-2 line-clamp-2 font-body text-sm leading-relaxed text-on-surface-variant">{event.description || "A focused live session for the Stoicverse community."}</p><dl className="mt-5 grid gap-2 border-t border-surgical-steel pt-4 font-label text-xs text-fog-muted"><div className="flex items-center gap-2"><CalendarDays size={14} className="text-primary-container" /><dd>{formatter.format(new Date(event.startsAt))}</dd></div><div className="flex items-center gap-2"><Users size={14} className="text-primary-container" /><dd>Hosted by {event.hostName}</dd></div></dl><div className="mt-auto pt-5">{isCompleted ? <span className="inline-flex items-center gap-2 font-label text-xs text-fog-muted"><Check size={15} /> Session ended</span> : !tierAllowed ? <span className="inline-flex items-center gap-2 font-label text-xs text-fog-muted"><Lock size={15} /> Reach Tier {event.minTier} to enroll</span> : !enrollmentAvailable ? <span className="inline-flex min-h-10 w-full items-center justify-center gap-2 border border-surgical-steel px-4 font-label text-xs text-fog-muted"><Clock3 size={15} /> Enrollment preparing</span> : !event.enrolled ? <button disabled={pending} onClick={() => onEnroll(event.id)} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-primary-container px-4 font-label text-xs font-semibold text-on-primary-fixed transition hover:brightness-110 disabled:opacity-60"><Users size={15} /> Enroll in session</button> : canEnter ? <button type="button" onClick={openRoom} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-primary-container px-4 font-label text-xs font-semibold text-on-primary-fixed transition hover:brightness-110"><Video size={15} /> {roomLabel}</button> : <span className="inline-flex min-h-10 w-full items-center justify-center gap-2 border border-surgical-steel px-4 font-label text-xs text-fog-muted"><Clock3 size={15} /> {roomLabel}</span>}</div></div>
  </article>;
}
