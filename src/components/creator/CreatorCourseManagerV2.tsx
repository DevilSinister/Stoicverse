"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Edit,
  GripVertical,
  LoaderCircle,
  Plus,
  Trash2,
  Video,
} from "lucide-react";

import {
  addCourseVideo,
  createCourse,
  deleteCourse,
  deleteCourseVideo,
  finishCourse,
  reorderCourseVideos,
  updateCourse,
  updateCourseVideo,
  type ActionResult,
} from "@/app/courses/actions";
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
 * The course studio. Monolith, phase 11c — the last screen in the phase.
 *
 * **`CustomSelect` was a listbox no keyboard could operate.** A button, an
 * absolutely positioned list of buttons, a `fixed inset-0 z-40` click-catcher
 * behind it: no `role`, no arrow keys, no Escape, no typeahead. And because it
 * is not a form control, every value it held needed a hidden input shadowing
 * it. They are native `<select>` elements now, named directly, so three hidden
 * inputs and their mirror state went with them — the select *is* the value the
 * action reads.
 *
 * It also carried `hover:text-accent-contrast`, so each option went near-black
 * on a dark panel under the pointer. Ninth sighting of that family.
 *
 * **Four `Modal`s and two inline delete panels.** The shell was another
 * `fixed inset-0 z-50` with `onMouseDown` dismissal; the delete flows replaced
 * the whole form with a confirmation and rebuilt it afterwards, so cancelling a
 * delete lost every unsaved edit in the form behind it. Both are
 * `ui/confirm-dialog` stacked over the editor now, which is non-destructive.
 *
 * **Thirteen stock colour call sites**: red for errors and deletes, emerald and
 * amber for publish state, purple and blue for finished state. The status pairs
 * are `ui/status-badge` tones.
 *
 * Left alone deliberately: **video reordering is still drag-and-drop only.**
 * Giving it a keyboard path is a feature with its own decisions — where focus
 * goes, what announces the move — not part of a repaint. Recorded rather than
 * half-built.
 */

type ManagedVideo = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  duration_seconds: number;
  sort_order: number;
  is_optional: boolean;
  release_at: string | null;
  has_secure_asset: boolean;
};

export type ManagedCourse = {
  id: string;
  title: string;
  description: string | null;
  completion_tier: number | null;
  status: string;
  is_finished: boolean;
  finished_at: string | null;
  videos: ManagedVideo[];
};

type ModalKind = "create-course" | "edit-course" | "add-video" | "edit-video" | null;

const toLocalDatetimeLocal = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const SELECT_CLASS =
  "focus-ring h-11 w-full rounded-lg border border-border-hairline bg-surface-sunken px-3 text-content-sm text-text-default";

const publishTone = (status: string): StatusTone => (status === "published" ? "ok" : "warn");

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="terminal-label text-text-faint">{label}</span>
      {children}
    </label>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-center gap-2 rounded-lg border border-status-danger/40 bg-status-danger/10 p-3 text-content-sm text-status-danger"
    >
      <AlertCircle size={15} className="shrink-0" />
      {message}
    </p>
  );
}

export function CreatorCourseManagerV2({
  courses,
  memberName,
  currentTier,
  isMaster,
}: {
  courses: ManagedCourse[];
  memberName: string;
  currentTier: number;
  isMaster: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [videoList, setVideoList] = useState<ManagedVideo[]>([]);
  const [draggedVideoId, setDraggedVideoId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ModalKind>(null);
  const [editingVideo, setEditingVideo] = useState<ManagedVideo | null>(null);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);

  const openCourse = (course: ManagedCourse) => {
    setSelectedCourseId(course.id);
    setVideoList([...course.videos].sort((a, b) => a.sort_order - b.sort_order));
  };

  const closeCourse = () => {
    setSelectedCourseId(null);
    setVideoList([]);
    setDraggedVideoId(null);
  };

  const closeModal = () => {
    setActiveModal(null);
    setEditingVideo(null);
    setModalError(null);
  };

  const openModal = (kind: ModalKind) => {
    setModalError(null);
    setActiveModal(kind);
  };

  const runFormAction =
    (action: (data: FormData) => Promise<ActionResult>, onSuccess?: () => void) => (data: FormData) => {
      setModalError(null);
      startTransition(async () => {
        const result = await action(data);
        if (result.error) {
          setModalError(result.error);
          return;
        }
        setMessage("Saved successfully.");
        setActiveModal(null);
        setEditingVideo(null);
        onSuccess?.();
      });
    };

  const handleFinishCourse = (courseId: string) =>
    startTransition(async () => {
      setMessage(null);
      const result = await finishCourse(courseId);
      setMessage(result.error ?? "Course finalized and published.");
    });

  const handleDeleteCourse = (courseId: string) =>
    startTransition(async () => {
      setModalError(null);
      const result = await deleteCourse(courseId);
      if (result.error) {
        setModalError(result.error);
        return;
      }
      setMessage("Course deleted successfully.");
      closeModal();
      closeCourse();
    });

  const handleDeleteVideo = (videoId: string) =>
    startTransition(async () => {
      setModalError(null);
      const result = await deleteCourseVideo(videoId);
      if (result.error) {
        setModalError(result.error);
        return;
      }
      setMessage("Video deleted successfully.");
      closeModal();
    });

  const saveVideoOrder = (nextList: ManagedVideo[]) =>
    startTransition(async () => {
      const result = await reorderCourseVideos(nextList.map((video) => video.id));
      setMessage(result.error ?? "Video order updated successfully.");
    });

  const handleDrop = (dropEvent: React.DragEvent, targetVideoId: string) => {
    dropEvent.preventDefault();
    if (pending) return;

    const sourceVideoId = dropEvent.dataTransfer.getData("text/plain") || draggedVideoId;
    setDraggedVideoId(null);
    if (!sourceVideoId || sourceVideoId === targetVideoId) return;

    const sourceIndex = videoList.findIndex((video) => video.id === sourceVideoId);
    const targetIndex = videoList.findIndex((video) => video.id === targetVideoId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const nextList = [...videoList];
    const [moved] = nextList.splice(sourceIndex, 1);
    nextList.splice(targetIndex, 0, moved);
    setVideoList(nextList);
    saveVideoOrder(nextList);
  };

  return (
    <AppShell
      active="Learning"
      title="Course studio"
      memberName={memberName}
      platformRole="influencer"
      currentTier={currentTier}
      isMaster={isMaster}
      routeBase="/creator"
    >
      <main className="mx-auto w-full max-w-[1280px] space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        {message && (
          <div
            role="status"
            className="flex items-center justify-between gap-4 rounded-lg border border-primary/30 bg-accent-soft p-4 text-content-sm text-text-default"
          >
            <span className="flex items-center gap-2">
              <CheckCircle className="shrink-0 text-primary" size={16} />
              {message}
            </span>
            <Button variant="ghost" size="chrome" onClick={() => setMessage(null)}>
              Dismiss
            </Button>
          </div>
        )}

        {!selectedCourseId ? (
          <div className="space-y-8">
            <header className="flex flex-col gap-4 border-b border-border-hairline pb-7 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="terminal-label text-text-faint">Influencer curriculum</p>
                <h1 className="mt-3 text-title-lg font-medium text-text-strong">Create and release courses</h1>
                <p className="mt-3 max-w-2xl text-content-base text-text-default">
                  Configure access, release videos over time, and publish finished courses to the member curriculum.
                </p>
              </div>
              <Button onClick={() => openModal("create-course")}>
                <Plus size={15} />
                Create course
              </Button>
            </header>

            {courses.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-hairline py-20 text-center">
                <Video size={40} className="mx-auto mb-4 text-text-faint" />
                <h2 className="text-title-sm font-medium text-text-strong">No courses created yet</h2>
                <p className="mx-auto mt-2 max-w-md text-content-sm text-text-muted">
                  Get started by creating your first open-access member course.
                </p>
                <Button variant="outline" className="mt-6" onClick={() => openModal("create-course")}>
                  <Plus size={14} />
                  Add first course
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <CourseCard key={course.id} course={course} onOpen={() => openCourse(course)} />
                ))}
              </div>
            )}
          </div>
        ) : (
          selectedCourse && (
            <div className="space-y-8">
              <Button variant="ghost" size="chrome" onClick={closeCourse}>
                <ArrowLeft size={14} />
                Back to courses
              </Button>

              <article className="space-y-6 rounded-lg border border-border-hairline bg-surface-panel p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="accent">Open to all members</StatusBadge>
                    {selectedCourse.completion_tier && (
                      <StatusBadge tone="neutral">Achievement: Tier {selectedCourse.completion_tier}</StatusBadge>
                    )}
                    <StatusBadge tone={publishTone(selectedCourse.status)} className="capitalize">
                      {selectedCourse.status}
                    </StatusBadge>
                    <StatusBadge tone={selectedCourse.is_finished ? "neutral" : "warn"}>
                      {selectedCourse.is_finished ? "Finished and locked" : "In production"}
                    </StatusBadge>
                  </div>

                  {!selectedCourse.is_finished && (
                    <Button disabled={pending} onClick={() => handleFinishCourse(selectedCourse.id)}>
                      {pending ? <LoaderCircle size={14} className="animate-spin" /> : "Finish course"}
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  <h1 className="text-title-lg font-medium text-text-strong">{selectedCourse.title}</h1>
                  <p className="max-w-3xl text-content-base text-text-default">
                    {selectedCourse.description || "No description provided."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 border-t border-border-hairline pt-6">
                  <Button variant="outline" onClick={() => openModal("edit-course")}>
                    <Edit size={14} />
                    Edit course details
                  </Button>
                  <Button variant="outline" onClick={() => openModal("add-video")}>
                    <Plus size={14} />
                    Add video
                  </Button>
                </div>
              </article>

              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-border-hairline pb-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-title-sm font-medium text-text-strong">
                      <Video size={17} className="text-primary" />
                      Videos ({selectedCourse.videos.length})
                    </h2>
                    {selectedCourse.videos.length > 1 && (
                      <p className="mt-1 text-content-sm text-text-muted">Drag the grab handle to reorder videos.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {videoList.map((video, index) => (
                    <div
                      key={video.id}
                      draggable={!pending}
                      onDragStart={(dragEvent) => {
                        setDraggedVideoId(video.id);
                        dragEvent.dataTransfer.setData("text/plain", video.id);
                        dragEvent.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(dragEvent) => {
                        dragEvent.preventDefault();
                        dragEvent.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(dropEvent) => handleDrop(dropEvent, video.id)}
                      onDragEnd={() => setDraggedVideoId(null)}
                      className={`flex flex-col justify-between gap-4 rounded-lg border p-4 transition-colors sm:flex-row sm:items-center ${
                        draggedVideoId === video.id
                          ? "border-primary/50 bg-surface-raised opacity-40"
                          : "border-border-hairline bg-surface-panel"
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="shrink-0 cursor-grab p-1 text-text-faint active:cursor-grabbing">
                          <GripVertical size={16} />
                        </span>
                        <span className="shrink-0 pt-0.5 font-mono text-content-sm text-text-faint tabular-nums">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <div className="min-w-0 space-y-1">
                          <h3 className="flex flex-wrap items-center gap-2 text-content-base font-medium text-text-strong">
                            {video.title}
                            {video.is_optional && <StatusBadge tone="neutral">Optional</StatusBadge>}
                          </h3>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-mono-xs text-text-muted tabular-nums">
                            <span className="flex shrink-0 items-center gap-1">
                              <Clock size={12} />
                              {Math.round(video.duration_seconds / 60)} min ({video.duration_seconds}s)
                            </span>
                            <span>Order: {video.sort_order}</span>
                            {video.release_at && (
                              <span className="truncate">Releases: {new Date(video.release_at).toLocaleString()}</span>
                            )}
                          </div>
                          {!video.has_secure_asset && (
                            <p className="mt-2 text-content-sm text-status-warn">
                              Drive link missing — edit this video and paste its Google Drive link to restore playback.
                            </p>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="chrome"
                        className="self-end sm:self-center"
                        onClick={() => {
                          setEditingVideo(video);
                          openModal("edit-video");
                        }}
                      >
                        <Edit size={12} />
                        Edit video
                      </Button>
                    </div>
                  ))}

                  {videoList.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border-hairline py-16 text-center">
                      <Video size={32} className="mx-auto mb-3 text-text-faint" />
                      <p className="text-content-base font-medium text-text-strong">No videos added to this course</p>
                      <p className="mx-auto mt-1 max-w-xs text-content-sm text-text-muted">
                        Build out this course curriculum by uploading Google Drive videos.
                      </p>
                      <Button variant="outline" className="mt-4" onClick={() => openModal("add-video")}>
                        <Plus size={12} />
                        Add first video
                      </Button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )
        )}
      </main>

      {activeModal === "create-course" && (
        <StudioModal title="Create course" onClose={closeModal}>
          <CourseCreateForm
            action={runFormAction(createCourse)}
            pending={pending}
            modalError={modalError}
            onClose={closeModal}
          />
        </StudioModal>
      )}

      {activeModal === "edit-course" && selectedCourse && (
        <StudioModal title="Edit course details" onClose={closeModal}>
          <CourseEditForm
            course={selectedCourse}
            action={runFormAction(updateCourse)}
            pending={pending}
            modalError={modalError}
            onClose={closeModal}
            onDelete={handleDeleteCourse}
          />
        </StudioModal>
      )}

      {activeModal === "add-video" && selectedCourse && (
        <StudioModal title={`Add video to ${selectedCourse.title}`} onClose={closeModal}>
          <VideoAddForm
            courseId={selectedCourse.id}
            action={runFormAction(addCourseVideo)}
            pending={pending}
            modalError={modalError}
            onClose={closeModal}
          />
        </StudioModal>
      )}

      {activeModal === "edit-video" && editingVideo && (
        <StudioModal title="Edit video details" onClose={closeModal}>
          <VideoEditForm
            video={editingVideo}
            action={runFormAction(updateCourseVideo)}
            pending={pending}
            modalError={modalError}
            onClose={closeModal}
            onDelete={handleDeleteVideo}
          />
        </StudioModal>
      )}
    </AppShell>
  );
}

function CourseCard({ course, onOpen }: { course: ManagedCourse; onOpen: () => void }) {
  return (
    <article className="relative flex flex-col justify-between rounded-lg border border-border-hairline bg-surface-panel p-5 transition-colors hover:border-border-strong">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge tone="accent">Open access</StatusBadge>
          <div className="flex gap-2">
            <StatusBadge tone={publishTone(course.status)} className="capitalize">
              {course.status}
            </StatusBadge>
            <StatusBadge tone={course.is_finished ? "neutral" : "warn"}>
              {course.is_finished ? "Finished" : "Draft"}
            </StatusBadge>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="line-clamp-1 text-title-sm font-medium text-text-strong">
            {/* Stretched over the card, so the keyboard reaches what the mouse
                always could. This was an `<article onClick>`. */}
            <button type="button" onClick={onOpen} className="focus-ring text-left after:absolute after:inset-0">
              {course.title}
            </button>
          </h2>
          <p className="line-clamp-3 text-content-sm text-text-muted">
            {course.description || "No description provided."}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-border-hairline pt-4 text-content-sm text-text-muted">
        <span className="flex items-center gap-1.5">
          <Video size={13} className="text-primary" />
          {course.videos.length} {course.videos.length === 1 ? "video" : "videos"}
        </span>
        <span>All members</span>
      </div>
    </article>
  );
}

function StudioModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <Overlay
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <OverlayContent size="lg" className="sm:max-h-[90svh]">
        <OverlayHeader>
          <OverlayTitle>{title}</OverlayTitle>
        </OverlayHeader>
        {children}
      </OverlayContent>
    </Overlay>
  );
}

function TierSelect({ name, defaultValue }: { name: string; defaultValue: number }) {
  return (
    <Field label="Completion achievement">
      <select name={name} defaultValue={defaultValue} className={SELECT_CLASS}>
        {[1, 2, 3, 4, 5].map((tier) => (
          <option key={tier} value={tier}>
            Award Tier {tier}
          </option>
        ))}
      </select>
    </Field>
  );
}

function PublishStateSelect({
  name,
  defaultValue,
  includeArchived = false,
}: {
  name: string;
  defaultValue: string;
  includeArchived?: boolean;
}) {
  return (
    <Field label="Publish state">
      <select name={name} defaultValue={defaultValue} className={SELECT_CLASS}>
        <option value="draft">Draft</option>
        <option value="published">Published</option>
        {includeArchived && <option value="archived">Archived</option>}
      </select>
    </Field>
  );
}

/**
 * `isOptional` reaches the action as a checkbox would — `"on"` or nothing — so
 * these option values are those strings rather than a boolean this component
 * then has to translate through a hidden input.
 */
function RequirementSelect({ defaultValue }: { defaultValue: boolean }) {
  return (
    <Field label="Requirement">
      <select name="isOptional" defaultValue={defaultValue ? "on" : ""} className={SELECT_CLASS}>
        <option value="">Required</option>
        <option value="on">Optional</option>
      </select>
    </Field>
  );
}

function FormFooter({
  pending,
  onClose,
  submitLabel,
  onDelete,
  deleteLabel,
}: {
  pending: boolean;
  onClose: () => void;
  submitLabel: string;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  return (
    <OverlayFooter className={onDelete ? "sm:justify-between" : undefined}>
      {onDelete && (
        <Button type="button" variant="destructive" onClick={onDelete}>
          <Trash2 size={14} />
          {deleteLabel}
        </Button>
      )}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircle size={14} className="animate-spin" /> : submitLabel}
        </Button>
      </div>
    </OverlayFooter>
  );
}

function CourseCreateForm({
  action,
  pending,
  modalError,
  onClose,
}: {
  action: (data: FormData) => void;
  pending: boolean;
  modalError: string | null;
  onClose: () => void;
}) {
  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col">
      <OverlayBody className="space-y-4">
        <FormError message={modalError} />
        <Field label="Title">
          <Input name="title" placeholder="e.g. Introduction to Stoic ethics" required />
        </Field>
        <Field label="Description">
          <Textarea name="description" rows={4} placeholder="Summarise course milestones and learnings…" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <TierSelect name="rewardTier" defaultValue={2} />
          <PublishStateSelect name="status" defaultValue="draft" />
        </div>
      </OverlayBody>
      <FormFooter pending={pending} onClose={onClose} submitLabel="Create course" />
    </form>
  );
}

function CourseEditForm({
  course,
  action,
  pending,
  modalError,
  onClose,
  onDelete,
}: {
  course: ManagedCourse;
  action: (data: FormData) => void;
  pending: boolean;
  modalError: string | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <>
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <OverlayBody className="space-y-4">
          <FormError message={modalError} />
          <input type="hidden" name="courseId" value={course.id} />
          <Field label="Title">
            <Input name="title" defaultValue={course.title} required />
          </Field>
          <Field label="Description">
            <Textarea
              name="description"
              rows={4}
              defaultValue={course.description ?? ""}
              placeholder="Summarise course milestones and learnings…"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <TierSelect name="rewardTier" defaultValue={course.completion_tier || 2} />
            <PublishStateSelect name="status" defaultValue={course.status} includeArchived />
          </div>
        </OverlayBody>
        <FormFooter
          pending={pending}
          onClose={onClose}
          submitLabel="Save changes"
          onDelete={() => setConfirmingDelete(true)}
          deleteLabel="Delete course"
        />
      </form>

      {/* Stacked over the editor rather than replacing it: cancelling a delete
          used to rebuild the form and lose every unsaved edit behind it. */}
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete ${course.title}?`}
        description="This permanently deletes the course, its video settings, and related curriculum records."
        confirmLabel="Delete course"
        cancelLabel="Keep course"
        tone="danger"
        busy={pending}
        onConfirm={() => onDelete(course.id)}
      />
    </>
  );
}

function VideoAddForm({
  courseId,
  action,
  pending,
  modalError,
  onClose,
}: {
  courseId: string;
  action: (data: FormData) => void;
  pending: boolean;
  modalError: string | null;
  onClose: () => void;
}) {
  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col">
      <OverlayBody className="space-y-4">
        <FormError message={modalError} />
        <input type="hidden" name="courseId" value={courseId} />

        <Field label="Video title">
          <Input name="title" placeholder="e.g. Session 1: the dichotomy of control" required />
        </Field>

        <Field label="Google Drive link or file ID">
          <Input name="videoFileId" placeholder="Paste a Google Drive share link or file ID" required />
        </Field>

        <Field label="Description (optional)">
          <Textarea
            name="description"
            rows={3}
            placeholder="Add context for what members should focus on in this video…"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Field label="Duration in seconds">
              <Input type="number" min="1" name="durationSeconds" placeholder="Only needed if Drive cannot detect it" />
            </Field>
            <p className="mt-1 text-content-sm text-text-muted">
              Drive duration is detected automatically when available.
            </p>
          </div>
          <RequirementSelect defaultValue={false} />
          <Field label="Release at (optional)">
            <Input type="datetime-local" name="releaseAt" />
          </Field>
        </div>
      </OverlayBody>
      <FormFooter pending={pending} onClose={onClose} submitLabel="Add video" />
    </form>
  );
}

function VideoEditForm({
  video,
  action,
  pending,
  modalError,
  onClose,
  onDelete,
}: {
  video: ManagedVideo;
  action: (data: FormData) => void;
  pending: boolean;
  modalError: string | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <>
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <OverlayBody className="space-y-4">
          <FormError message={modalError} />
          <input type="hidden" name="videoId" value={video.id} />

          <Field label="Video title">
            <Input name="title" defaultValue={video.title} required />
          </Field>

          <div>
            <Field
              label={`Google Drive link ${video.has_secure_asset ? "(replacing is optional)" : "(required to repair)"}`}
            >
              <Input
                name="videoFileId"
                placeholder="Paste a Google Drive share link or file ID"
                required={!video.has_secure_asset}
              />
            </Field>
            <p className="mt-1 text-content-sm text-text-muted">
              When supplied, Stoicverse securely replaces the source and reads the real duration from Drive.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Duration (seconds)">
              <Input type="number" min="1" name="durationSeconds" defaultValue={video.duration_seconds} required />
            </Field>
            <Field label="Sort order">
              <Input type="number" min="0" name="sortOrder" defaultValue={video.sort_order} required />
            </Field>
            <RequirementSelect defaultValue={video.is_optional} />
          </div>

          <Field label="Release at (optional)">
            <Input type="datetime-local" name="releaseAt" defaultValue={toLocalDatetimeLocal(video.release_at)} />
          </Field>
        </OverlayBody>
        <FormFooter
          pending={pending}
          onClose={onClose}
          submitLabel="Save changes"
          onDelete={() => setConfirmingDelete(true)}
          deleteLabel="Delete video"
        />
      </form>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete ${video.title}?`}
        description="This permanently deletes the video and its secure access logs from the database."
        confirmLabel="Delete video"
        cancelLabel="Keep video"
        tone="danger"
        busy={pending}
        onConfirm={() => onDelete(video.id)}
      />
    </>
  );
}
