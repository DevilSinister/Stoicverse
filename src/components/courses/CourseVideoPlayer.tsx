"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, Clock3, ListVideo, LockKeyhole, Play, ShieldCheck } from "lucide-react";
import { useCallback, useRef, useState, useMemo } from "react";

type PlaylistVideo = {
  id: string;
  title: string;
  durationSeconds: number;
  isOptional: boolean;
  isCompleted: boolean;
  isUnlocked: boolean;
};

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function CourseVideoPlayer({
  videoId,
  title,
  courseId,
  courseTitle,
  videos,
  initialProgress,
  routeBase = "",
}: {
  videoId: string;
  title: string;
  courseId: string;
  courseTitle: string;
  videos: PlaylistVideo[];
  initialProgress: number;
  routeBase?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastPosition = useRef(0);
  const queuedSeconds = useRef(0);
  const [progress, setProgress] = useState(initialProgress);
  const [completedVideoIds, setCompletedVideoIds] = useState(() => new Set(videos.filter((video) => video.isCompleted).map((video) => video.id)));
  const [progressError, setProgressError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const queue = useMemo(() => {
    return videos.map((video, index) => {
      const isCompleted = completedVideoIds.has(video.id);
      // Unlocked if all previous required videos are completed
      const isUnlocked = videos.slice(0, index).every((prevVideo) => {
        return prevVideo.isOptional || completedVideoIds.has(prevVideo.id);
      });
      return { ...video, isCompleted, isUnlocked };
    });
  }, [videos, completedVideoIds]);
  const activeIndex = queue.findIndex((video) => video.id === videoId);
  const nextVideo = queue.slice(activeIndex + 1).find((video) => video.isUnlocked);

  const reportProgress = useCallback(async (force = false) => {
    const seconds = Math.min(15, Math.floor(queuedSeconds.current));
    if (seconds < 1 || (!force && seconds < 12)) return;
    queuedSeconds.current -= seconds;
    try {
      const response = await fetch(`/api/courses/videos/${videoId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elapsedSeconds: seconds }),
      });
      const body = await response.json() as { error?: string; progress?: { completion_percentage?: number; is_completed?: boolean } };
      if (response.ok && body.progress?.completion_percentage !== undefined) {
        setProgress(Number(body.progress.completion_percentage));
        if (body.progress.is_completed) setCompletedVideoIds((current) => new Set(current).add(videoId));
        setProgressError(null);
      } else {
        queuedSeconds.current += seconds;
        setProgressError(body.error ?? "Progress could not be saved. Please keep this page open and try again.");
      }
    } catch {
      queuedSeconds.current += seconds;
      setProgressError("Progress could not be saved. Please check your connection and keep watching.");
    }
  }, [videoId]);

  const handleTimeUpdate = () => {
    const current = videoRef.current?.currentTime ?? 0;
    const elapsed = current - lastPosition.current;
    lastPosition.current = current;
    // Seeking forward is not treated as watched time.
    if (elapsed > 0 && elapsed <= 2) {
      queuedSeconds.current += elapsed;
      void reportProgress();
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-surgical-steel bg-[#101214]">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <div className="relative aspect-video bg-black">
            {sourceError ? (
              <div role="alert" className="absolute inset-0 grid place-items-center p-8 text-center">
                <div className="max-w-sm space-y-3">
                  <p className="font-semibold text-white">Video unavailable</p>
                  <p className="text-sm leading-6 text-on-surface-variant">{sourceError}</p>
                </div>
              </div>
            ) : (
              <video
                ref={videoRef}
                className="h-full w-full bg-black"
                src={`/api/courses/videos/${encodeURIComponent(videoId)}/stream`}
                controls
                loop={false}
                controlsList="nodownload noremoteplayback"
                disablePictureInPicture={false}
                playsInline
                preload="metadata"
                onLoadedMetadata={() => { lastPosition.current = videoRef.current?.currentTime ?? 0; }}
                onTimeUpdate={handleTimeUpdate}
                onPause={() => { void reportProgress(true); }}
                onEnded={(event) => {
                  const player = event.currentTarget;
                  player.pause();
                  player.currentTime = player.duration;
                  void reportProgress(true);
                }}
                onError={() => setSourceError("We could not load this protected video. Please refresh and try again.")}
              >
                Your browser does not support secure video playback.
              </video>
            )}
          </div>

          <div className="space-y-5 p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-container">{courseTitle}</p>
                <h1 className="font-headline text-2xl font-bold leading-tight text-white md:text-3xl">{title}</h1>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-surgical-steel pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <ShieldCheck size={16} className="text-primary-container" />
                <span>Protected playback · next lesson opens at 80%</span>
              </div>
              <div className="min-w-44">
                <div className="mb-1.5 flex justify-between text-xs text-on-surface-variant">
                  <span>Watch progress</span><span className="font-semibold text-primary-container">{progress.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surgical-steel">
                  <div className="h-full rounded-full bg-primary-container transition-[width] duration-200" style={{ width: `${Math.min(100, progress)}%` }} />
                </div>
              </div>
            </div>

            {progressError && <p role="alert" className="text-sm text-amber-300">{progressError}</p>}

            {nextVideo && <Link href={`${routeBase}/courses/${courseId}/video/${nextVideo.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary-container px-4 text-xs font-semibold uppercase tracking-wide text-on-primary-fixed transition-colors hover:brightness-110">Next video <ChevronRight size={15} /></Link>}
          </div>
        </div>

        <aside className="border-t border-surgical-steel bg-monolith-surface lg:border-l lg:border-t-0">
          <div className="flex items-center gap-2 border-b border-surgical-steel px-4 py-4 text-sm font-semibold text-white">
            <ListVideo size={17} className="text-primary-container" />
            Course queue
          </div>
          <ol className="max-h-[34rem] overflow-y-auto py-2">
            {queue.map((video, index) => {
              const active = video.id === videoId;
              const content = (
                <>
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${active ? "bg-primary-container text-on-primary-fixed" : video.isCompleted ? "text-primary-container" : "bg-surface-container-high text-fog-muted"}`}>
                    {video.isCompleted ? <CheckCircle2 size={15} /> : active ? <Play size={13} fill="currentColor" /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-medium ${active ? "text-white" : "text-on-surface-variant"}`}>{video.title}</span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-fog-muted"><Clock3 size={12} />{formatDuration(video.durationSeconds)}</span>
                  </span>
                  {video.isUnlocked && !active ? <ChevronRight size={15} className="text-fog-muted" /> : !video.isUnlocked ? <LockKeyhole size={14} className="text-fog-muted" /> : null}
                </>
              );
              return <li key={video.id} className="px-2">{video.isUnlocked ? <Link href={`${routeBase}/courses/${courseId}/video/${video.id}`} className={`flex min-h-16 items-center gap-3 rounded-lg px-3 py-2 transition-colors ${active ? "bg-primary-container/10" : "hover:bg-surface-container-high"}`}>{content}</Link> : <div className="flex min-h-16 items-center gap-3 rounded-lg px-3 py-2 opacity-60">{content}</div>}</li>;
            })}
          </ol>
        </aside>
      </div>
    </section>
  );
}
