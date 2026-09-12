"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Mic, Square, Trash2 } from "lucide-react";

import { VOICE_NOTE_MAX_SECONDS } from "@/lib/community/constants";

/**
 * Record a voice note in the composer.
 *
 * A voice note is an ordinary attachment whose mime type happens to be audio,
 * so nothing downstream of this component knows it is special: the same upload
 * path, the same 25 MB cap, the same `attach_files` permission.
 *
 * **The recording is reviewed before it is sent.** Stopping gives you the clip
 * to play back, keep or throw away — a message that leaves the moment you stop
 * talking is one nobody can take back, and this is the one attachment type
 * whose contents the sender has never seen.
 *
 * The microphone is released the instant recording ends. Holding the stream
 * open leaves the browser's recording indicator lit, which reads as an
 * application still listening.
 */

export type Recording = { blob: Blob; mimeType: string; durationSeconds: number };

/** What this browser will actually record. Chrome and Firefox do webm, Safari does mp4. */
function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const candidate of ["audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return null;
}

function clock(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function VoiceRecorder({
  disabled,
  onRecorded,
}: {
  disabled?: boolean;
  onRecorded: (recording: Recording) => void;
}) {
  const [state, setState] = useState<"idle" | "recording" | "review">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; recording: Recording } | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // A blob URL is a live handle into memory; losing it without revoking leaks
  // the whole recording for the life of the document.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
      if (tickRef.current) clearInterval(tickRef.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, [preview]);

  const stop = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const start = async () => {
    setError(null);
    const mimeType = pickMimeType();
    if (!mimeType) {
      setError("This browser cannot record audio.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Refused, dismissed, or no microphone at all — the browser does not
      // reliably distinguish them, and the answer is the same either way.
      setError("The microphone is not available.");
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunksRef.current, { type: mimeType });
      // Measured from the wall clock rather than read back off the file: a
      // webm from MediaRecorder carries no duration in its header, and
      // decoding it to find out costs more than the number is worth.
      const durationSeconds = Math.max(0.1, (Date.now() - startedAtRef.current) / 1000);
      const recording = { blob, mimeType, durationSeconds };
      setPreview({ url: URL.createObjectURL(blob), recording });
      setState("review");
    };

    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setElapsed(0);
    recorder.start();
    setState("recording");

    tickRef.current = setInterval(() => {
      const seconds = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(seconds);
      // Stops itself rather than letting somebody record until the upload is
      // refused for size.
      if (seconds >= VOICE_NOTE_MAX_SECONDS) stop();
    }, 200);
  };

  const discard = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setState("idle");
    setElapsed(0);
  };

  const keep = () => {
    if (!preview) return;
    onRecorded(preview.recording);
    URL.revokeObjectURL(preview.url);
    setPreview(null);
    setState("idle");
    setElapsed(0);
  };

  if (state === "review" && preview) {
    return (
      <div className="flex w-full items-center gap-2 rounded-lg border border-surgical-steel bg-surface-container-lowest px-2 py-1.5">
        <audio src={preview.url} controls className="h-8 min-w-0 flex-1" />
        <span className="shrink-0 text-[11px] tabular-nums text-fog-muted">
          {clock(preview.recording.durationSeconds)}
        </span>
        <button
          type="button"
          onClick={discard}
          aria-label="Discard this recording"
          className="focus-ring shrink-0 rounded-lg p-1.5 text-fog-muted hover:text-error"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={keep}
          aria-label="Attach this recording"
          className="focus-ring shrink-0 rounded-lg bg-primary-container p-1.5 text-monolith-surface"
        >
          <Check size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (state === "recording") {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-[11px] tabular-nums text-error" role="status">
          <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-error" />
          {clock(elapsed)}
        </span>
        <button
          type="button"
          onClick={stop}
          aria-label="Stop recording"
          className="focus-ring shrink-0 rounded-lg p-1.5 text-error hover:bg-error/10"
        >
          <Square size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void start()}
        disabled={disabled}
        aria-label="Record a voice note"
        className="focus-ring shrink-0 rounded-lg p-1.5 text-fog-muted hover:text-on-surface disabled:opacity-50"
      >
        <Mic size={16} aria-hidden="true" />
      </button>
      {error ? (
        <span role="alert" className="text-[11px] text-error">
          {error}
        </span>
      ) : null}
    </>
  );
}
