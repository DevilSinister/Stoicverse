import assert from "node:assert/strict";
import test from "node:test";

import {
  FLAT_WAVEFORM,
  levelFromTimeDomain,
  peaksFromSamples,
  pushLevel,
  WAVEFORM_BARS,
} from "../src/lib/channels/waveform.ts";

test("a clip is reduced to one normalised bar per column", () => {
  // Loud in the first half, a tenth as loud in the second.
  const samples = [...new Array(100).fill(1), ...new Array(100).fill(0.1)];
  const peaks = peaksFromSamples(samples, 4);

  assert.equal(peaks.length, 4);
  assert.deepEqual(
    peaks.map((peak) => Number(peak.toFixed(2))),
    [1, 1, 0.1, 0.1],
  );
});

test("a quiet recording still fills the meter", () => {
  // Every sample a hundredth of full scale: audible, and a flat line against
  // an absolute scale. The loudest bar must still come out at 1.
  const quiet = peaksFromSamples([...new Array(50).fill(0.01), ...new Array(50).fill(0.005)], 2);
  assert.deepEqual(quiet, [1, 0.5]);
});

test("silence and emptiness are bars of zero, not a crash", () => {
  assert.deepEqual(peaksFromSamples([], 3), [0, 0, 0]);
  assert.deepEqual(peaksFromSamples(new Array(30).fill(0), 3), [0, 0, 0]);
  assert.deepEqual(peaksFromSamples([1, 2, 3], 0), []);
});

test("every sample lands in a bucket, however the count divides", () => {
  // 10 samples over 4 bars: a fixed stride would drop the last two.
  const samples = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1];
  const peaks = peaksFromSamples(samples, 4);
  assert.equal(peaks.length, 4);
  assert.ok(peaks[3] > 0, "the tail is drawn");
});

test("the live meter reads silence as nothing and a full swing as everything", () => {
  // 128 is the zero line of an analyser's time-domain bytes.
  assert.equal(levelFromTimeDomain(new Uint8Array(64).fill(128)), 0);
  assert.equal(levelFromTimeDomain(new Uint8Array(64).fill(255)), 1);
  assert.equal(levelFromTimeDomain(new Uint8Array()), 0);

  // Speech sits low in the range and must still be visible: an eighth of full
  // scale should read as a bar well clear of the floor.
  const speech = levelFromTimeDomain(new Uint8Array(64).fill(144));
  assert.ok(speech > 0.4 && speech < 1, `expected a legible bar, got ${speech}`);
});

test("the meter scrolls, keeping the newest bars and no more", () => {
  assert.equal(FLAT_WAVEFORM.length, WAVEFORM_BARS);
  assert.ok(FLAT_WAVEFORM.every((level) => level === 0));

  let levels = FLAT_WAVEFORM;
  for (let index = 0; index < WAVEFORM_BARS + 5; index += 1) levels = pushLevel(levels, index / 100);

  assert.equal(levels.length, WAVEFORM_BARS);
  assert.equal(levels[levels.length - 1], (WAVEFORM_BARS + 4) / 100, "the newest sample is on the right");
});
