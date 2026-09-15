import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("overview refresh ignores stale responses without aborting the request", async () => {
  const view = await readFile(new URL("../src/components/creator/CreatorOverviewView.tsx", import.meta.url), "utf8");
  // The promise is that a superseded refresh is *ignored* rather than aborted:
  // an in-flight request is allowed to finish and its result dropped, because
  // aborting it would cancel a response the next render may still want. That is
  // a guard flag cleared on cleanup, and it is asserted as such - the earlier
  // spelling pinned the exact one-line formatting of the cleanup and failed on
  // a reformat that changed no behaviour at all.
  assert.match(view, /let active = true/);
  assert.match(view, /return \(\) => \{\s*active = false;\s*\};/, "the effect must clear the guard on cleanup");
  assert.match(view, /if \(active\)/, "results must be applied only while the effect is current");
  assert.doesNotMatch(view, /controller\.abort\(\)/);
});
