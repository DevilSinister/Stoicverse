"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play } from "lucide-react";

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

  const progress = total ? Math.min(100, (elapsed / total) * 100) : 0;

  return (
    <div className="flex max-w-md items-center gap-2 rounded-lg border border-surgical-steel bg-surface-container-lowest px-2 py-1.5">
      {/* `preload="none"`: a channel of voice notes should not fetch every one of them on open. */}
      <audio ref={audioRef} src={src} preload="none" className="hidden" />

      <Mic size={14} aria-hidden="true" className="shrink-0 text-fog-muted" />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        className="focus-ring flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-container text-monolith-surface"
      >
        {playing ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
      </button>

      {/*
        A range input rather than a styled div: dragging, arrow keys and a
        screen reader's value announcement all come free, and a voice note is
        exactly the kind of thing somebody wants to skip back through.
      */}
      <label className="min-w-0 flex-1">
        <span className="sr-only">{`Seek within ${label}`}</span>
        <input
          type="range"
          min={0}
          max={total ?? 0}
          step={0.1}
          value={Math.min(elapsed, total ?? 0)}
          disabled={!total}
          onChange={(event) => seek(Number(event.target.value))}
          style={{
            background: `linear-gradient(to right, var(--color-primary-container) ${progress}%, var(--color-surgical-steel) ${progress}%)`,
          }}
          className="voice-scrubber h-1 w-full cursor-pointer appearance-none rounded-full disabled:cursor-default"
        />
      </label>

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
