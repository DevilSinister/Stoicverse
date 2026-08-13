import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("member dashboard publishes curated turnover without changing the remaining tiles", async () => {
  const [dashboard, page] = await Promise.all([
    read("src/components/dashboard/TerminalDashboard.tsx"),
    read("src/app/dashboard/page.tsx"),
  ]);

  assert.match(dashboard, /Turnover this week/);
  assert.match(dashboard, /All-time turnover/);
  assert.match(dashboard, /No learning gates/);
  assert.match(dashboard, /Continue learning/);
  assert.match(dashboard, /Upcoming live/);
  assert.match(page, /member_dashboard_turnover/);
});

test("only influencers and moderators can update the shared figures", async () => {
  const [migration, action, editor] = await Promise.all([
    read("supabase/migrations/20260804000000_member_dashboard_turnover.sql"),
    read("src/app/dashboard/actions.ts"),
    read("src/components/dashboard/TurnoverMetricsEditor.tsx"),
  ]);

  assert.match(migration, /platform_role in \('influencer', 'moderator'\)/);
  assert.match(migration, /enable row level security/);
  assert.match(action, /\["influencer", "moderator"\]/);
  assert.match(action, /turnoverThisWeek > allTimeTurnover/);
  assert.match(editor, /Published immediately to every member dashboard/);
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
    read("src/app/dashboard/loading.tsx"),
    read("src/app/creator/loading.tsx"),
    read("src/app/dashboard/layout.tsx"),
    read("src/app/creator/layout.tsx"),
    read("src/components/layout/AppShell.tsx"),
  ]);

  assert.match(dashboardLoading, /aria-busy="true"/);
  assert.match(dashboardLoading, /MetricSkeleton/);
  assert.match(creatorLoading, /MetricSkeleton/);
  assert.doesNotMatch(dashboardLayout, /requireActiveMembership/);
  assert.doesNotMatch(creatorLayout, /requireInfluencerWorkspace/);
  assert.doesNotMatch(appShell, /window\.setTimeout\(\(\) => \{ void loadNotifications\(false\); \}, 0\)/);
});
