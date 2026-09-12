"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Mic, Pause, Play, Trash2 } from "lucide-react";

import { VoicePlayer } from "@/components/channels/VoicePlayer";
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
  onActiveChange,
}: {
  disabled?: boolean;
  onRecorded: (recording: Recording) => void;
  /**
   * Fires whenever the recorder takes over the composer row or gives it back.
   * Recording, pausing and reviewing all occupy the whole row, the way they do
   * in WhatsApp — a text box beside a running recording is a box nobody is
   * typing in.
   */
  onActiveChange?: (active: boolean) => void;
}) {
  const [state, setState] = useState<"idle" | "recording" | "paused" | "review">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; recording: Recording } | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Elapsed time is accumulated across runs rather than measured from a single
  // start: with pause and resume, "now minus when I started" counts the silence
  // somebody deliberately left out.
  const runStartedAtRef = useRef(0);
  const bankedRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    onActiveChange?.(state !== "idle");
  }, [state, onActiveChange]);

  // A blob URL is a live handle into memory; losing it without revoking leaks
  // the whole recording for the life of the document.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
      if (tickRef.current) clearInterval(tickRef.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, [preview]);

  /** Time actually recorded: what is banked, plus the run in progress. */
  const recordedSeconds = () =>
    bankedRef.current + (runStartedAtRef.current ? (Date.now() - runStartedAtRef.current) / 1000 : 0);

  const clearTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const stop = () => {
    clearTick();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      // A paused recorder still has to be stopped to flush its last chunk.
      bankedRef.current = recordedSeconds();
      runStartedAtRef.current = 0;
      recorder.stop();
    }
  };

  const pause = () => {
    const recorder = recorderRef.current;
    if (recorder?.state !== "recording") return;
    clearTick();
    bankedRef.current = recordedSeconds();
    runStartedAtRef.current = 0;
    recorder.pause();
    setState("paused");
  };

  const resume = () => {
    const recorder = recorderRef.current;
    if (recorder?.state !== "paused") return;
    recorder.resume();
    setState("recording");
    startTick();
  };

  /**
   * Throw the recording away without ever producing a clip.
   *
   * The flag is read by `onstop`, which fires either way: without it, cancelling
   * would stop the recorder and then hand back the very recording that was just
   * discarded.
   */
  const cancel = () => {
    clearTick();
    cancelledRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    setState("idle");
    setElapsed(0);
    bankedRef.current = 0;
    runStartedAtRef.current = 0;
  };

  /** Marks the run as started now, and keeps the timer honest while it runs. */
  const startTick = () => {
    runStartedAtRef.current = Date.now();
    tickRef.current = setInterval(() => {
      const seconds = recordedSeconds();
      setElapsed(seconds);
      if (seconds >= VOICE_NOTE_MAX_SECONDS) stop();
    }, 200);
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
    } catch (failure) {
      // These need different sentences, because they need different actions.
      // "The microphone is not available" sent somebody looking for a broken
      // recorder when the answer was a permission they could grant in two
      // clicks — and, before that, a `Permissions-Policy` header that had
      // disabled the microphone for the whole origin.
      const name = failure instanceof DOMException ? failure.name : "";
      setError(
        name === "NotAllowedError"
          ? "Microphone access is blocked. Allow it for this site in your browser, then try again."
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "No microphone was found."
            : "The microphone could not be started.",
      );
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      // Cancelled: the chunks are dropped and no clip is ever produced.
      if (cancelledRef.current) {
        chunksRef.current = [];
        return;
      }
      const blob = new Blob(chunksRef.current, { type: mimeType });
      // Banked wall-clock time, not read back off the file: a webm from
      // MediaRecorder carries no duration in its header, and decoding it to
      // find out costs more than the number is worth.
      const durationSeconds = Math.max(0.1, bankedRef.current);
      const recording = { blob, mimeType, durationSeconds };
      setPreview({ url: URL.createObjectURL(blob), recording });
      setState("review");
    };

    recorderRef.current = recorder;
    cancelledRef.current = false;
    bankedRef.current = 0;
    setElapsed(0);
    recorder.start();
    setState("recording");
    // Stops itself rather than letting somebody record until the upload is
    // refused for size.
    startTick();
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
      <div className="flex w-full items-center gap-2">
        <div className="min-w-0 flex-1">
          <VoicePlayer
            src={preview.url}
            durationSeconds={preview.recording.durationSeconds}
            label="your recording"
          />
        </div>
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

  if (state === "recording" || state === "paused") {
    const paused = state === "paused";
    return (
      <div className="flex w-full items-center gap-2 rounded-lg border border-surgical-steel bg-surface-container-lowest px-2 py-1.5">
        {/*
          Delete first, the way WhatsApp puts it: the control you reach for
          when you have changed your mind mid-sentence should not be the one
          next to the control that sends.
        */}
        <button
          type="button"
          onClick={cancel}
          aria-label="Delete this recording"
          className="focus-ring shrink-0 rounded-lg p-1.5 text-fog-muted hover:text-error"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>

        <span className="flex items-center gap-1.5 text-[11px] tabular-nums text-error" role="status">
          <span
            aria-hidden="true"
            className={`size-2 rounded-full bg-error ${paused ? "" : "animate-pulse"}`}
          />
          {clock(elapsed)}
          {paused ? <span className="text-fog-muted">paused</span> : null}
        </span>

        <span className="flex-1" />

        <button
          type="button"
          onClick={() => (paused ? resume() : pause())}
          aria-label={paused ? "Resume recording" : "Pause recording"}
          className="focus-ring shrink-0 rounded-lg p-1.5 text-on-surface-variant hover:text-on-surface"
        >
          {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
        </button>

        <button
          type="button"
          onClick={stop}
          aria-label="Finish recording"
          className="focus-ring shrink-0 rounded-lg bg-primary-container p-1.5 text-monolith-surface"
        >
          <Check size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <>
      {/*
        Filled in the accent rather than drawn as another grey glyph: with the
        box empty this is the send button's position and its job, and it should
        read as the thing you press.
      */}
      <button
        type="button"
        onClick={() => void start()}
        disabled={disabled}
        aria-label="Record a voice note"
        className="focus-ring flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-container text-monolith-surface disabled:opacity-40"
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
