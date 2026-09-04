import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("member dashboard reads only the signed-in member turnover summary", async () => {
  const [dashboard, page, migration] = await Promise.all([
    read("src/components/dashboard/TerminalDashboard.tsx"),
    read("src/app/dashboard/page.tsx"),
    read("supabase/migrations/20260814084330_creator_member_operations.sql"),
  ]);
  assert.match(dashboard, /Turnover this week/);
  assert.match(dashboard, /All-time turnover/);
  assert.match(page, /member_turnover_summary/);
  assert.match(page, /eq\("user_id", user\.id\)/);
  assert.doesNotMatch(page, /member_dashboard_turnover/);
  assert.match(migration, /with \(security_invoker = true\)/);
  assert.match(migration, /user_id = \(select auth\.uid\(\)\) or public\.is_influencer\(\)/);
});
test("creator turnover is page-batched, per-member, and lifetime-derived", async () => {
  const [migration, actions, workspace, overview] = await Promise.all([
    read("supabase/migrations/20260814084330_creator_member_operations.sql"),
    read("src/app/creator/members/actions.ts"),
    read("src/components/creator/members/TurnoverWorkspace.tsx"),
    read("src/app/creator/dashboard/page.tsx"),
  ]);
  assert.match(migration, /primary key \(user_id, week_start\)/);
  assert.match(migration, /amount_usd numeric\(14, 2\).*check \(amount_usd >= 0\)/);
  assert.match(migration, /coalesce\(sum\(entry\.amount_usd\), 0\)/);
  assert.match(actions, /changes\.length > 50/);
  assert.match(actions, /onConflict: "user_id,week_start"/);
  assert.match(workspace, /Save changes/);
  assert.match(workspace, /Previous weeks remain immutable/);
  assert.match(overview, /creator_turnover_totals/);
});

test("settings uses fixed desktop regions and phone list-to-detail navigation", async () => {
  const settings = await read("src/components/settings/AccountSettingsWorkspace.tsx");
  assert.match(settings, /md:h-svh md:overflow-hidden/);
  assert.match(settings, /md:h-full md:min-h-0 md:overflow-y-auto/);
  assert.match(settings, /mobileBackButton\.current\?\.focus/);
  assert.match(settings, /All settings/);
  assert.match(settings, /Back to dashboard/);
});

test("workspace loading states stream useful dashboard-shaped skeletons without repeating page access checks", async () => {
  const [dashboardLoading, creatorLoading, dashboardLayout, creatorLayout, appShell] = await Promise.all([
    read("src/app/dashboard/loading.tsx"), read("src/app/creator/loading.tsx"), read("src/app/dashboard/layout.tsx"), read("src/app/creator/layout.tsx"), read("src/components/layout/AppShell.tsx"),
  ]);
  assert.match(dashboardLoading, /aria-busy="true"/);
  assert.match(dashboardLoading, /MetricSkeleton/);
  assert.match(creatorLoading, /MetricSkeleton/);
  assert.doesNotMatch(dashboardLayout, /requireActiveMembership/);
  assert.doesNotMatch(creatorLayout, /requireInfluencerWorkspace/);
  assert.doesNotMatch(appShell, /window\.setTimeout\(\(\) => \{ void loadNotifications\(false\); \}, 0\)/);
});
