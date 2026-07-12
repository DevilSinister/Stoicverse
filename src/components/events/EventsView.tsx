"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, Check, Clock3, Link2, Lock, Plus, Users, Video } from "lucide-react";

import { createEvent, enrollInEvent, updateEventZoomUrl } from "@/app/events/actions";
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

export function EventsView({ events, enrollmentAvailable, currentTier, isMaster, canManage, memberName }: {
  events: EventRecord[]; enrollmentAvailable: boolean; currentTier: number; isMaster: boolean; canManage: boolean; memberName?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [isCreating, setIsCreating] = useState(false);
  const [roomLinkEvent, setRoomLinkEvent] = useState<EventRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);

  const nextEvent = useMemo(() => events.find((event) => eventState(event, now) === "upcoming"), [events, now]);
  const upcoming = events.filter((event) => ["upcoming", "live"].includes(eventState(event, now)));
  const recentCutoff = now - 24 * 60 * 60 * 1000;
  const recent = events.filter((event) => eventState(event, now) === "completed" && new Date(event.endsAt ?? event.startsAt).getTime() >= recentCutoff);

  const submitEnrollment = (eventId: string) => startTransition(async () => {
    const result = await enrollInEvent(eventId);
    setMessage(result.error ?? "You’re enrolled. Your event desk is ready.");
  });
  const submitCreation = (formData: FormData) => startTransition(async () => {
    const result = await createEvent(formData);
    setMessage(result.error ?? "Event created and announced in the events channel.");
    if (result.success) setIsCreating(false);
  });
  const publishRoomLink = (eventId: string, zoomUrl: string) => startTransition(async () => {
    const result = await updateEventZoomUrl(eventId, zoomUrl);
    setMessage(result.error ?? "Meeting link published for enrolled members.");
    if (result.success) setRoomLinkEvent(null);
  });

  return (
    <AppShell active="Events" title="Events Directory" isMaster={isMaster} currentTier={currentTier} memberName={memberName}>
      <main className="mx-auto max-w-7xl p-4 md:p-8">
        <div className="mb-6 flex flex-col gap-4 border-b border-surgical-steel pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-label text-xs tracking-[0.14em] text-primary-container">SESSION LEDGER</p>
            <h1 className="mt-2 font-headline text-2xl font-bold text-white md:text-3xl">Scheduled practice, held live.</h1>
            <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-on-surface-variant">Enroll once to keep your place. Event rooms unlock at their scheduled time; staff may add the Zoom room later.</p>
          </div>
          {canManage && <button type="button" onClick={() => setIsCreating(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary-container px-5 font-label text-xs font-semibold text-on-primary-fixed transition hover:brightness-110 focus-ring"><Plus size={16} /> Create event</button>}
        </div>

        {!enrollmentAvailable && <div role="status" className="mb-5 border border-amber-400/50 bg-amber-400/10 px-4 py-3 font-body text-sm text-on-surface">Event enrollment is being prepared. Apply the latest database migration to enable enrollment.</div>}
        {message && <div role="status" className="mb-5 flex items-center justify-between gap-4 border border-primary-container/50 bg-primary-container/10 px-4 py-3 font-body text-sm text-on-surface"><span>{message}</span><button className="font-label text-xs text-primary-container hover:text-white" onClick={() => setMessage(null)}>Dismiss</button></div>}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-8">
            <EventList title="On the schedule" events={upcoming} now={now} currentTier={currentTier} pending={isPending} canManage={canManage} enrollmentAvailable={enrollmentAvailable} onEnroll={submitEnrollment} onAddRoomLink={setRoomLinkEvent} />
            {recent.length > 0 && <EventList title="Recently concluded" events={recent} now={now} currentTier={currentTier} pending={isPending} canManage={canManage} enrollmentAvailable={enrollmentAvailable} onEnroll={submitEnrollment} onAddRoomLink={setRoomLinkEvent} />}
          </div>
          <aside className="h-fit border border-surgical-steel bg-surface-container-low rounded-lg xl:sticky xl:top-6">
            <div className="border-b border-surgical-steel bg-surface-container-high px-4 py-3"><p className="font-label text-xs tracking-[0.13em] text-fog-muted">NEXT SESSION</p></div>
            <div className="p-4">
              {nextEvent ? <><p className="font-label text-xs text-primary-container">IN {timeUntil(nextEvent.startsAt, now)}</p><h2 className="mt-2 font-headline text-lg font-semibold text-white">{nextEvent.title}</h2><p className="mt-3 border-t border-surgical-steel pt-3 font-label text-xs text-fog-muted">{formatter.format(new Date(nextEvent.startsAt))}</p></> : <p className="font-body text-sm leading-relaxed text-fog-muted">No upcoming sessions have been scheduled.</p>}
            </div>
          </aside>
        </div>
      </main>
      {isCreating && <CreateEventDialog pending={isPending} onClose={() => setIsCreating(false)} onSubmit={submitCreation} />}
      {roomLinkEvent && <RoomLinkDialog event={roomLinkEvent} pending={isPending} onClose={() => setRoomLinkEvent(null)} onSubmit={publishRoomLink} />}
    </AppShell>
  );
}

function EventList({ title, events, now, currentTier, pending, canManage, enrollmentAvailable, onEnroll, onAddRoomLink }: { title: string; events: EventRecord[]; now: number; currentTier: number; pending: boolean; canManage: boolean; enrollmentAvailable: boolean; onEnroll: (id: string) => void; onAddRoomLink: (event: EventRecord) => void }) {
  return <section><div className="mb-3 flex items-center gap-3"><h2 className="font-headline text-lg font-semibold text-white">{title}</h2><span className="h-px flex-1 bg-surgical-steel" /></div>{events.length ? <div className="grid gap-4 lg:grid-cols-2">{events.map((event) => <EventCard key={event.id} event={event} now={now} currentTier={currentTier} pending={pending} canManage={canManage} enrollmentAvailable={enrollmentAvailable} onEnroll={onEnroll} onAddRoomLink={onAddRoomLink} />)}</div> : <div className="border border-dashed border-surgical-steel p-6 font-body text-sm text-fog-muted">No sessions in this window.</div>}</section>;
}

function EventCard({ event, now, currentTier, pending, canManage, enrollmentAvailable, onEnroll, onAddRoomLink }: { event: EventRecord; now: number; currentTier: number; pending: boolean; canManage: boolean; enrollmentAvailable: boolean; onEnroll: (id: string) => void; onAddRoomLink: (event: EventRecord) => void }) {
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

  return <article className="flex min-h-[285px] flex-col border border-surgical-steel bg-monolith-surface rounded-lg transition-colors hover:border-slate-500">
    <div className="flex items-center justify-between border-b border-surgical-steel bg-surface-container-high px-4 py-3"><span className="font-label text-xs text-primary-container">TIER {event.minTier}+</span><span className={state === "live" ? "font-label text-xs text-primary-container" : "font-label text-xs text-fog-muted"}>{state === "live" ? "● LIVE NOW" : state === "completed" ? "CONCLUDED" : `STARTS IN ${timeUntil(event.startsAt, now)}`}</span></div>
    <div className="flex flex-1 flex-col p-5"><h3 className="font-headline text-xl font-semibold text-white">{event.title}</h3><p className="mt-2 line-clamp-2 font-body text-sm leading-relaxed text-on-surface-variant">{event.description || "A focused live session for the Stoicverse community."}</p><dl className="mt-5 grid gap-2 border-t border-surgical-steel pt-4 font-label text-xs text-fog-muted"><div className="flex items-center gap-2"><CalendarDays size={14} className="text-primary-container" /><dd>{formatter.format(new Date(event.startsAt))}</dd></div><div className="flex items-center gap-2"><Users size={14} className="text-primary-container" /><dd>Hosted by {event.hostName}</dd></div></dl><div className="mt-auto pt-5">{isCompleted ? <span className="inline-flex items-center gap-2 font-label text-xs text-fog-muted"><Check size={15} /> Session ended</span> : !tierAllowed ? <span className="inline-flex items-center gap-2 font-label text-xs text-fog-muted"><Lock size={15} /> Reach Tier {event.minTier} to enroll</span> : !enrollmentAvailable ? <span className="inline-flex min-h-10 w-full items-center justify-center gap-2 border border-surgical-steel px-4 font-label text-xs text-fog-muted"><Clock3 size={15} /> Enrollment preparing</span> : !event.enrolled ? <button disabled={pending} onClick={() => onEnroll(event.id)} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-primary-container px-4 font-label text-xs font-semibold text-on-primary-fixed transition hover:brightness-110 disabled:opacity-60"><Users size={15} /> Enroll in session</button> : canEnter ? <button type="button" onClick={openRoom} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-primary-container px-4 font-label text-xs font-semibold text-on-primary-fixed transition hover:brightness-110"><Video size={15} /> {roomLabel}</button> : <span className="inline-flex min-h-10 w-full items-center justify-center gap-2 border border-surgical-steel px-4 font-label text-xs text-fog-muted"><Clock3 size={15} /> {roomLabel}</span>}</div></div>
    {canManage && !isCompleted && <div className="border-t border-surgical-steel px-5 py-3"><button type="button" onClick={() => onAddRoomLink(event)} className="font-label text-xs text-primary-container hover:text-white">+ Publish Zoom link</button></div>}
  </article>;
}

function CreateEventDialog({ pending, onClose, onSubmit }: { pending: boolean; onClose: () => void; onSubmit: (data: FormData) => void }) {
  return <div role="dialog" aria-modal="true" aria-labelledby="event-dialog-title" className="fixed inset-0 z-50 grid place-items-center bg-surface-container-lowest/85 p-4" onMouseDown={onClose}><form action={onSubmit} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-xl border border-surgical-steel bg-monolith-surface rounded-lg"><div className="flex items-center justify-between border-b border-surgical-steel bg-surface-container-high px-5 py-4"><div><p className="font-label text-xs text-primary-container">STAFF CONTROL</p><h2 id="event-dialog-title" className="mt-1 font-headline text-lg font-semibold text-white">Schedule an event</h2></div><button type="button" onClick={onClose} className="font-label text-xs text-fog-muted hover:text-white">Close</button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><Field label="Event title" name="title" required className="sm:col-span-2" /><label className="grid gap-1.5 sm:col-span-2"><span className="font-label text-xs text-fog-muted">Description</span><textarea name="description" rows={3} className="border border-surgical-steel bg-surface-container-low px-3 py-2 font-body text-sm text-white outline-none focus:border-primary-container" /></label><Field label="Host name" name="hostName" placeholder="Stoicverse Team" /><label className="grid gap-1.5"><span className="font-label text-xs text-fog-muted">Minimum tier</span><select name="minTier" defaultValue="1" className="h-10 border border-surgical-steel bg-surface-container-low px-3 font-body text-sm text-white outline-none focus:border-primary-container">{[1, 2, 3, 4, 5].map((tier) => <option key={tier} value={tier}>Tier {tier}</option>)}</select></label><Field label="Starts at" name="startsAt" type="datetime-local" required /><Field label="Ends at (optional)" name="endsAt" type="datetime-local" /><label className="grid gap-1.5 sm:col-span-2"><span className="font-label text-xs text-fog-muted">Zoom URL <em className="not-italic text-primary-container">optional — can be added later</em></span><div className="flex items-center gap-2 border border-surgical-steel bg-surface-container-low px-3"><Link2 size={15} className="text-fog-muted" /><input name="zoomUrl" type="url" placeholder="https://zoom.us/j/..." className="h-10 min-w-0 flex-1 bg-transparent font-body text-sm text-white outline-none placeholder:text-fog-muted" /></div></label></div><div className="flex justify-end gap-3 border-t border-surgical-steel px-5 py-4"><button type="button" onClick={onClose} className="min-h-10 px-3 font-label text-xs text-fog-muted hover:text-white">Cancel</button><button disabled={pending} className="min-h-10 rounded-full bg-primary-container px-5 font-label text-xs font-semibold text-on-primary-fixed disabled:opacity-60">{pending ? "Scheduling…" : "Schedule event"}</button></div></form></div>;
}

function RoomLinkDialog({ event, pending, onClose, onSubmit }: { event: EventRecord; pending: boolean; onClose: () => void; onSubmit: (eventId: string, zoomUrl: string) => void }) {
  return <div role="dialog" aria-modal="true" aria-labelledby="room-link-dialog-title" className="fixed inset-0 z-50 grid place-items-center bg-surface-container-lowest/85 p-4" onMouseDown={onClose}><form onSubmit={(formEvent) => { formEvent.preventDefault(); const data = new FormData(formEvent.currentTarget); onSubmit(event.id, String(data.get("zoomUrl") ?? "")); }} onMouseDown={(formEvent) => formEvent.stopPropagation()} className="w-full max-w-md border border-surgical-steel bg-monolith-surface rounded-lg"><div className="border-b border-surgical-steel bg-surface-container-high px-5 py-4"><p className="font-label text-xs text-primary-container">EVENT ROOM</p><h2 id="room-link-dialog-title" className="mt-1 font-headline text-lg font-semibold text-white">Publish Zoom link</h2><p className="mt-2 font-body text-sm text-fog-muted">{event.title}</p></div><div className="p-5"><label className="grid gap-1.5"><span className="font-label text-xs text-fog-muted">Zoom URL</span><div className="flex items-center gap-2 border border-surgical-steel bg-surface-container-low px-3"><Link2 size={15} className="text-fog-muted" /><input name="zoomUrl" type="url" required placeholder="https://zoom.us/j/..." className="h-10 min-w-0 flex-1 bg-transparent font-body text-sm text-white outline-none placeholder:text-fog-muted" /></div></label></div><div className="flex justify-end gap-3 border-t border-surgical-steel px-5 py-4"><button type="button" onClick={onClose} className="min-h-10 px-3 font-label text-xs text-fog-muted hover:text-white">Cancel</button><button disabled={pending} className="min-h-10 rounded-full bg-primary-container px-5 font-label text-xs font-semibold text-on-primary-fixed disabled:opacity-60">{pending ? "Publishing…" : "Publish link"}</button></div></form></div>;
}

function Field({ label, name, type = "text", required, placeholder, className = "" }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string; className?: string }) {
  return <label className={`grid gap-1.5 ${className}`}><span className="font-label text-xs text-fog-muted">{label}</span><input name={name} type={type} required={required} placeholder={placeholder} className="h-10 border border-surgical-steel bg-surface-container-low px-3 font-body text-sm text-white outline-none placeholder:text-fog-muted focus:border-primary-container" /></label>;
}
