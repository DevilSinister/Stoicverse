import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("legacy tier management is retired from active creator navigation", async () => {
  const [page, nav, shell, rail] = await Promise.all([
    read("src/app/creator/tiers/page.tsx"),
    read("src/lib/navigation/rail.ts"),
    read("src/components/layout/AppShell.tsx"),
    read("src/components/layout/AppRail.tsx"),
  ]);
  assert.match(page, /redirect\("\/creator\/members"\)/);
  // The rail is the nav now, and it has never carried a Tiers destination.
  assert.doesNotMatch(nav, /\/creator\/tiers/);
  assert.doesNotMatch(shell, /Tier 0\$\{currentTier\} (?:achievement|access)/);
  // The viewer's own identity used to be a "Member profile" caption in the
  // shell's sidebar footer. It is the rail's avatar now, and the avatar is the
  // account-settings control rather than a label beside a separate gear.
  assert.match(rail, /accountHref/);
  assert.match(rail, /account settings/);
});
