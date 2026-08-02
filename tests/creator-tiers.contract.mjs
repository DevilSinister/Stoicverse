import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("legacy tier management is retired from active creator navigation", async () => {
  const [page, nav, shell] = await Promise.all([
    read("src/app/creator/tiers/page.tsx"),
    read("src/lib/navigation/app-nav.ts"),
    read("src/components/layout/AppShell.tsx"),
  ]);
  assert.match(page, /redirect\("\/creator\/members"\)/);
  assert.doesNotMatch(nav, /href: "\/creator\/tiers", label: "Tiers"/);
  assert.doesNotMatch(shell, /Tier 0\$\{currentTier\} (?:achievement|access)/);
  assert.match(shell, /Member profile/);
});
