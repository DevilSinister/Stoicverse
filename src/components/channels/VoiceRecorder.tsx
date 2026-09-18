"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, SendHorizontal, Trash2 } from "lucide-react";

import { WaveformBars } from "@/components/channels/Waveform";
import { useToast } from "@/components/ui/toast";
import { audioContextClass, FLAT_WAVEFORM, levelFromTimeDomain, pushLevel } from "@/lib/channels/waveform";
import { VOICE_NOTE_MAX_SECONDS, VOICE_NOTE_MIN_SECONDS } from "@/lib/community/constants";

/**
 * Record a voice note in the composer.
 *
 * A voice note is an ordinary attachment whose mime type happens to be audio,
 * so nothing downstream of this component knows it is special: the same upload
 * path, the same 25 MB cap, the same `attach_files` permission.
 *
 * **Finishing sends it.** There is no review step: the two controls while
 * recording are the bin and send, which is the whole decision — throw this
 * away, or say it. A confirmation between stopping and sending was one press
 * too many for something people do mid-sentence, and the bin is right there
 * for the other answer.
 *
 * The microphone is released the instant recording ends. Holding the stream
 * open leaves the browser's recording indicator lit, which reads as an
 * application still listening.
 */

export type Recording = { blob: Blob; mimeType: string; durationSeconds: number };

/** How often the timer and the live meter are read. */
const TICK_MS = 100;

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
   * Recording and pausing occupy the whole row, the way they do in WhatsApp —
   * a text box beside a running recording is a box nobody is typing in.
   */
  onActiveChange?: (active: boolean) => void;
}) {
  // Failures are toasted, never rendered here: this component *is* the
  // composer row while it runs, and a line of red text inside it pushed the
  // send button sideways at the exact moment somebody was reaching for it.
  const notify = useToast();

  const [state, setState] = useState<"idle" | "recording" | "paused">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<readonly number[]>(FLAT_WAVEFORM);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Elapsed time is accumulated across runs rather than measured from a single
  // start: with pause and resume, "now minus when I started" counts the silence
  // somebody deliberately left out.
  const runStartedAtRef = useRef(0);
  const bankedRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  // The meter taps the live stream. It is decoration: if the browser will not
  // give us an AudioContext, the recording still happens and the bars stay flat.
  // `Uint8Array<ArrayBuffer>` rather than a bare `Uint8Array`: the analyser
  // writes in place and will not accept a view that might be over shared memory.
  const meterRef = useRef<{ context: AudioContext; analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> } | null>(
    null,
  );
  const levelsRef = useRef<readonly number[]>(FLAT_WAVEFORM);

  useEffect(() => {
    onActiveChange?.(state !== "idle");
  }, [state, onActiveChange]);

  // An abandoned recorder holds the microphone open and an abandoned
  // AudioContext holds an audio thread; neither is collected on its own.
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      void meterRef.current?.context.close();
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  /** Time actually recorded: what is banked, plus the run in progress. */
  const recordedSeconds = () =>
    bankedRef.current + (runStartedAtRef.current ? (Date.now() - runStartedAtRef.current) / 1000 : 0);

  const clearTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const releaseMeter = () => {
    void meterRef.current?.context.close();
    meterRef.current = null;
  };

  const resetMeter = () => {
    levelsRef.current = FLAT_WAVEFORM;
    setLevels(FLAT_WAVEFORM);
  };

  /** Stop recording. `onstop` is where the clip is handed on. */
  const finish = () => {
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
   * The flag is read by `onstop`, which fires either way: without it,
   * cancelling would stop the recorder and then send the very recording that
   * was just discarded.
   */
  const cancel = () => {
    clearTick();
    cancelledRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    releaseMeter();
    resetMeter();
    setState("idle");
    setElapsed(0);
    bankedRef.current = 0;
    runStartedAtRef.current = 0;
  };

  /** Marks the run as started now, and keeps the timer and the meter honest while it runs. */
  const startTick = () => {
    runStartedAtRef.current = Date.now();
    tickRef.current = setInterval(() => {
      const meter = meterRef.current;
      if (meter) {
        meter.analyser.getByteTimeDomainData(meter.data);
        const next = pushLevel(levelsRef.current, levelFromTimeDomain(meter.data));
        levelsRef.current = next;
        setLevels(next);
      }
      const seconds = recordedSeconds();
      setElapsed(seconds);
      // At the cap the recording is finished for you, and a finished recording
      // sends. Stopping into a state that needs one more press would strand
      // five minutes of talking behind a button nobody was told about.
      if (seconds >= VOICE_NOTE_MAX_SECONDS) finish();
    }, TICK_MS);
  };

  /** Tap the stream for the live meter. Never connected to the output: that is feedback. */
  const openMeter = (stream: MediaStream) => {
    const Context = audioContextClass();
    if (!Context) return;
    try {
      const context = new Context();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      meterRef.current = { context, analyser, data: new Uint8Array(analyser.fftSize) };
    } catch {
      meterRef.current = null;
    }
  };

  const start = async () => {
    const mimeType = pickMimeType();
    if (!mimeType) {
      notify("This browser cannot record audio.");
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
      notify(
        name === "NotAllowedError"
          ? "Microphone access is blocked. Allow it for this site in your browser, then try again."
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "No microphone was found."
            : "The microphone could not be started.",
      );
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      notify("The microphone could not be started.");
      return;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      releaseMeter();
      resetMeter();
      setState("idle");
      setElapsed(0);

      // Cancelled: the chunks are dropped and no clip is ever produced.
      if (cancelledRef.current) {
        chunksRef.current = [];
        return;
      }

      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      // Banked wall-clock time, not read back off the file: a webm from
      // MediaRecorder carries no duration in its header, and decoding it to
      // find out costs more than the number is worth.
      const durationSeconds = bankedRef.current;
      if (durationSeconds < VOICE_NOTE_MIN_SECONDS) {
        notify("That recording was too short to send.");
        return;
      }
      onRecorded({ blob, mimeType, durationSeconds });
    };

    recorderRef.current = recorder;
    cancelledRef.current = false;
    bankedRef.current = 0;
    setElapsed(0);
    resetMeter();
    openMeter(stream);

    // `start` throws if the track has ended between the permission being
    // granted and this line — a headset unplugged mid-thought. Uncaught, it
    // left the recorder holding an open microphone in a state it could never
    // leave, and said nothing at all to the person waiting for it.
    try {
      recorder.start();
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      releaseMeter();
      recorderRef.current = null;
      notify("The microphone stopped before recording could start.");
      return;
    }

    setState("recording");
    // Stops itself rather than letting somebody record until the upload is
    // refused for size.
    startTick();
  };

  if (state === "recording" || state === "paused") {
    const paused = state === "paused";
    return (
      <div className="flex w-full items-center gap-2 rounded-lg border border-border-hairline bg-surface-sunken px-2 py-1.5">
        {/*
          Delete first, the way WhatsApp puts it: the control you reach for
          when you have changed your mind mid-sentence should not be the one
          next to the control that sends.
        */}
        <button
          type="button"
          onClick={cancel}
          aria-label="Delete this recording"
          className="focus-ring hit-target relative shrink-0 rounded-lg p-1.5 text-text-muted hover:text-status-danger"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>

        <span className="flex shrink-0 items-center gap-1.5 font-mono text-mono-xs text-status-danger" role="status">
          <span aria-hidden="true" className={`size-2 rounded-full bg-status-danger ${paused ? "" : "animate-pulse"}`} />
          {clock(elapsed)}
          {paused ? <span className="text-text-muted">paused</span> : null}
        </span>

        {/*
          The meter, scrolling left as you talk. It is the one honest answer to
          "is this thing hearing me" — a timer counts up just as happily into a
          muted microphone. Lit whole while running and unlit while paused,
          because here the bars are a level, not a position.
        */}
        <div className="min-w-0 flex-1">
          <WaveformBars levels={levels} progress={paused ? 0 : 1} />
        </div>

        <button
          type="button"
          onClick={() => (paused ? resume() : pause())}
          aria-label={paused ? "Resume recording" : "Pause recording"}
          className="focus-ring hit-target relative shrink-0 rounded-lg p-1.5 text-text-default hover:text-text-strong"
        >
          {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
        </button>

        <button
          type="button"
          onClick={finish}
          aria-label="Send this voice note"
          className="focus-ring hit-target relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
        >
          <SendHorizontal size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    /*
      Filled in the accent rather than drawn as another grey glyph: with the
      box empty this is the send button's position and its job, and it should
      read as the thing you press.
    */
    <button
      type="button"
      onClick={() => void start()}
      disabled={disabled}
      aria-label="Record a voice note"
      className="focus-ring hit-target relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
    >
      <Mic size={16} aria-hidden="true" />
    </button>
  );
}
