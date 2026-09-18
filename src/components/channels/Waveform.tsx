"use client";

/**
 * The bars a voice note is drawn as, in the recorder and in the message list.
 *
 * Purely presentational: it is handed heights and a position and draws them.
 * Marked `aria-hidden` because it is a picture of sound — the controls beside
 * it carry the label, the time and the seek, and a screen reader announcing
 * forty-four spans would be announcing decoration.
 */
export function WaveformBars({
  levels,
  progress,
}: {
  /** One height per bar, 0 to 1. */
  levels: readonly number[];
  /** How much of the clip is behind the playhead, 0 to 1. Pass 1 to light the whole meter. */
  progress: number;
}) {
  if (levels.length === 0) return null;

  return (
    <div aria-hidden="true" className="flex h-6 w-full items-center gap-px">
      {levels.map((level, index) => {
        const played = (index + 1) / levels.length <= progress;
        // A floor of 8%, so silence is a dotted line rather than a gap: the
        // meter should still read as a meter while somebody pauses for breath.
        const height = 8 + Math.min(1, Math.max(0, level)) * 92;
        return (
          <span
            key={index}
            style={{ height: `${height}%` }}
            className={`w-full flex-1 rounded-full transition-[height] duration-100 ${
              played ? "bg-primary" : "bg-border-hairline"
            }`}
          />
        );
      })}
    </div>
  );
}
