import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("creator overview exposes aggregate-only metrics and handles the selected period", () => {
  const migration = read("supabase/migrations/20260714010000_creator_overview_metrics.sql");
  const route = read("src/app/api/creator/overview/route.ts");
  const view = read("src/components/creator/CreatorOverviewView.tsx");

  assert.match(migration, /get_creator_overview_metrics/);
  assert.match(migration, /period_days not in \(7, 30, 90\)/);
  assert.match(migration, /public\.is_influencer\(\) or public\.is_super_admin\(\)/);
  assert.match(migration, /status = 'succeeded'/);
  assert.match(migration, /enrollmentCount/);
  assert.match(migration, /revoke all on function public\.get_creator_overview_metrics/);
  assert.doesNotMatch(route, /from\("payments"\)/);
  assert.match(route, /supabase\.rpc\("get_creator_overview_metrics"/);
  assert.match(route, /Apply the latest Supabase migration/);
  assert.match(view, /const periods = \[7, 30, 90\]/);
  assert.match(view, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
  assert.match(view, /Today’s schedule/);
  assert.match(view, /Needs attention/);
});
