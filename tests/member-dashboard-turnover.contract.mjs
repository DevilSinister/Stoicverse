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

/**
 * This test used to assert the opposite of two lines below: that neither
 * workspace layout ran an access check. That was right while the layouts were
 * pass-throughs — an `await` in a layout delays the `loading.tsx` fallback
 * beneath it, so a layout that reads for no reason costs a skeleton.
 *
 * The layouts own the chrome now, which is what keeps the rail on screen
 * through a navigation instead of tearing it down with the outgoing page, and
 * chrome cannot be drawn without knowing who is looking at it. So the rule
 * changed rather than lapsed, and what replaces it is stricter: a layout may
 * read, but only through the request-cached viewer helpers, so the guard every
 * page below still runs costs nothing the second time. A layout reaching for
 * `supabase.from(...)` directly would put back exactly the duplicate round
 * trip this work removed.
 */
test("workspace layouts own the chrome and read it through the request cache", async () => {
  const [dashboardLoading, creatorLoading, dashboardLayout, creatorLayout, skeletons, appShell] = await Promise.all([
    read("src/app/dashboard/loading.tsx"), read("src/app/creator/loading.tsx"), read("src/app/dashboard/layout.tsx"),
    read("src/app/creator/layout.tsx"), read("src/components/layout/Skeletons.tsx"), read("src/components/layout/AppShell.tsx"),
  ]);

  // The skeleton is the content's shape, drawn inside chrome already on
  // screen — so it must not paint a page of its own.
  assert.match(dashboardLoading, /OverviewSkeleton/);
  assert.match(creatorLoading, /OverviewSkeleton/);
  assert.doesNotMatch(dashboardLoading, /min-h-screen/);
  assert.doesNotMatch(creatorLoading, /min-h-screen/);
  assert.match(skeletons, /aria-busy="true"/);
  assert.match(skeletons, /role="status"/);

  // The chrome belongs to the layout, which is what makes it survive a
  // navigation: Next re-renders only below the layout two routes share.
  for (const layout of [dashboardLayout, creatorLayout]) {
    assert.match(layout, /<AppShell/);
    assert.match(layout, /currentProfile\(\)/);
    assert.doesNotMatch(layout, /supabase\s*\n?\s*\.from\(/);
  }
  assert.match(dashboardLayout, /requireActiveMembership/);
  assert.match(creatorLayout, /requireInfluencerWorkspace/);

  assert.doesNotMatch(appShell, /window\.setTimeout\(\(\) => \{ void loadNotifications\(false\); \}, 0\)/);
});

/**
 * Why a page may call a guard the layout above it already called.
 *
 * A layout is not an access boundary in the App Router — a client navigation
 * renders a page without re-rendering the layout — so the pages keep their
 * guards. That is only affordable because identity is verified from the token
 * in process and the profile behind it is read once per request.
 */
test("identity is verified in process and read once per request", async () => {
  const [viewer, server, access] = await Promise.all([
    read("src/lib/supabase/viewer.ts"), read("src/lib/supabase/server.ts"), read("src/lib/supabase/access.ts"),
  ]);

  // `getClaims` verifies the ES256 signature against a cached JWKS. `getUser`
  // was an HTTP round trip to the auth server on every single request.
  assert.match(viewer, /auth\.getClaims\(\)/);
  assert.doesNotMatch(access, /auth\.getUser\(\)/);

  // Request-scoped, so a guard and the page it guards share one read.
  assert.match(viewer, /^import \{ cache \} from "react";/m);
  assert.match(server, /export const createClient = cache\(/);
  for (const name of ["currentViewer", "currentProfile", "currentIsMaster", "profileRow", "unreadNotificationCount"]) {
    assert.match(viewer, new RegExp(`export const ${name} = cache\\(`));
  }
});
