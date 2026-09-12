"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

import { WaveformBars } from "@/components/channels/Waveform";
import { audioContextClass, FLAT_WAVEFORM, peaksFromSamples, WAVEFORM_BARS } from "@/lib/channels/waveform";

/**
 * Listening to a voice note: play, pause, scrub, and change the speed.
 *
 * Built rather than left as `<audio controls>` because the native control set
 * is a different shape, size and colour in every browser, and the one thing
 * people reliably want from a voice note — playing it faster — is buried in an
 * overflow menu in Chrome and absent in Safari.
 *
 * The duration is the recorder's measurement until the file itself reports
 * one. A webm from MediaRecorder has no duration in its header, so the audio
 * element says `Infinity` for it: the stored number is the only thing that can
 * fill the label before playback reaches the end.
 */

const SPEEDS = [1, 1.5, 2] as const;

/** A clip larger than this is left as a flat line rather than decoded whole. */
const MAX_DECODE_BYTES = 8 * 1024 * 1024;

/**
 * Measured clips, and the one-at-a-time queue that measures them.
 *
 * A waveform has to be drawn before it is played — a row of identical dashes
 * is exactly the picture of a broken attachment — so every note in view is
 * decoded on mount. Two things keep that affordable: the peaks are cached
 * across re-renders and pagination, and the decodes run in single file, so
 * opening a channel full of voice notes does not start ten decoders at once.
 *
 * The cache is keyed on the path rather than the URL: these are signed, and
 * the same clip re-signs to a different query string an hour later.
 */
const peakCache = new Map<string, number[]>();
let decodeQueue: Promise<unknown> = Promise.resolve();

function measureOnce(src: string): Promise<number[] | null> {
  const key = src.split("?")[0] ?? src;
  const cached = peakCache.get(key);
  if (cached) return Promise.resolve(cached);

  const run = decodeQueue.then(() => measure(src));
  decodeQueue = run.catch(() => null);
  return run.then((peaks) => {
    if (peaks) peakCache.set(key, peaks);
    return peaks;
  });
}

async function measure(src: string): Promise<number[] | null> {
  const Context = audioContextClass();
  if (!Context) return null;
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_DECODE_BYTES) return null;

    const context = new Context();
    try {
      const decoded = await context.decodeAudioData(bytes);
      return peaksFromSamples(decoded.getChannelData(0), WAVEFORM_BARS);
    } finally {
      void context.close();
    }
  } catch {
    // The picture is decoration; the audio element is doing the playing and
    // does not need any of this to have worked.
    return null;
  }
}

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function VoicePlayer({
  src,
  durationSeconds,
  label = "Voice note",
}: {
  src: string;
  /** The recorder's measurement. A hint: the file is the authority once it loads. */
  durationSeconds?: number | null;
  label?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [fileDuration, setFileDuration] = useState<number | null>(null);
  const [peaks, setPeaks] = useState<readonly number[] | null>(null);

  // `Infinity` is what a headerless webm reports, and it is not a duration.
  const total = fileDuration ?? (durationSeconds && durationSeconds > 0 ? durationSeconds : null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setElapsed(audio.currentTime);
    const onLoaded = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setFileDuration(audio.duration);
    };
    const onEnded = () => {
      setPlaying(false);
      setElapsed(0);
      audio.currentTime = 0;
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("durationchange", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("durationchange", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
    };
  }, []);

  useEffect(() => {
    let live = true;
    void measureOnce(src)
      .then((measured) => {
        if (live && measured) setPeaks(measured);
      })
      // `measure` swallows its own failures, so this can only fire if the
      // queue itself breaks. A `void`-invoked promise with no catch reports a
      // dead network as an uncaught TypeError in the console, and a waveform
      // is not worth one.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio || !total) return;
    audio.currentTime = Math.min(value, total);
    setElapsed(audio.currentTime);
  };

  const progress = total ? Math.min(1, elapsed / total) : 0;

  return (
    <div className="flex max-w-md items-center gap-2 rounded-lg border border-surgical-steel bg-surface-container-lowest px-2 py-1.5">
      {/*
        `preload="none"`: the element itself fetches nothing until somebody
        presses play. The one request a note costs on open is the measurement
        above, and the two share a URL, so playing it reads from the cache.
      */}
      <audio ref={audioRef} src={src} preload="none" className="hidden" />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        className="focus-ring flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-container text-monolith-surface"
      >
        {playing ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
      </button>

      {/*
        The bars are the picture; the range input laid over them is the
        control. Invisible rather than absent, because dragging, arrow keys and
        a screen reader's value announcement all come free from a real range —
        and a voice note is exactly the kind of thing somebody wants to skip
        back through.
      */}
      <div className="relative min-w-0 flex-1">
        <WaveformBars levels={peaks ?? FLAT_WAVEFORM} progress={progress} />
        <label className="absolute inset-0">
          <span className="sr-only">{`Seek within ${label}`}</span>
          <input
            type="range"
            min={0}
            max={total ?? 0}
            step={0.1}
            value={Math.min(elapsed, total ?? 0)}
            disabled={!total}
            onChange={(event) => seek(Number(event.target.value))}
            className="size-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-default"
          />
        </label>
      </div>

      <span className="shrink-0 text-[11px] tabular-nums text-fog-muted">
        {total ? `${clock(elapsed)} / ${clock(total)}` : clock(elapsed)}
      </span>

      <button
        type="button"
        onClick={cycleSpeed}
        aria-label={`Playback speed, currently ${speed} times. Change it.`}
        className="focus-ring shrink-0 rounded border border-surgical-steel px-1.5 py-0.5 text-[11px] tabular-nums text-on-surface-variant hover:text-on-surface"
      >
        {`${speed}×`}
      </button>
    </div>
  );
}
