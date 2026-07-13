import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("proxy sends influencers to the workspace and denies other roles", () => {
  const source = read("proxy.ts");
  assert.match(source, /const influencerRoute = "\/creator"/);
  assert.match(source, /platform_role === "influencer" && !isInfluencerRoute/);
  assert.match(source, /isInfluencerRoute && \(profile\?\.is_suspended \|\| profile\?\.platform_role !== "influencer"\)/);
});

test("all workspace mutations re-authorize the influencer", () => {
  const source = read("src/app/creator/actions.ts");
  for (const action of ["saveChannel", "deleteChannel", "saveLesson", "deleteLesson", "setModerator", "updateReview", "saveEvent"]) {
    const body = source.slice(source.indexOf(`export async function ${action}`));
    assert.match(body, /await requireInfluencer\(\)/);
  }
  assert.match(source, /\["member", "moderator"\]/);
});

test("migration grants operational access only to the influencer", () => {
  const source = read("supabase/migrations/20260714000000_influencer_workspace.sql");
  for (const policy of ["channels", "lessons", "events", "reviews"]) assert.match(source, new RegExp(`influencer_${policy}_manage`));
  assert.match(source, /platform_role in \('member', 'moderator'\)/);
  assert.match(source, /public\.is_influencer\(\)/);
});
