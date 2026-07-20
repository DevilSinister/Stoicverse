import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("creator tiers have a dedicated guarded management surface", async () => {
  const [page, manager, actions, nav] = await Promise.all([
    read("src/app/creator/tiers/page.tsx"),
    read("src/components/creator/CreatorTierManager.tsx"),
    read("src/app/creator/tiers/actions.ts"),
    read("src/lib/navigation/app-nav.ts"),
  ]);

  assert.match(page, /requireInfluencerWorkspace\("\/creator\/tiers"\)/);
  assert.match(page, /CreatorTierManager/);
  assert.match(manager, /Required lessons/);
  assert.match(manager, /mapped course/);
  assert.match(manager, /Each tier controls access to courses/);
  assert.match(actions, /requireInfluencer\(\)/);
  assert.match(actions, /community_id: community\.id/);
  assert.match(actions, /onConflict: "community_id,level"/);
  assert.match(actions, /Move or remove linked courses and lessons/);
  assert.doesNotMatch(nav, /href: "\/creator\/tiers", label: "Tiers"/);
});
