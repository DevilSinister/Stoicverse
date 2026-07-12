"use client";

import { useEffect, useState } from "react";

export function LessonPlayer({ lessonId, title }: { lessonId: string; title: string }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/courses/lessons/${lessonId}/video`)
      .then(async (response) => ({ response, body: await response.json() as { previewUrl?: string; error?: string } }))
      .then(({ response, body }) => {
        if (!active) return;
        if (!response.ok || !body.previewUrl) setError(body.error ?? "This lesson is unavailable.");
        else setPreviewUrl(body.previewUrl);
      })
      .catch(() => active && setError("Unable to load this lesson."));
    return () => { active = false; };
  }, [lessonId]);

  useEffect(() => {
    if (!previewUrl) return;
    const interval = window.setInterval(() => {
      fetch(`/api/courses/lessons/${lessonId}/progress`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ elapsedSeconds: 15 }),
      }).catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [lessonId, previewUrl]);

  if (error) return <p role="alert" className="font-body text-sm text-red-400">{error}</p>;
  if (!previewUrl) return <p className="font-body text-sm text-fog-muted">Preparing the secured lesson player…</p>;
  return <iframe title={title} src={previewUrl} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="aspect-video w-full rounded border border-surgical-steel bg-black" />;
}
