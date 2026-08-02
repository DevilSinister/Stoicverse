import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("overview refresh ignores stale responses without aborting the request", async () => {
  const view = await readFile(new URL("../src/components/creator/CreatorOverviewView.tsx", import.meta.url), "utf8");
  assert.match(view, /let active = true/);
  assert.match(view, /return \(\) => \{ active = false; \}/);
  assert.doesNotMatch(view, /controller\.abort\(\)/);
});
