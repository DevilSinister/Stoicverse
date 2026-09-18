"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";

/**
 * The lesson player. Monolith, phase 8.
 *
 * **The save-failure notice was `text-amber-300`** — Tailwind's default amber,
 * off-palette, where the system has `--status-warn` for exactly this. Same
 * class of thing as the `bg-red-500` unread badge Monolith already removed: a
 * stock colour reads as "nearly right" and is the one thing on the page not
 * drawn from the palette.
 *
 * **The video stage keeps its true black.** That is not an oversight and not a
 * surface token: letterbox bars around a video should be black, so the frame
 * does not glow a different near-black than the picture inside it.
 */

type PlaylistVideo = {
  id: string;
  title: string;
  durationSeconds: number;
  isOptional: boolean;
  isCompleted: boolean;
  isUnlocked: boolean;
};

const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export function LessonWorkspacePlayer({
  videoId,
  title,
  description,
  courseId,
  courseTitle,
  videos,
  initialProgress,
  routeBase = "",
}: {
  videoId: string;
  title: string;
  description?: string | null;
  courseId: string;
  courseTitle: string;
  videos: PlaylistVideo[];
  initialProgress: number;
  routeBase?: string;
}) {
  const player = useRef<HTMLVideoElement>(null);
  const lastPosition = useRef(0);
  const queuedSeconds = useRef(0);
  const [progress, setProgress] = useState(initialProgress);
  const [completedIds, setCompletedIds] = useState(
    () => new Set(videos.filter((video) => video.isCompleted).map((video) => video.id)),
  );
  const [error, setError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const queue = useMemo(
    () => videos.map((video) => ({ ...video, isCompleted: completedIds.has(video.id), isUnlocked: true })),
    [videos, completedIds],
  );
  const activeIndex = queue.findIndex((video) => video.id === videoId);
  const nextVideo = queue[activeIndex + 1];

  useEffect(() => {
    void fetch(`/api/courses/videos/${videoId}/video`, { method: "POST" });
  }, [videoId]);

  const saveProgress = useCallback(
    async (force = false) => {
      const seconds = Math.min(15, Math.floor(queuedSeconds.current));
      if (seconds < 1 || (!force && seconds < 12)) return;
      queuedSeconds.current -= seconds;
      try {
        const response = await fetch(`/api/courses/videos/${videoId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ elapsedSeconds: seconds }),
        });
        const body = (await response.json()) as {
          error?: string;
          progress?: { completion_percentage?: number; is_completed?: boolean };
        };
        if (!response.ok || body.progress?.completion_percentage === undefined) {
          throw new Error(body.error ?? "Progress could not be saved.");
        }
        setProgress(Number(body.progress.completion_percentage));
        if (body.progress.is_completed) setCompletedIds((current) => new Set(current).add(videoId));
        setError(null);
      } catch (cause) {
        queuedSeconds.current += seconds;
        setError(cause instanceof Error ? cause.message : "Progress could not be saved.");
      }
    },
    [videoId],
  );

  const syncBrowserDuration = useCallback(() => {
    lastPosition.current = player.current?.currentTime ?? 0;
    const durationSeconds = Math.round(player.current?.duration ?? 0);
    if (durationSeconds > 0 && durationSeconds <= 86_400) {
      void fetch(`/api/courses/videos/${videoId}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds }),
      });
    }
  }, [videoId]);

  return (
    <section className="grid gap-8 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-8">
        <div className="overflow-hidden rounded-lg border border-border-hairline bg-black">
          <div className="relative aspect-video bg-black">
            {sourceError ? (
              <div role="alert" className="absolute inset-0 grid place-items-center p-8 text-center">
                <div className="max-w-sm">
                  <p className="text-title-sm font-medium text-text-strong">Video unavailable</p>
                  <p className="mt-2 text-content-sm text-text-muted">{sourceError}</p>
                </div>
              </div>
            ) : (
              <video
                ref={player}
                className="h-full w-full"
                src={`/api/courses/videos/${encodeURIComponent(videoId)}/stream`}
                controls
                controlsList="nodownload noremoteplayback"
                playsInline
                preload="metadata"
                onLoadedMetadata={syncBrowserDuration}
                onTimeUpdate={() => {
                  const current = player.current?.currentTime ?? 0;
                  const elapsed = current - lastPosition.current;
                  lastPosition.current = current;
                  if (elapsed > 0 && elapsed <= 2) {
                    queuedSeconds.current += elapsed;
                    void saveProgress();
                  }
                }}
                onPause={() => void saveProgress(true)}
                onEnded={() => void saveProgress(true)}
                onError={() => setSourceError("We could not load this protected video. Please refresh and try again.")}
              >
                Your browser does not support protected playback.
              </video>
            )}
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="rounded-sm border border-border-hairline px-1.5 font-mono text-mono-xs text-text-muted uppercase">
              Course session
            </span>
            <span className="font-mono text-mono-xs text-primary uppercase">Watching now</span>
          </div>
          <h1 className="text-title-lg font-medium text-text-strong">{title}</h1>
          {description && <p className="mt-4 max-w-3xl text-content-base text-text-default">{description}</p>}

          <section className="mt-7 border-t border-border-hairline pt-6">
            <h2 className="terminal-label text-text-faint">Lesson resources</h2>
            <div className="mt-4 rounded-lg border border-border-hairline bg-surface-panel p-4 text-content-sm text-text-muted">
              Lesson materials will appear here when they are attached to this session.
            </div>
          </section>

          <section className="mt-7 border-t border-border-hairline pt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-title-sm font-medium text-text-strong">Video watch progress</h2>
              <span className="font-mono text-mono-sm text-primary tabular-nums">{progress.toFixed(0)}%</span>
            </div>
            <p className="mt-1 text-content-sm text-text-muted">Watch 80% of this video to mark the session complete.</p>
            <div
              className="mt-4 h-2 overflow-hidden rounded-sm bg-surface-sunken"
              role="progressbar"
              aria-label="Video watch progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            >
              <div
                className="h-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          </section>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-border-hairline py-4">
          <span className="terminal-label text-text-faint">Protected playback</span>
          {nextVideo ? (
            <Link
              href={`${routeBase}/courses/${courseId}/video/${nextVideo.id}`}
              className={buttonVariants()}
            >
              Next lesson
              <ArrowRight size={16} />
            </Link>
          ) : (
            <span className="terminal-label text-text-faint">Final lesson</span>
          )}
        </div>

        {/* `status-warn`, not Tailwind's amber: a save that failed is a warning
            the palette already has a colour for, and the retry is automatic. */}
        {error && (
          <p role="alert" className="mt-4 text-content-sm text-status-warn">
            {error}
          </p>
        )}
      </div>

      <aside className="lg:col-span-4">
        <div className="sticky top-24 rounded-lg border border-border-hairline bg-surface-panel p-6">
          <div className="mb-5 border-b border-border-hairline pb-5">
            <div className="flex items-center justify-between gap-3">
              <span className="terminal-label text-text-faint">Current module</span>
              <span className="font-mono text-mono-xs text-text-muted tabular-nums">{progress.toFixed(0)}% done</span>
            </div>
            <h2 className="mt-2 text-title-md font-medium text-balance text-text-strong">{courseTitle}</h2>
            <p className="mt-3 text-content-sm text-text-muted">
              {queue.length} lesson{queue.length === 1 ? "" : "s"} in this course
            </p>
          </div>
          <ol aria-label="All course lessons" className="max-h-[614px] space-y-1 overflow-y-auto pr-1">
            {queue.map((item, index) => (
              <QueueItem
                key={item.id}
                item={item}
                index={index}
                active={item.id === videoId}
                courseId={courseId}
                routeBase={routeBase}
              />
            ))}
          </ol>
        </div>
      </aside>
    </section>
  );
}

function QueueItem({
  item,
  index,
  active,
  courseId,
  routeBase,
}: {
  item: PlaylistVideo;
  index: number;
  active: boolean;
  courseId: string;
  routeBase: string;
}) {
  return (
    <li>
      <Link
        href={`${routeBase}/courses/${courseId}/video/${item.id}`}
        aria-current={active ? "page" : undefined}
        className={`focus-ring flex min-h-16 items-center gap-3 rounded-md border px-4 py-3 transition-colors ${
          active ? "border-primary/50 bg-surface-raised" : "border-transparent hover:bg-surface-raised"
        }`}
      >
        <span
          className={`grid size-7 shrink-0 place-items-center font-mono text-mono-xs tabular-nums ${
            active ? "text-primary" : item.isCompleted ? "text-status-ok" : "text-text-faint"
          }`}
        >
          {item.isCompleted ? <CheckCircle2 size={17} /> : active ? <Play size={15} fill="currentColor" /> : index + 1}
        </span>
        <span className="min-w-0">
          <span
            className={`block truncate text-content-sm ${active ? "font-medium text-text-strong" : "text-text-default"}`}
          >
            {index + 1}. {item.title}
          </span>
          <span className="mt-1 block font-mono text-mono-xs text-text-faint tabular-nums">
            {formatDuration(item.durationSeconds)}
            {active ? " · Watching" : item.isOptional ? " · Optional" : ""}
          </span>
        </span>
      </Link>
    </li>
  );
}
