/**
 * The arithmetic behind a voice note's waveform.
 *
 * Kept out of the components because it is the part worth testing: both the
 * recorder's live meter and the player's drawn clip reduce a stream of samples
 * to the same small array of heights, and getting that reduction wrong is the
 * difference between a picture of somebody's voice and a row of identical
 * sticks.
 */

/**
 * How many bars a voice note is drawn with.
 *
 * Enough that a sentence has a shape, few enough that each bar still has a
 * pixel of its own in the narrowest place one of these renders — a reply
 * bubble on a phone.
 */
export const WAVEFORM_BARS = 44;

/** The shape of a clip nothing has measured yet: a rest, not a reading. */
export const FLAT_WAVEFORM: readonly number[] = new Array(WAVEFORM_BARS).fill(0);

/** Prefixed on older Safari, and absent entirely in a locked-down embed. */
export function audioContextClass(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

/**
 * Reduce decoded audio to one height per bar: the RMS of each bucket,
 * normalised so the loudest bar is full height.
 *
 * Normalised rather than absolute because a voice note recorded quietly is
 * still a voice note, and drawn against an absolute scale it would be a flat
 * line — which is exactly what somebody would read as "this one is broken".
 */
export function peaksFromSamples(samples: Float32Array | readonly number[], bars = WAVEFORM_BARS): number[] {
  if (bars <= 0) return [];
  const length = samples.length;
  if (length === 0) return new Array(bars).fill(0);

  const peaks: number[] = [];
  for (let bar = 0; bar < bars; bar += 1) {
    // Bucket edges from the ratio rather than a fixed stride, so the last bar
    // covers the tail instead of dropping a remainder of up to `bars` samples.
    const start = Math.floor((bar * length) / bars);
    const end = Math.max(start + 1, Math.floor(((bar + 1) * length) / bars));
    let sum = 0;
    for (let index = start; index < end; index += 1) {
      const sample = samples[index] ?? 0;
      sum += sample * sample;
    }
    peaks.push(Math.sqrt(sum / (end - start)));
  }

  const loudest = Math.max(...peaks);
  return loudest > 0 ? peaks.map((peak) => peak / loudest) : peaks;
}

/**
 * One live bar from an analyser's time-domain bytes, 0 to 1.
 *
 * The square root on top of the RMS is deliberate: speech sits near the bottom
 * of the available range, and a linear meter draws an ordinary sentence as
 * almost nothing at all.
 */
export function levelFromTimeDomain(data: Uint8Array | readonly number[]): number {
  if (data.length === 0) return 0;
  let sum = 0;
  for (let index = 0; index < data.length; index += 1) {
    const centred = ((data[index] ?? 128) - 128) / 128;
    sum += centred * centred;
  }
  const rms = Math.sqrt(sum / data.length);
  return Math.min(1, Math.sqrt(rms) * 1.6);
}

/** The meter scrolls: the newest bar arrives on the right, the oldest falls off. */
export function pushLevel(levels: readonly number[], level: number, bars = WAVEFORM_BARS): number[] {
  return [...levels, level].slice(-bars);
}
