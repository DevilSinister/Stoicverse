"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Calendar, ChevronRight, Edit3, Info, Link2, Plus, Video, VideoOff } from "lucide-react";

import { cancelEvent, publishEvent, saveCreatorEvent, updateEventZoomUrl } from "@/app/events/actions";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  Overlay,
  OverlayBody,
  OverlayContent,
  OverlayFooter,
  OverlayHeader,
  OverlayTitle,
} from "@/components/ui/overlay";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";

/**
 * The creator's event workspace. Monolith, phase 11c.
 *
 * This one file held **four hand-rolled overlays, two `window.confirm` calls
 * and six stock colour families** — more off-system colour than the rest of the
 * product combined. The status chips were slate, emerald, red, blue and rose;
 * the access chip was amber; the RSVP track was `bg-slate-800` on
 * `border-slate-700/50`; the cancel button was `bg-rose-600`. None of those
 * exist in the design system, so the one screen where a creator judges "is this
 * live, is it cancelled, did anyone sign up" was the screen speaking a
 * different language from everywhere else.
 *
 * **The unsaved-changes guard was `window.confirm`, fired from a backdrop
 * `onMouseDown`.** A native modal raised from a pointer handler blocks the
 * event loop mid-gesture; it is `ui/confirm-dialog` now, opened from the
 * overlay's own dismiss path — which is the case `ui/overlay` was built to
 * stack, since Base UI portals in mount order.
 *
 * **`CancelEventModal` stopped being a modal.** It was a form whose only field
 * was an optional reason, wrapped in a hand-rolled dialog; it is a
 * `ConfirmDialog` with `tone="danger"` and the textarea as its children, which
 * is exactly the shape that component exists for.
 *
 * **The rows were `<div onClick>`.** The whole table was unreachable by
 * keyboard — the same defect phase 9 fixed on the member-facing event cards,
 * here in the screen the creator uses to run them.
 *
 * Also gone: `useDialog` (Escape and focus restore by hand, no trap and no
 * scroll lock), the last `emerald-glow` in the product,
 * `hover:text-accent-contrast` on the tabs, and a `bg-black/20` count chip.
 */

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

type Tab = "all" | "drafts" | "scheduled" | "cancelled";

const dateTime = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** `datetime-local` wants the wall clock, not an instant. */
const localInput = (value: string | null) =>
  value
    ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
    : "";

const accessLabel = (tier: number) => (tier === 5 ? "Masters" : `Tier ${tier}+`);

const duration = (event: CreatorEventRecord) =>
  event.endsAt
    ? `${Math.round((new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()) / 60_000)} min`
    : "Not set";

const STATUS: Record<CreatorEventRecord["status"], { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  upcoming: { label: "Upcoming", tone: "accent" },
  live: { label: "Live now", tone: "ok" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

const TABS: { id: Tab; label: string }[] = [
  { id: "scheduled", label: "Scheduled" },
  { id: "drafts", label: "Drafts" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All sessions" },
];

const matchesTab = (event: CreatorEventRecord, tab: Tab) =>
  tab === "all"
    ? true
    : tab === "drafts"
      ? event.status === "draft"
      : tab === "cancelled"
        ? event.status === "cancelled"
        : event.status !== "draft" && event.status !== "cancelled";

export function CreatorEventsView({
  events,
  enrollmentAvailable,
  currentTier,
  isMaster,
  memberName,
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
  const [activeTab, setActiveTab] = useState<Tab>("scheduled");
  const [publishingRoom, setPublishingRoom] = useState<CreatorEventRecord | null>(null);
  const [cancellingEvent, setCancellingEvent] = useState<CreatorEventRecord | null>(null);

  const selected = useMemo(
    () => events.find((event) => event.id === params.get("event")) ?? null,
    [events, params],
  );

  const setSelected = (event: CreatorEventRecord | null) => {
    const next = new URLSearchParams(params);
    if (event) next.set("event", event.id);
    else next.delete("event");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const submit = (formData: FormData, mode: "draft" | "publish" | "update") =>
    startTransition(async () => {
      const result =
        mode === "publish" && editing
          ? await publishEvent(editing.id, formData)
          : await saveCreatorEvent(
              formData,
              editing?.id,
              mode === "publish" || (mode === "update" && Boolean(editing?.publishedAt)),
            );

      setMessage(
        result.error ?? (mode === "draft" ? "Draft saved successfully." : "Event saved and members notified."),
      );

      if (result.success) {
        setCreating(false);
        setEditing(null);
        if (result.eventId) setSelected(events.find((event) => event.id === result.eventId) ?? null);
      }
    });

  const handleCancelEvent = (event: CreatorEventRecord, reason: string) =>
    startTransition(async () => {
      const result = await cancelEvent(event.id, reason);
      setMessage(result.error ?? "Event cancelled and members notified.");
      if (result.success) {
        setCancellingEvent(null);
        setSelected(null);
      }
    });

  const handleUpdateRoom = (event: CreatorEventRecord, url: string) =>
    startTransition(async () => {
      const result = await updateEventZoomUrl(event.id, url);
      setMessage(result.error ?? "Room link published and members notified.");
      if (result.success) {
        setPublishingRoom(null);
        if (selected && selected.id === event.id) setSelected({ ...selected, roomPublished: true });
      }
    });

  const filteredEvents = useMemo(() => events.filter((event) => matchesTab(event, activeTab)), [events, activeTab]);

  const counts = useMemo(
    () => ({
      all: events.length,
      drafts: events.filter((event) => event.status === "draft").length,
      scheduled: events.filter((event) => event.status !== "draft" && event.status !== "cancelled").length,
      cancelled: events.filter((event) => event.status === "cancelled").length,
    }),
    [events],
  );

  const startCreating = () => {
    setEditing(null);
    setCreating(true);
  };

  return (
    <AppShell
      active="Events"
      title="Creator events"
      isMaster={isMaster}
      currentTier={currentTier}
      memberName={memberName}
      routeBase="/creator"
    >
      <main className="mx-auto w-full max-w-[1440px] space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <header className="flex flex-col justify-between gap-6 border-b border-border-hairline pb-7 md:flex-row md:items-end">
          <div>
            <p className="terminal-label text-text-faint">Live sessions</p>
            <h1 className="mt-3 text-title-lg font-medium text-text-strong">Session calendar</h1>
            <p className="mt-3 max-w-lg text-content-base text-text-default">
              Draft, schedule, publish and moderate Stoicverse live community events in one workspace.
            </p>
          </div>
          <Button onClick={startCreating}>
            <Plus size={15} />
            Create event
          </Button>
        </header>

        {!enrollmentAvailable && (
          <Notice text="Event enrollment is currently locked. Apply the events enrollment database migration to restore access." />
        )}
        {message && <Notice text={message} onClose={() => setMessage(null)} />}

        <div className="flex flex-wrap items-center gap-1 border-b border-border-hairline">
          {TABS.map((tab) => {
            const selectedTab = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={selectedTab ? "page" : undefined}
                className={`focus-ring relative inline-flex min-h-11 items-center gap-2 px-4 text-content-sm transition-colors ${
                  selectedTab ? "text-text-strong" : "text-text-muted hover:text-text-strong"
                }`}
              >
                {tab.label}
                <span className="font-mono text-mono-xs text-text-faint tabular-nums">{counts[tab.id]}</span>
                {selectedTab && <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 bg-primary" />}
              </button>
            );
          })}
        </div>

        <section className="space-y-4">
          {filteredEvents.length ? (
            <div className="overflow-hidden rounded-lg border border-border-hairline bg-surface-sunken">
              <div className="hidden grid-cols-12 gap-4 border-b border-border-hairline bg-surface-panel px-6 py-3 md:grid">
                <p className="terminal-label col-span-2 text-text-faint">Access limit</p>
                <p className="terminal-label col-span-4 text-text-faint">Session &amp; host</p>
                <p className="terminal-label col-span-2 text-text-faint">Status</p>
                <p className="terminal-label col-span-2 text-text-faint">RSVP metrics</p>
                <p className="terminal-label col-span-2 text-right text-text-faint">Room link</p>
              </div>

              <div className="divide-y divide-border-hairline">
                {filteredEvents.map((event) => (
                  <EventRow key={event.id} event={event} onOpen={() => setSelected(event)} />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border-hairline py-16 text-center">
              <Calendar size={40} className="mx-auto mb-4 text-text-faint" />
              <p className="text-title-sm font-medium text-text-strong">No sessions found</p>
              <p className="mx-auto mt-2 max-w-sm text-content-sm text-text-muted">
                {activeTab === "all"
                  ? "Get started by creating your first community event."
                  : `There are no sessions currently in the ${activeTab} category.`}
              </p>
              {activeTab !== "cancelled" && (
                <Button variant="outline" className="mt-4" onClick={startCreating}>
                  <Plus size={14} />
                  Create event
                </Button>
              )}
            </div>
          )}
        </section>
      </main>

      {(creating || editing) && (
        <EventEditor
          event={editing}
          pending={pending}
          error={message}
          onClose={() => {
            setCreating(false);
            setEditing(null);
            setMessage(null);
          }}
          onSubmit={submit}
        />
      )}

      {selected && (
        <EventDetails
          event={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setSelected(null);
          }}
          onPublishRoom={() => setPublishingRoom(selected)}
          onCancelEvent={() => setCancellingEvent(selected)}
        />
      )}

      {publishingRoom && (
        <PublishRoomModal
          event={publishingRoom}
          pending={pending}
          onClose={() => setPublishingRoom(null)}
          onPublish={(url) => handleUpdateRoom(publishingRoom, url)}
        />
      )}

      {cancellingEvent && (
        <CancelEventDialog
          event={cancellingEvent}
          pending={pending}
          onClose={() => setCancellingEvent(null)}
          onConfirm={(reason) => handleCancelEvent(cancellingEvent, reason)}
        />
      )}
    </AppShell>
  );
}

function EventRow({ event, onOpen }: { event: CreatorEventRecord; onOpen: () => void }) {
  return (
    <div className="relative grid grid-cols-1 items-center gap-4 px-6 py-4 transition-colors hover:bg-surface-raised md:grid-cols-12">
      <div className="flex items-center md:col-span-2">
        <StatusBadge tone={event.minTier === 5 ? "warn" : "accent"}>{accessLabel(event.minTier)}</StatusBadge>
      </div>

      <div className="space-y-1 md:col-span-4">
        <h3 className="text-title-sm font-medium text-text-strong">
          {/* Stretched over the row: the whole row stays clickable and the
              keyboard reaches what the mouse always could. */}
          <button type="button" onClick={onOpen} className="focus-ring text-left after:absolute after:inset-0">
            {event.title}
          </button>
        </h3>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-content-sm text-text-muted">
          <span className="font-mono text-text-default tabular-nums">{dateTime.format(new Date(event.startsAt))}</span>
          <span aria-hidden>·</span>
          <span>{duration(event)}</span>
          <span aria-hidden>·</span>
          <span>By {event.hostName}</span>
        </p>
      </div>

      <div className="flex items-center md:col-span-2">
        <StatusBadge tone={STATUS[event.status].tone}>{STATUS[event.status].label}</StatusBadge>
      </div>

      <div className="flex items-center md:col-span-2">
        <RsvpProgress enrolled={event.enrollmentCount} qualified={event.qualifiedAudienceCount} />
      </div>

      <div className="flex items-center justify-between gap-4 md:col-span-2 md:justify-end">
        <ZoomRoomStatus published={event.roomPublished} />
        <ChevronRight size={16} className="hidden text-text-faint md:block" />
      </div>
    </div>
  );
}

function RsvpProgress({ enrolled, qualified }: { enrolled: number; qualified: number }) {
  const rate = qualified ? Math.round((enrolled / qualified) * 100) : 0;
  return (
    <div className="w-full max-w-[130px] space-y-1">
      <div className="flex justify-between font-mono text-mono-xs text-text-muted tabular-nums">
        <span>
          {enrolled} / {qualified}
        </span>
        <span className="text-text-default">{rate}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-sm bg-surface-raised">
        <div className="h-full bg-primary" style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
    </div>
  );
}

function ZoomRoomStatus({ published }: { published: boolean }) {
  return published ? (
    <span className="inline-flex items-center gap-1.5 text-content-sm text-primary">
      <Video size={14} />
      Room ready
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-content-sm text-text-muted">
      <VideoOff size={14} />
      Missing URL
    </span>
  );
}

function Notice({ text, onClose }: { text: string; onClose?: () => void }) {
  return (
    <div
      role="status"
      className="flex items-start justify-between gap-4 rounded-lg border border-primary/30 bg-accent-soft px-4 py-3 text-content-sm text-text-default"
    >
      <span className="flex items-start gap-2">
        <Info size={16} className="mt-0.5 shrink-0 text-primary" />
        {text}
      </span>
      {onClose && (
        <Button variant="ghost" size="chrome" onClick={onClose}>
          Dismiss
        </Button>
      )}
    </div>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="terminal-label mb-1.5 block text-text-faint">
      {children}
    </label>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="terminal-label border-b border-border-hairline pb-1 text-text-faint">{title}</h3>
      {children}
    </div>
  );
}

function EventEditor({
  event,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  event: CreatorEventRecord | null;
  pending: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (data: FormData, mode: "draft" | "publish" | "update") => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  /* The unsaved-changes guard. It used to be `window.confirm` raised from the
     backdrop's own mousedown handler, which blocks the event loop in the middle
     of a gesture. Base UI portals in mount order, so this dialog paints above
     the editor that opened it. */
  const requestClose = () => {
    if (dirty) setConfirmingDiscard(true);
    else onClose();
  };

  return (
    <>
      <Overlay
        open
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        <OverlayContent size="full" showCloseButton={false} className="sm:max-h-[88svh]">
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault();
              const submitter = (submitEvent.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
              const intent =
                (submitter?.value as "draft" | "publish" | "update") || (event?.publishedAt ? "update" : "draft");
              onSubmit(new FormData(submitEvent.currentTarget), intent);
            }}
            onChange={() => setDirty(true)}
          >
            <OverlayHeader>
              <p className="terminal-label text-text-faint">Event control</p>
              <OverlayTitle className="text-title-md">
                {event ? "Modify event details" : "Schedule new event"}
              </OverlayTitle>
            </OverlayHeader>

            <OverlayBody className="space-y-6">
              {error && <Notice text={error} />}

              <FormSection title="General information">
                <div>
                  <FieldLabel htmlFor="title">Event title</FieldLabel>
                  <Input
                    id="title"
                    name="title"
                    defaultValue={event?.title}
                    placeholder="e.g. Morning meditation and journaling"
                    maxLength={160}
                    required
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={event?.description ?? ""}
                    placeholder="Detail the session's Stoic reading, exercises, and schedule…"
                    rows={3}
                  />
                </div>
              </FormSection>

              <FormSection title="Host and access level">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="hostName">Host name</FieldLabel>
                    <Input
                      id="hostName"
                      name="hostName"
                      defaultValue={event?.hostName ?? "Stoicverse Team"}
                      placeholder="e.g. Marcus Aurelius"
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="minTier">Minimum required tier</FieldLabel>
                    <select
                      id="minTier"
                      name="minTier"
                      defaultValue={event?.minTier ?? 1}
                      className="focus-ring h-11 w-full rounded-lg border border-border-hairline bg-surface-sunken px-3 text-content-sm text-text-default"
                    >
                      {[1, 2, 3, 4, 5].map((tier) => (
                        <option key={tier} value={tier}>
                          {accessLabel(tier)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </FormSection>

              <FormSection title="Schedule timeline">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="startsAt">Starts at</FieldLabel>
                    <Input
                      id="startsAt"
                      type="datetime-local"
                      name="startsAt"
                      defaultValue={localInput(event?.startsAt ?? null)}
                      required
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="endsAt">Ends at</FieldLabel>
                    <Input
                      id="endsAt"
                      type="datetime-local"
                      name="endsAt"
                      defaultValue={localInput(event?.endsAt ?? null)}
                      required
                    />
                  </div>
                </div>
              </FormSection>

              <FormSection title="Delivery settings (optional)">
                <div>
                  <FieldLabel htmlFor="publishAt">Intended publish time — a manual reminder only</FieldLabel>
                  <Input
                    id="publishAt"
                    type="datetime-local"
                    name="publishAt"
                    defaultValue={localInput(event?.publishAt ?? null)}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="zoomUrl">Zoom meeting URL</FieldLabel>
                  <Input id="zoomUrl" type="url" name="zoomUrl" placeholder="https://zoom.us/j/…" />
                </div>
              </FormSection>
            </OverlayBody>

            <OverlayFooter className="sm:justify-between">
              <Button type="button" variant="ghost" onClick={requestClose}>
                Cancel
              </Button>
              <div className="flex gap-3">
                {!event?.publishedAt && (
                  <Button type="submit" name="intent" value="draft" variant="outline" disabled={pending}>
                    Save draft
                  </Button>
                )}
                <Button type="submit" name="intent" value={event?.publishedAt ? "update" : "publish"} disabled={pending}>
                  {pending ? "Saving…" : event?.publishedAt ? "Save changes" : "Publish event"}
                </Button>
              </div>
            </OverlayFooter>
          </form>
        </OverlayContent>
      </Overlay>

      <ConfirmDialog
        open={confirmingDiscard}
        onOpenChange={setConfirmingDiscard}
        title="Discard unsaved event changes?"
        description="The edits made since this event was opened will be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={() => {
          setConfirmingDiscard(false);
          onClose();
        }}
      />
    </>
  );
}

function EventDetails({
  event,
  onClose,
  onEdit,
  onPublishRoom,
  onCancelEvent,
}: {
  event: CreatorEventRecord;
  onClose: () => void;
  onEdit: () => void;
  onPublishRoom: () => void;
  onCancelEvent: () => void;
}) {
  const rate = event.qualifiedAudienceCount
    ? Math.round((event.enrollmentCount / event.qualifiedAudienceCount) * 100)
    : 0;

  const schedule: [string, string][] = [
    ["When", dateTime.format(new Date(event.startsAt))],
    ["Duration", duration(event)],
    ["Access level", accessLabel(event.minTier)],
    ["Zoom room", event.roomPublished ? "Published and active" : "Missing meeting URL"],
  ];

  return (
    <Overlay
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <OverlayContent size="full" className="sm:max-h-[88svh]">
        <OverlayHeader>
          <p className="terminal-label text-text-faint">Event details</p>
          <OverlayTitle className="text-title-md">{event.title}</OverlayTitle>
        </OverlayHeader>

        <OverlayBody>
          <div className="grid gap-8 md:grid-cols-5">
            <div className="space-y-6 md:col-span-3">
              <div>
                <h3 className="terminal-label mb-2 text-text-faint">Description</h3>
                <p className="text-content-sm whitespace-pre-line text-text-default">
                  {event.description || "No description provided."}
                </p>
              </div>

              <div className="border-t border-border-hairline pt-6">
                <h3 className="terminal-label mb-3 text-text-faint">Schedule info</h3>
                <dl className="grid grid-cols-2 gap-4">
                  {schedule.map(([label, value]) => (
                    <div key={label}>
                      <dt className="terminal-label mb-0.5 text-text-faint">{label}</dt>
                      <dd className="text-content-sm text-text-default">{value}</dd>
                    </div>
                  ))}
                  {event.cancellationReason && (
                    <div className="col-span-2 rounded-lg border border-status-danger/40 bg-status-danger/10 p-3">
                      <dt className="terminal-label mb-1 text-status-danger">Cancellation reason</dt>
                      <dd className="text-content-sm text-text-default">&ldquo;{event.cancellationReason}&rdquo;</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            <div className="space-y-6 border-t border-border-hairline pt-6 md:col-span-2 md:border-t-0 md:border-l md:pt-0 md:pl-6">
              <div>
                <h3 className="terminal-label mb-3 text-text-faint">RSVP performance</h3>
                <div className="grid grid-cols-3 gap-2">
                  <Metric value={String(event.enrollmentCount)} label="Enrolled" />
                  <Metric value={String(event.qualifiedAudienceCount)} label="Qualified" />
                  <Metric value={`${rate}%`} label="RSVP rate" />
                </div>
              </div>

              <div>
                <h3 className="terminal-label mb-2 text-text-faint">Members registered</h3>
                <div className="overflow-hidden rounded-lg border border-border-hairline">
                  <ul className="max-h-48 divide-y divide-border-hairline overflow-y-auto">
                    {event.attendees.length ? (
                      event.attendees.map((attendee) => (
                        <li key={attendee.id} className="flex items-center justify-between gap-3 p-3">
                          <span className="text-content-sm text-text-strong">{attendee.name}</span>
                          <span className="font-mono text-mono-xs text-text-muted tabular-nums">
                            {dateTime.format(new Date(attendee.enrolledAt))}
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="p-4 text-center text-content-sm text-text-muted">No enrollments recorded yet.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </OverlayBody>

        <OverlayFooter className="sm:justify-between">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>

          {event.status !== "cancelled" ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" onClick={onCancelEvent}>
                Cancel event
              </Button>
              <Button variant="outline" onClick={onPublishRoom}>
                <Link2 size={14} />
                Publish link
              </Button>
              <Button onClick={onEdit}>
                <Edit3 size={14} />
                Edit event
              </Button>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-content-sm text-status-danger">
              <AlertCircle size={15} />
              This event is cancelled
            </p>
          )}
        </OverlayFooter>
      </OverlayContent>
    </Overlay>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-border-hairline p-3 text-center">
      <p className="font-mono text-title-sm text-text-strong tabular-nums">{value}</p>
      <p className="terminal-label mt-1 text-text-faint">{label}</p>
    </div>
  );
}

function PublishRoomModal({
  event,
  pending,
  onClose,
  onPublish,
}: {
  event: CreatorEventRecord;
  pending: boolean;
  onClose: () => void;
  onPublish: (url: string) => void;
}) {
  const [url, setUrl] = useState("");

  return (
    <Overlay
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <OverlayContent size="sm" showCloseButton={false}>
        <form
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            onPublish(url);
          }}
        >
          <OverlayHeader>
            <p className="terminal-label text-text-faint">Delivery access</p>
            <OverlayTitle>Publish room link</OverlayTitle>
          </OverlayHeader>

          <OverlayBody className="space-y-4">
            <p className="text-content-sm text-text-default">
              Enter the live meeting link for <strong className="font-medium text-text-strong">{event.title}</strong>.
              Members are notified and can join directly when the session opens.
            </p>
            <div>
              <FieldLabel htmlFor="roomUrl">Zoom meeting URL</FieldLabel>
              <Input
                id="roomUrl"
                autoFocus
                type="url"
                placeholder="https://zoom.us/j/…"
                value={url}
                onChange={(changeEvent) => setUrl(changeEvent.target.value)}
                required
              />
              <p className="mt-1 text-content-sm text-text-muted">The link must use a secure HTTPS Zoom domain.</p>
            </div>
          </OverlayBody>

          <OverlayFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Publishing…" : "Publish link"}
            </Button>
          </OverlayFooter>
        </form>
      </OverlayContent>
    </Overlay>
  );
}

function CancelEventDialog({
  event,
  pending,
  onClose,
  onConfirm,
}: {
  event: CreatorEventRecord;
  pending: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  /* This was a hand-rolled modal whose only field was an optional reason.
     `ui/confirm-dialog` is that shape: a question, a destructive answer, and
     room for one field. */
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Cancel this event?"
      description={
        <>
          Registered members are notified immediately that{" "}
          <strong className="font-medium text-text-strong">{event.title}</strong> will not take place. This cannot be
          reversed.
        </>
      }
      confirmLabel={pending ? "Cancelling…" : "Confirm cancellation"}
      cancelLabel="Keep event"
      tone="danger"
      busy={pending}
      onConfirm={() => onConfirm(reason)}
    >
      <div>
        <FieldLabel htmlFor="cancelReason">Cancellation reason — optional</FieldLabel>
        <Textarea
          id="cancelReason"
          autoFocus
          rows={3}
          placeholder="Provide a cancellation message for the registered members…"
          value={reason}
          onChange={(changeEvent) => setReason(changeEvent.target.value)}
        />
      </div>
    </ConfirmDialog>
  );
}
