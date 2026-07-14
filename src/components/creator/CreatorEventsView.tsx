"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { 
  CalendarDays, 
  Clock, 
  Edit3, 
  Link2, 
  Plus, 
  Users, 
  X, 
  Video, 
  VideoOff, 
  AlertCircle, 
  Check, 
  Calendar,
  ChevronRight,
  Info
} from "lucide-react";

import { cancelEvent, publishEvent, saveCreatorEvent, updateEventZoomUrl } from "@/app/events/actions";
import { AppShell } from "@/components/layout/AppShell";

export type CreatorEventRecord = {
  id: string; 
  title: string; 
  description: string | null; 
  hostName: string; 
  startsAt: string; 
  endsAt: string | null; 
  minTier: number;
  status: "draft" | "upcoming" | "live" | "completed" | "cancelled"; 
  enrolled: boolean; 
  publishAt: string | null; 
  publishedAt: string | null;
  cancelledAt: string | null; 
  cancellationReason: string | null; 
  enrollmentCount: number; 
  qualifiedAudienceCount: number; 
  roomPublished: boolean;
  attendees: { id: string; name: string; enrolledAt: string }[];
};

const dateTime = new Intl.DateTimeFormat(undefined, { 
  weekday: "short", 
  month: "short", 
  day: "numeric", 
  hour: "numeric", 
  minute: "2-digit" 
});

const localInput = (value: string | null) => 
  value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";

const accessLabel = (tier: number) => tier === 5 ? "Masters" : `Tier ${tier}+`;

const duration = (event: CreatorEventRecord) => 
  event.endsAt ? `${Math.round((new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()) / 60_000)} min` : "Not set";

function useDialog(onClose: () => void) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { 
    const previous = document.activeElement as HTMLElement | null; 
    close.current?.focus(); 
    const key = (event: KeyboardEvent) => event.key === "Escape" && onClose(); 
    window.addEventListener("keydown", key); 
    return () => { 
      window.removeEventListener("keydown", key); 
      previous?.focus(); 
    }; 
  }, [onClose]);
  return close;
}

export function CreatorEventsView({ 
  events, 
  enrollmentAvailable, 
  currentTier, 
  isMaster, 
  memberName 
}: { 
  events: CreatorEventRecord[]; 
  enrollmentAvailable: boolean; 
  currentTier: number; 
  isMaster: boolean; 
  memberName?: string; 
}) {
  const router = useRouter(); 
  const pathname = usePathname(); 
  const params = useSearchParams();
  
  const [creating, setCreating] = useState(params.get("create") === "1"); 
  const [editing, setEditing] = useState<CreatorEventRecord | null>(null); 
  const [message, setMessage] = useState<string | null>(null); 
  const [pending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"all" | "drafts" | "scheduled" | "cancelled">("scheduled");

  // Sub-modal states
  const [publishingRoom, setPublishingRoom] = useState<CreatorEventRecord | null>(null);
  const [cancellingEvent, setCancellingEvent] = useState<CreatorEventRecord | null>(null);

  const selected = useMemo(() => events.find((event) => event.id === params.get("event")) ?? null, [events, params]);
  
  const setSelected = (event: CreatorEventRecord | null) => { 
    const next = new URLSearchParams(params); 
    if (event) next.set("event", event.id); 
    else next.delete("event"); 
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }); 
  };

  const submit = (formData: FormData, mode: "draft" | "publish" | "update") => startTransition(async () => {
    const result = mode === "publish" && editing 
      ? await publishEvent(editing.id, formData) 
      : await saveCreatorEvent(formData, editing?.id, mode === "publish" || (mode === "update" && Boolean(editing?.publishedAt)));
    
    setMessage(result.error ?? (mode === "draft" ? "Draft saved successfully." : "Event saved and members notified."));
    if (result.success) { 
      setCreating(false); 
      setEditing(null); 
      if (result.eventId) {
        setSelected(events.find((event) => event.id === result.eventId) ?? null); 
      }
    }
  });

  const handleCancelEvent = (event: CreatorEventRecord, reason: string) => startTransition(async () => { 
    const result = await cancelEvent(event.id, reason); 
    setMessage(result.error ?? "Event cancelled and members notified."); 
    if (result.success) {
      setCancellingEvent(null);
      setSelected(null); 
    }
  });

  const handleUpdateRoom = (event: CreatorEventRecord, url: string) => startTransition(async () => { 
    const result = await updateEventZoomUrl(event.id, url); 
    setMessage(result.error ?? "Room link published and members notified."); 
    if (result.success) {
      setPublishingRoom(null);
      // Update selected event locally if it's the one we just updated
      if (selected && selected.id === event.id) {
        setSelected({ ...selected, roomPublished: true });
      }
    }
  });

  // Event filtering by tab
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (activeTab === "all") return true;
      if (activeTab === "drafts") return event.status === "draft";
      if (activeTab === "scheduled") return event.status !== "draft" && event.status !== "cancelled";
      if (activeTab === "cancelled") return event.status === "cancelled";
      return true;
    });
  }, [events, activeTab]);

  const draftsCount = useMemo(() => events.filter(e => e.status === "draft").length, [events]);
  const scheduledCount = useMemo(() => events.filter(e => e.status !== "draft" && e.status !== "cancelled").length, [events]);
  const cancelledCount = useMemo(() => events.filter(e => e.status === "cancelled").length, [events]);

  return (
    <AppShell 
      active="Events" 
      title="Creator Events" 
      isMaster={isMaster} 
      currentTier={currentTier} 
      memberName={memberName} 
      routeBase="/creator"
    >
      <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8 space-y-8">
        {/* Page Header */}
        <header className="flex flex-col justify-between gap-6 border-b border-surgical-steel pb-6 md:flex-row md:items-end">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white">Live Session Calendar</h1>
            <p className="mt-2 max-w-lg font-body text-sm text-on-surface-variant">
              Draft, schedule, publish, and moderate Stoicverse live community events in one centralized workspace.
            </p>
          </div>
          <button 
            type="button" 
            onClick={() => { setEditing(null); setCreating(true); }} 
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary-container px-6 font-label text-xs font-bold uppercase tracking-wider text-on-primary-fixed hover:brightness-110 transition cursor-pointer"
          >
            <Plus size={16} /> 
            Create Event
          </button>
        </header>

        {/* Notices */}
        {!enrollmentAvailable && (
          <Notice text="Event enrollment is currently locked. Apply the events enrollment database migration to restore access." />
        )}
        {message && (
          <Notice text={message} onClose={() => setMessage(null)} />
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-surgical-steel pb-4">
          {(["scheduled", "drafts", "cancelled", "all"] as const).map((tab) => {
            const count = tab === "drafts" ? draftsCount : tab === "scheduled" ? scheduledCount : tab === "cancelled" ? cancelledCount : events.length;
            const label = tab === "scheduled" 
              ? "Scheduled" 
              : tab === "drafts" 
              ? "Drafts" 
              : tab === "cancelled" 
              ? "Cancelled" 
              : "All Sessions";

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 font-label text-xs uppercase tracking-wider transition cursor-pointer ${
                  activeTab === tab 
                    ? "bg-primary-container text-on-primary-fixed font-bold emerald-glow border border-primary-container" 
                    : "border border-transparent bg-transparent text-on-surface-variant hover:border-surgical-steel hover:text-white"
                }`}
              >
                <span>{label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === tab ? "bg-black/20 text-white" : "bg-surface-container-high text-fog-muted"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Events Table List */}
        <section className="space-y-4">
          {filteredEvents.length > 0 ? (
            <div className="overflow-hidden rounded border border-surgical-steel bg-surface-container-lowest">
              {/* Header Row (Desktop Only) */}
              <div className="hidden md:grid grid-cols-12 gap-4 border-b border-surgical-steel bg-surface-container-high/40 px-6 py-3.5 text-[11px] font-label uppercase tracking-wider text-fog-muted">
                <div className="col-span-2">Access Limit</div>
                <div className="col-span-4">Session & Host</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">RSVP Metrics</div>
                <div className="col-span-2 text-right">Room Link</div>
              </div>

              {/* Event Rows */}
              <div className="divide-y divide-surgical-steel">
                {filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => setSelected(event)}
                    className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center px-6 py-4 bg-monolith-surface/30 hover:bg-monolith-surface/75 hover:border-primary-container/20 border-l-2 border-l-transparent hover:border-l-primary-container transition cursor-pointer"
                  >
                    {/* Access Tier */}
                    <div className="md:col-span-2 flex items-center">
                      <AccessTierBadge tier={event.minTier} />
                    </div>

                    {/* Title and Date */}
                    <div className="md:col-span-4 space-y-1">
                      <h3 className="font-headline text-base font-bold text-white leading-tight">
                        {event.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-xs text-on-surface-variant">
                        <span className="text-white font-medium">
                          {dateTime.format(new Date(event.startsAt))}
                        </span>
                        <span className="text-fog-muted font-label">·</span>
                        <span className="text-fog-muted font-label">{duration(event)}</span>
                        <span className="text-fog-muted font-label">·</span>
                        <span className="text-fog-muted">By {event.hostName}</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="md:col-span-2 flex items-center">
                      <StatusBadge status={event.status} />
                    </div>

                    {/* RSVP Metrics */}
                    <div className="md:col-span-2 flex items-center">
                      <RsvpProgress enrolled={event.enrollmentCount} qualified={event.qualifiedAudienceCount} />
                    </div>

                    {/* Room Indicator & Trailing Arrow */}
                    <div className="md:col-span-2 flex items-center justify-between gap-4 md:justify-end">
                      <ZoomRoomStatus published={event.roomPublished} />
                      <ChevronRight size={16} className="text-fog-muted hidden md:block" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded border border-dashed border-surgical-steel bg-surface-container-low/10 py-16 text-center">
              <Calendar size={48} className="mx-auto mb-4 text-fog-muted opacity-60" />
              <p className="font-headline text-lg font-semibold text-white">No sessions found</p>
              <p className="mt-1 font-body text-sm text-on-surface-variant max-w-sm mx-auto">
                {activeTab === "all" 
                  ? "Get started by creating your first community event." 
                  : `There are no sessions currently in the ${activeTab} category.`}
              </p>
              {(activeTab === "all" || activeTab === "drafts" || activeTab === "scheduled") && (
                <button
                  onClick={() => { setEditing(null); setCreating(true); }}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-surgical-steel px-4 py-2 font-label text-xs uppercase tracking-wider text-white hover:border-primary-container transition cursor-pointer"
                >
                  <Plus size={14} /> Create Event
                </button>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Create / Edit Modal */}
      {(creating || editing) && (
        <EventEditor 
          event={editing} 
          pending={pending} 
          onClose={() => { setCreating(false); setEditing(null); }} 
          onSubmit={submit} 
        />
      )}

      {/* Details Modal */}
      {selected && (
        <EventDetails 
          event={selected} 
          pending={pending} 
          onClose={() => setSelected(null)} 
          onEdit={() => { setEditing(selected); setSelected(null); }} 
          onPublishRoom={() => setPublishingRoom(selected)}
          onCancelEvent={() => setCancellingEvent(selected)}
        />
      )}

      {/* Sub-modal: Publish Zoom URL */}
      {publishingRoom && (
        <PublishRoomModal
          event={publishingRoom}
          pending={pending}
          onClose={() => setPublishingRoom(null)}
          onPublish={(url) => handleUpdateRoom(publishingRoom, url)}
        />
      )}

      {/* Sub-modal: Cancellation Reason */}
      {cancellingEvent && (
        <CancelEventModal
          event={cancellingEvent}
          pending={pending}
          onClose={() => setCancellingEvent(null)}
          onConfirm={(reason) => handleCancelEvent(cancellingEvent, reason)}
        />
      )}
    </AppShell>
  );
}

/* ----------------- Sub-Components ----------------- */

function StatusBadge({ status }: { status: CreatorEventRecord["status"] }) {
  const styles = {
    draft: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
    upcoming: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    live: "bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse",
    completed: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    cancelled: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  };
  const labels = {
    draft: "Draft",
    upcoming: "Upcoming",
    live: "Live Now",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold font-label ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function AccessTierBadge({ tier }: { tier: number }) {
  const label = tier === 5 ? "Masters" : `Tier ${tier}+`;
  const styles = tier === 5 
    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
    : "bg-primary-container/10 text-primary-container border border-primary-container/20";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold font-label uppercase tracking-wider ${styles}`}>
      {label}
    </span>
  );
}

function RsvpProgress({ enrolled, qualified }: { enrolled: number; qualified: number }) {
  const rate = qualified ? Math.round((enrolled / qualified) * 100) : 0;
  return (
    <div className="space-y-1 w-full max-w-[130px]">
      <div className="flex justify-between text-[11px] font-label text-fog-muted">
        <span>{enrolled} / {qualified} Enrolled</span>
        <span className="text-white font-medium">{rate}%</span>
      </div>
      <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
        <div 
          className="h-full bg-primary-container rounded-full" 
          style={{ width: `${Math.min(rate, 100)}%` }} 
        />
      </div>
    </div>
  );
}

function ZoomRoomStatus({ published }: { published: boolean }) {
  if (published) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-primary-container font-label">
        <Video size={14} className="stroke-[2.5]" />
        <span>Room Ready</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs text-fog-muted font-label">
      <VideoOff size={14} />
      <span>Missing URL</span>
    </div>
  );
}

function Notice({ text, onClose }: { text: string; onClose?: () => void }) { 
  return (
    <div role="status" className="flex items-start justify-between gap-4 border border-primary-container/30 bg-primary-container/5 px-4 py-3 rounded font-body text-sm text-on-surface">
      <div className="flex items-center gap-2">
        <Info size={16} className="text-primary-container shrink-0 mt-0.5" />
        <span>{text}</span>
      </div>
      {onClose && (
        <button 
          onClick={onClose}
          className="font-label text-xs uppercase tracking-wider text-primary-container hover:text-white transition cursor-pointer"
        >
          Dismiss
        </button>
      )}
    </div>
  ); 
}

/* ----------------- Event Editor Modal ----------------- */

function EventEditor({ 
  event, 
  pending, 
  onClose, 
  onSubmit 
}: { 
  event: CreatorEventRecord | null; 
  pending: boolean; 
  onClose: () => void; 
  onSubmit: (data: FormData, mode: "draft" | "publish" | "update") => void 
}) { 
  const [mode, setMode] = useState<"draft" | "publish" | "update">(event?.publishedAt ? "update" : "draft"); 
  const [dirty, setDirty] = useState(false); 
  const close = useDialog(() => { 
    if (!dirty || window.confirm("Discard unsaved event changes?")) onClose(); 
  }); 

  const inputClass = "h-10 w-full rounded border border-surgical-steel bg-surface-container-low/60 px-3 font-body text-sm text-white outline-none focus:border-primary-container transition placeholder:text-fog-muted"; 
  const labelClass = "block font-label text-xs uppercase tracking-wider text-fog-muted mb-1.5";

  return (
    <div 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="event-editor-title" 
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto" 
      onMouseDown={() => { if (!dirty || window.confirm("Discard unsaved event changes?")) onClose(); }}
    >
      <form 
        onSubmit={(e) => { 
          e.preventDefault(); 
          onSubmit(new FormData(e.currentTarget), mode); 
        }} 
        onChange={() => setDirty(true)} 
        onMouseDown={(e) => e.stopPropagation()} 
        className="my-8 w-full max-w-2xl rounded-lg border border-surgical-steel bg-surface-container-lowest shadow-2xl overflow-hidden animate-fade-in-up"
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b border-surgical-steel bg-surface-container-high/40 px-6 py-4">
          <div>
            <p className="font-label text-xs uppercase tracking-wider text-primary-container font-semibold">Event Control</p>
            <h2 id="event-editor-title" className="mt-1 font-display text-xl font-bold text-white">
              {event ? "Modify Event Details" : "Schedule New Event"}
            </h2>
          </div>
          <button 
            ref={close} 
            type="button" 
            onClick={onClose} 
            className="text-fog-muted hover:text-white transition cursor-pointer p-1 rounded hover:bg-surface-container-high"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h3 className="text-xs font-label uppercase tracking-widest text-primary-container/80 font-bold border-b border-surgical-steel/40 pb-1">
              General Information
            </h3>
            
            <div>
              <label htmlFor="title" className={labelClass}>Event Title</label>
              <input 
                id="title"
                className={inputClass} 
                name="title" 
                defaultValue={event?.title} 
                placeholder="e.g. Morning Meditation & Journaling"
                maxLength={160} 
                required 
              />
            </div>
            
            <div>
              <label htmlFor="description" className={labelClass}>Description</label>
              <textarea 
                id="description"
                className={`${inputClass} h-24 py-2 resize-none`} 
                name="description" 
                defaultValue={event?.description ?? ""} 
                placeholder="Detail the session's Stoic reading, exercises, and schedule..."
                rows={3} 
              />
            </div>
          </div>

          {/* Section 2: Host & Access */}
          <div className="space-y-4">
            <h3 className="text-xs font-label uppercase tracking-widest text-primary-container/80 font-bold border-b border-surgical-steel/40 pb-1">
              Host & Access Level
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="hostName" className={labelClass}>Host Name</label>
                <input 
                  id="hostName"
                  className={inputClass} 
                  name="hostName" 
                  defaultValue={event?.hostName ?? "Stoicverse Team"} 
                  placeholder="e.g. Marcus Aurelius"
                />
              </div>

              <div>
                <label htmlFor="minTier" className={labelClass}>Minimum Required Tier</label>
                <select 
                  id="minTier"
                  className={`${inputClass} cursor-pointer`} 
                  name="minTier" 
                  defaultValue={event?.minTier ?? 1}
                >
                  {[1, 2, 3, 4, 5].map((tier) => (
                    <option key={tier} value={tier} className="bg-surface-container-lowest">
                      {accessLabel(tier)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Timeline */}
          <div className="space-y-4">
            <h3 className="text-xs font-label uppercase tracking-widest text-primary-container/80 font-bold border-b border-surgical-steel/40 pb-1">
              Schedule Timeline
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="startsAt" className={labelClass}>Starts At</label>
                <input 
                  id="startsAt"
                  className={`${inputClass} cursor-pointer`}
                  type="datetime-local" 
                  name="startsAt" 
                  defaultValue={localInput(event?.startsAt ?? null)} 
                  required 
                />
              </div>

              <div>
                <label htmlFor="endsAt" className={labelClass}>Ends At</label>
                <input 
                  id="endsAt"
                  className={`${inputClass} cursor-pointer`}
                  type="datetime-local" 
                  name="endsAt" 
                  defaultValue={localInput(event?.endsAt ?? null)} 
                  required 
                />
              </div>
            </div>
          </div>

          {/* Section 4: Settings (Optional) */}
          <div className="space-y-4">
            <h3 className="text-xs font-label uppercase tracking-widest text-primary-container/80 font-bold border-b border-surgical-steel/40 pb-1">
              Delivery Settings (Optional)
            </h3>

            <div className="space-y-4">
              <div>
                <label htmlFor="publishAt" className={labelClass}>
                  Intended Publish Time <span className="text-fog-muted font-normal lowercase italic">(manual reminder only)</span>
                </label>
                <input 
                  id="publishAt"
                  className={`${inputClass} cursor-pointer`}
                  type="datetime-local" 
                  name="publishAt" 
                  defaultValue={localInput(event?.publishAt ?? null)} 
                />
              </div>

              <div>
                <label htmlFor="zoomUrl" className={labelClass}>Zoom Meeting URL</label>
                <input 
                  id="zoomUrl"
                  className={inputClass} 
                  type="url" 
                  name="zoomUrl" 
                  placeholder="https://zoom.us/j/..." 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surgical-steel px-6 py-4 bg-surface-container-high/20">
          <button 
            type="button" 
            onClick={onClose} 
            className="min-h-10 px-4 font-label text-xs uppercase tracking-wider text-fog-muted hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>
          
          <div className="flex gap-3">
            {/* Save Draft Option (Only for non-published events) */}
            {!event?.publishedAt && (
              <button 
                type="submit" 
                disabled={pending} 
                onClick={() => setMode("draft")} 
                className="min-h-10 px-5 font-label text-xs uppercase tracking-wider text-primary-container border border-primary-container/30 hover:border-primary-container rounded hover:bg-primary-container/5 transition disabled:opacity-60 cursor-pointer"
              >
                Save Draft
              </button>
            )}
            
            <button 
              type="submit" 
              disabled={pending} 
              onClick={() => setMode(event?.publishedAt ? "update" : "publish")} 
              className="min-h-10 rounded-full bg-primary-container px-6 font-label text-xs font-bold uppercase tracking-wider text-on-primary-fixed hover:brightness-110 transition disabled:opacity-60 cursor-pointer"
            >
              {pending ? "Saving…" : event?.publishedAt ? "Save Changes" : "Publish Event"}
            </button>
          </div>
        </div>
      </form>
    </div>
  ); 
}

/* ----------------- Event Details Modal ----------------- */

function EventDetails({ 
  event, 
  pending, 
  onClose, 
  onEdit, 
  onPublishRoom,
  onCancelEvent
}: { 
  event: CreatorEventRecord; 
  pending: boolean; 
  onClose: () => void; 
  onEdit: () => void; 
  onPublishRoom: () => void;
  onCancelEvent: () => void;
}) { 
  const close = useDialog(onClose); 
  const rate = event.qualifiedAudienceCount 
    ? Math.round(event.enrollmentCount / event.qualifiedAudienceCount * 100) 
    : 0; 
  
  return (
    <div 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="event-details-title" 
      className="fixed inset-0 z-50 grid place-items-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto" 
      onMouseDown={onClose}
    >
      <div 
        onMouseDown={(e) => e.stopPropagation()} 
        className="w-full max-w-4xl rounded-lg border border-surgical-steel bg-surface-container-lowest shadow-2xl overflow-hidden animate-fade-in-up my-8"
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-surgical-steel bg-surface-container-high/40 px-6 py-4">
          <div>
            <p className="font-label text-xs uppercase tracking-wider text-primary-container font-semibold">Event Details</p>
            <h2 id="event-details-title" className="mt-1 font-display text-xl font-bold text-white">
              {event.title}
            </h2>
          </div>
          <button 
            ref={close} 
            onClick={onClose} 
            className="text-fog-muted hover:text-white transition cursor-pointer p-1 rounded hover:bg-surface-container-high"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="grid gap-8 p-6 md:grid-cols-5 max-h-[65vh] overflow-y-auto">
          {/* Main Info */}
          <div className="md:col-span-3 space-y-6">
            <div>
              <h3 className="text-xs font-label uppercase tracking-widest text-primary-container/85 font-bold mb-2">Description</h3>
              <p className="font-body text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">
                {event.description || "No description provided."}
              </p>
            </div>

            <div className="border-t border-surgical-steel/50 pt-6">
              <h3 className="text-xs font-label uppercase tracking-widest text-primary-container/85 font-bold mb-3">Schedule Info</h3>
              <dl className="grid grid-cols-2 gap-4 text-sm font-body">
                <div>
                  <dt className="text-fog-muted font-label text-xs uppercase tracking-wider mb-0.5">When</dt>
                  <dd className="text-white font-medium">{dateTime.format(new Date(event.startsAt))}</dd>
                </div>
                <div>
                  <dt className="text-fog-muted font-label text-xs uppercase tracking-wider mb-0.5">Duration</dt>
                  <dd className="text-white font-medium">{duration(event)}</dd>
                </div>
                <div>
                  <dt className="text-fog-muted font-label text-xs uppercase tracking-wider mb-0.5">Access Level</dt>
                  <dd className="text-white font-medium">{accessLabel(event.minTier)}</dd>
                </div>
                <div>
                  <dt className="text-fog-muted font-label text-xs uppercase tracking-wider mb-0.5">Zoom Room</dt>
                  <dd className="text-white font-medium">
                    {event.roomPublished ? "Published & Active" : "Missing Meeting URL"}
                  </dd>
                </div>
                {event.cancellationReason && (
                  <div className="col-span-2 bg-rose-500/5 border border-rose-500/20 rounded p-3 mt-2">
                    <dt className="text-rose-400 font-label text-xs uppercase tracking-wider mb-1">Cancellation Reason</dt>
                    <dd className="text-rose-200 text-xs italic">"{event.cancellationReason}"</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Metrics & Attendees */}
          <div className="md:col-span-2 border-t border-surgical-steel/60 pt-6 md:border-t-0 md:border-l md:border-surgical-steel/60 md:pt-0 md:pl-6 space-y-6">
            <div>
              <h3 className="text-xs font-label uppercase tracking-widest text-primary-container/85 font-bold mb-3">RSVP Performance</h3>
              <div className="grid grid-cols-3 gap-2">
                <Metric value={String(event.enrollmentCount)} label="Enrolled" />
                <Metric value={String(event.qualifiedAudienceCount)} label="Qualified" />
                <Metric value={`${rate}%`} label="RSVP Rate" />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-label uppercase tracking-widest text-primary-container/85 font-bold mb-2">Members Registered</h3>
              <div className="rounded border border-surgical-steel bg-surface-container-high/20 overflow-hidden">
                <ul className="divide-y divide-surgical-steel/40 max-h-48 overflow-y-auto text-xs font-body">
                  {event.attendees.length ? (
                    event.attendees.map((attendee) => (
                      <li key={attendee.id} className="flex justify-between items-center p-3 hover:bg-surface-container-high/40">
                        <span className="text-white font-medium">{attendee.name}</span>
                        <span className="text-fog-muted font-label text-[10px]">
                          {dateTime.format(new Date(attendee.enrolledAt))}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="text-fog-muted p-4 text-center">No enrollments recorded yet.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer: The 3 redesigned buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-surgical-steel px-6 py-4 bg-surface-container-high/20">
          <button 
            onClick={onClose} 
            className="min-h-10 px-4 font-label text-xs uppercase tracking-wider text-fog-muted hover:text-white transition cursor-pointer"
          >
            Close
          </button>
          
          {event.status !== "cancelled" ? (
            <div className="flex flex-wrap gap-2.5">
              {/* Button 3: Cancel Event */}
              <button 
                onClick={onCancelEvent} 
                className="inline-flex min-h-10 items-center justify-center gap-1.5 border border-rose-500/30 hover:border-rose-500 hover:bg-rose-500/5 text-rose-400 hover:text-rose-300 font-label text-xs uppercase tracking-wider rounded-md px-4 transition cursor-pointer"
              >
                Cancel Event
              </button>

              {/* Button 2: Publish Room URL */}
              <button 
                onClick={onPublishRoom} 
                className="inline-flex min-h-10 items-center justify-center gap-1.5 border border-primary-container/30 hover:border-primary-container hover:bg-primary-container/5 text-primary-container font-label text-xs uppercase tracking-wider rounded-md px-4 transition cursor-pointer"
              >
                <Link2 size={14} />
                Publish Link
              </button>

              {/* Button 1: Edit Event */}
              <button 
                onClick={onEdit} 
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-primary-container px-5 font-label text-xs font-semibold uppercase tracking-wider text-on-primary-fixed hover:brightness-110 transition cursor-pointer"
              >
                <Edit3 size={14} />
                Edit Event
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-rose-400 font-label text-xs uppercase tracking-wider">
              <AlertCircle size={15} />
              <span>Event is Cancelled</span>
            </div>
          )}
        </div>
      </div>
    </div>
  ); 
}

function Metric({ value, label }: { value: string; label: string }) { 
  return (
    <div className="border border-surgical-steel bg-surface-container-high/15 p-3 text-center rounded">
      <p className="font-display text-lg font-bold text-white">{value}</p>
      <p className="font-label text-[9px] uppercase tracking-wider text-fog-muted mt-1 leading-none">{label}</p>
    </div>
  ); 
}

/* ----------------- Sub-modal: Publish Room URL ----------------- */

function PublishRoomModal({
  event,
  pending,
  onClose,
  onPublish
}: {
  event: CreatorEventRecord;
  pending: boolean;
  onClose: () => void;
  onPublish: (url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[60] grid place-items-center bg-black/85 backdrop-blur-sm p-4"
      onMouseDown={onClose}
    >
      <div 
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-surgical-steel bg-surface-container-lowest shadow-2xl overflow-hidden animate-fade-in-up"
      >
        <div className="flex justify-between items-center border-b border-surgical-steel bg-surface-container-high/40 px-5 py-3.5">
          <div>
            <p className="font-label text-[10px] uppercase tracking-wider text-primary-container font-semibold">Delivery Access</p>
            <h3 className="font-headline text-base font-bold text-white">Publish Room Link</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-fog-muted hover:text-white transition cursor-pointer p-1 rounded hover:bg-surface-container-high"
          >
            <X size={16} />
          </button>
        </div>

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            onPublish(url);
          }}
          className="p-5 space-y-4"
        >
          <div className="space-y-1">
            <p className="text-xs text-on-surface-variant font-body leading-relaxed">
              Enter the live meeting link for <strong className="text-white">"{event.title}"</strong>. Members will be notified and can join directly when the session opens.
            </p>
          </div>

          <div>
            <label htmlFor="roomUrl" className="block font-label text-xs uppercase tracking-wider text-fog-muted mb-1.5">
              Zoom Meeting URL
            </label>
            <input
              id="roomUrl"
              ref={inputRef}
              className="h-10 w-full rounded border border-surgical-steel bg-surface-container-low/60 px-3 font-body text-sm text-white outline-none focus:border-primary-container transition placeholder:text-fog-muted"
              type="url"
              placeholder="https://zoom.us/j/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            <p className="text-[10px] font-label text-fog-muted mt-1">
              Note: Link must use a secure HTTPS Zoom domain.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-surgical-steel/40">
            <button
              type="button"
              onClick={onClose}
              className="min-h-9 px-3 font-label text-xs uppercase tracking-wider text-fog-muted hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="min-h-9 rounded bg-primary-container px-4 font-label text-xs font-bold uppercase tracking-wider text-on-primary-fixed hover:brightness-110 transition disabled:opacity-60 cursor-pointer"
            >
              {pending ? "Publishing..." : "Publish Link"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ----------------- Sub-modal: Cancellation Reason ----------------- */

function CancelEventModal({
  event,
  pending,
  onClose,
  onConfirm
}: {
  event: CreatorEventRecord;
  pending: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[60] grid place-items-center bg-black/85 backdrop-blur-sm p-4"
      onMouseDown={onClose}
    >
      <div 
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-surgical-steel bg-surface-container-lowest shadow-2xl overflow-hidden animate-fade-in-up"
      >
        <div className="flex justify-between items-center border-b border-surgical-steel bg-surface-container-high/40 px-5 py-3.5">
          <div>
            <p className="font-label text-[10px] uppercase tracking-wider text-rose-400 font-semibold">Moderation</p>
            <h3 className="font-headline text-base font-bold text-white">Cancel Event</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-fog-muted hover:text-white transition cursor-pointer p-1 rounded hover:bg-surface-container-high"
          >
            <X size={16} />
          </button>
        </div>

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(reason);
          }}
          className="p-5 space-y-4"
        >
          <div className="space-y-1">
            <p className="text-xs text-on-surface-variant font-body leading-relaxed">
              Are you sure you want to cancel <strong className="text-white">"{event.title}"</strong>?
              Registered members will be notified immediately. This action cannot be reversed.
            </p>
          </div>

          <div>
            <label htmlFor="cancelReason" className="block font-label text-xs uppercase tracking-wider text-fog-muted mb-1.5">
              Cancellation Reason <span className="text-[10px] font-normal italic lowercase">(Optional)</span>
            </label>
            <textarea
              id="cancelReason"
              ref={textareaRef}
              className="w-full h-24 rounded border border-surgical-steel bg-surface-container-low/60 p-3 font-body text-sm text-white outline-none focus:border-primary-container transition placeholder:text-fog-muted resize-none"
              placeholder="Provide a cancellation message for the registered members..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-surgical-steel/40">
            <button
              type="button"
              onClick={onClose}
              className="min-h-9 px-3 font-label text-xs uppercase tracking-wider text-fog-muted hover:text-white transition cursor-pointer"
            >
              Keep Event
            </button>
            <button
              type="submit"
              disabled={pending}
              className="min-h-9 rounded bg-rose-600 px-4 font-label text-xs font-bold uppercase tracking-wider text-white hover:bg-rose-500 transition disabled:opacity-60 cursor-pointer"
            >
              {pending ? "Cancelling..." : "Confirm Cancellation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
