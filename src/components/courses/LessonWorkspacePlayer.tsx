"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PlaylistVideo = { id: string; title: string; durationSeconds: number; isOptional: boolean; isCompleted: boolean; isUnlocked: boolean };
const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export function LessonWorkspacePlayer({ videoId, title, description, courseId, courseTitle, videos, initialProgress, routeBase = "" }: { videoId: string; title: string; description?: string | null; courseId: string; courseTitle: string; videos: PlaylistVideo[]; initialProgress: number; routeBase?: string }) {
  const player = useRef<HTMLVideoElement>(null);
  const lastPosition = useRef(0);
  const queuedSeconds = useRef(0);
  const [progress, setProgress] = useState(initialProgress);
  const [completedIds, setCompletedIds] = useState(() => new Set(videos.filter((video) => video.isCompleted).map((video) => video.id)));
  const [error, setError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const queue = useMemo(() => videos.map((video) => ({ ...video, isCompleted: completedIds.has(video.id), isUnlocked: true })), [videos, completedIds]);
  const activeIndex = queue.findIndex((video) => video.id === videoId);
  const nextVideo = queue[activeIndex + 1];

  useEffect(() => { void fetch(`/api/courses/videos/${videoId}/video`, { method: "POST" }); }, [videoId]);
  const saveProgress = useCallback(async (force = false) => {
    const seconds = Math.min(15, Math.floor(queuedSeconds.current));
    if (seconds < 1 || (!force && seconds < 12)) return;
    queuedSeconds.current -= seconds;
    try {
      const response = await fetch(`/api/courses/videos/${videoId}/progress`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ elapsedSeconds: seconds }) });
      const body = await response.json() as { error?: string; progress?: { completion_percentage?: number; is_completed?: boolean } };
      if (!response.ok || body.progress?.completion_percentage === undefined) throw new Error(body.error ?? "Progress could not be saved.");
      setProgress(Number(body.progress.completion_percentage));
      if (body.progress.is_completed) setCompletedIds((current) => new Set(current).add(videoId));
      setError(null);
    } catch (cause) { queuedSeconds.current += seconds; setError(cause instanceof Error ? cause.message : "Progress could not be saved."); }
  }, [videoId]);
  const syncBrowserDuration = useCallback(() => {
    lastPosition.current = player.current?.currentTime ?? 0;
    const durationSeconds = Math.round(player.current?.duration ?? 0);
    if (durationSeconds > 0 && durationSeconds <= 86_400) void fetch(`/api/courses/videos/${videoId}/video`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ durationSeconds }) });
  }, [videoId]);

  return (<section className="grid gap-8 lg:grid-cols-12">
    <div className="min-w-0 lg:col-span-8">
      <div className="overflow-hidden rounded-lg border border-surgical-steel bg-black shadow-2xl">
        <div className="relative aspect-video bg-surface-container-lowest">
          {sourceError ? <div role="alert" className="absolute inset-0 grid place-items-center p-8 text-center"><div className="max-w-sm"><p className="font-headline text-xl font-semibold text-white">Video unavailable</p><p className="mt-2 text-sm text-on-surface-variant">{sourceError}</p></div></div> : <video ref={player} className="h-full w-full" src={`/api/courses/videos/${encodeURIComponent(videoId)}/stream`} controls controlsList="nodownload noremoteplayback" playsInline preload="metadata" onLoadedMetadata={syncBrowserDuration} onTimeUpdate={() => { const current = player.current?.currentTime ?? 0; const elapsed = current - lastPosition.current; lastPosition.current = current; if (elapsed > 0 && elapsed <= 2) { queuedSeconds.current += elapsed; void saveProgress(); } }} onPause={() => void saveProgress(true)} onEnded={() => void saveProgress(true)} onError={() => setSourceError("We could not load this protected video. Please refresh and try again.")}>Your browser does not support protected playback.</video>}
        </div>
      </div>
      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center gap-2"><span className="rounded bg-surface-container-high px-2 py-1 font-label text-[10px] uppercase tracking-wider text-on-surface-variant">Course session</span><span className="font-label text-[10px] uppercase tracking-wider text-primary-container">Watching now</span></div>
        <h1 className="font-headline text-3xl font-medium leading-tight text-white sm:text-4xl">{title}</h1>
        {description && <p className="mt-4 max-w-3xl text-sm leading-7 text-on-surface-variant">{description}</p>}
        <section className="mt-7 border-t border-surgical-steel pt-6"><h2 className="terminal-label">Lesson resources</h2><div className="mt-4 border border-surgical-steel bg-surface-container-low p-4 text-sm text-fog-muted">Lesson materials will appear here when they are attached to this session.</div></section>
        <section className="mt-7 border-t border-surgical-steel pt-6"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-headline text-lg font-medium text-white">Video watch progress</h2><span className="font-label text-sm text-primary-container">{progress.toFixed(0)}%</span></div><p className="mt-1 text-sm text-fog-muted">Watch 80% of this video to mark the session complete.</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-container-high" role="progressbar" aria-label="Video watch progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><div className="h-full rounded-full bg-primary-container transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${Math.min(100, progress)}%` }} /></div></section>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-surgical-steel py-4">
        <span className="font-label text-xs uppercase tracking-wider text-fog-muted">Protected playback</span>
        {nextVideo ? <Link href={`${routeBase}/courses/${courseId}/video/${nextVideo.id}`} className="inline-flex min-h-11 items-center justify-center gap-3 bg-primary-container px-5 font-label text-xs uppercase tracking-wider text-on-primary-fixed transition hover:brightness-110">Next lesson <ArrowRight size={16} /></Link> : <span className="font-label text-xs uppercase tracking-wider text-fog-muted">Final lesson</span>}
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-amber-300">{error}</p>}
    </div>
    <aside className="lg:col-span-4"><div className="sticky top-24 rounded-xl border border-surgical-steel bg-surface-container-low p-6"><div className="mb-5 border-b border-surgical-steel pb-5"><div className="flex items-center justify-between gap-3"><span className="font-label text-[10px] uppercase tracking-[0.14em] text-primary-container">Current module</span><span className="font-label text-xs text-on-surface-variant">{progress.toFixed(0)}% done</span></div><h2 className="mt-2 font-headline text-2xl font-medium leading-tight text-white [text-wrap:balance]">{courseTitle}</h2><p className="mt-3 text-sm text-fog-muted">{queue.length} lesson{queue.length === 1 ? "" : "s"} in this course</p></div><ol aria-label="All course lessons" className="max-h-[614px] space-y-1 overflow-y-auto pr-1">{queue.map((item, index) => <QueueItem key={item.id} item={item} index={index} active={item.id === videoId} courseId={courseId} routeBase={routeBase} />)}</ol></div></aside>
  </section>);
}

function QueueItem({ item, index, active, courseId, routeBase }: { item: PlaylistVideo; index: number; active: boolean; courseId: string; routeBase: string }) {
  const content = <><span className={`grid size-7 shrink-0 place-items-center rounded-full ${active ? "bg-primary-container/15 text-primary-container" : item.isCompleted ? "text-primary-container" : "text-fog-muted"}`}>{item.isCompleted ? <CheckCircle2 size={17} /> : active ? <Play size={15} fill="currentColor" /> : index + 1}</span><span className="min-w-0"><span className={`block truncate text-sm ${active ? "font-semibold text-primary-container" : "font-medium text-on-surface-variant"}`}>{index + 1}. {item.title}</span><span className="mt-1 block font-label text-[10px] uppercase tracking-wider text-fog-muted">{formatDuration(item.durationSeconds)}{active ? " · Watching" : item.isOptional ? " · Optional" : ""}</span></span></>;
  return <li><Link href={`${routeBase}/courses/${courseId}/video/${item.id}`} aria-current={active ? "page" : undefined} className={`flex min-h-16 items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${active ? "border-primary-container bg-primary-container/15" : "border-transparent hover:bg-surface-container-high"}`}>{content}</Link></li>;
}
