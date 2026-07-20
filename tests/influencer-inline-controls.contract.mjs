import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("proxy and auth callback route every role into its own workspace", () => {
  const proxy = read("proxy.ts");
  const callback = read("src/app/auth/callback/route.ts");

  assert.match(proxy, /const creatorRoute = "\/creator"/);
  assert.match(proxy, /const memberRoutes = \["\/dashboard"\]/);
  assert.match(proxy, /const adminRoutes = \["\/admin"\]/);
  assert.match(proxy, /requiresMembership && isInfluencer/);
  assert.match(proxy, /destination = next\?\.startsWith\(creatorRoute\) \? next : creatorRoute/);
  assert.match(callback, /NextResponse\.redirect\(new URL\("\/creator"/);
  assert.match(callback, /NextResponse\.redirect\(new URL\("\/admin"/);
});

test("canonical creator pages use creator-only routes and workspace access", () => {
  const creatorPage = read("src/app/creator/page.tsx");
  const creatorDashboard = read("src/app/creator/dashboard/page.tsx");
  const creatorCourses = read("src/app/creator/courses/page.tsx");
  const creatorEvents = read("src/app/creator/events/page.tsx");
  const creatorLesson = read("src/app/creator/courses/lesson/[id]/page.tsx");
  const access = read("src/lib/supabase/access.ts");

  assert.match(creatorPage, /CreatorDashboardPage/);
  assert.match(creatorDashboard, /requireInfluencerWorkspace/);
  assert.match(creatorCourses, /CreatorCourseManagerPageV2/);
  assert.match(creatorEvents, /CreatorEventsView/);
  assert.match(creatorLesson, /requireInfluencerWorkspace/);
  assert.match(access, /export async function requireInfluencerWorkspace/);
});

test("member screens are clean while creator screens own the management controls", () => {
  const nav = read("src/lib/navigation/app-nav.ts");
  const shell = read("src/components/layout/AppShell.tsx");
  const dashboard = read("src/components/dashboard/DashboardView.tsx");
  const memberLearning = read("src/components/courses/CourseCatalog.tsx");
  const memberEvents = read("src/components/events/EventsView.tsx");
  const creatorLearning = read("src/components/creator/CreatorCourseManagerV2.tsx");
  const creatorEvents = read("src/components/creator/CreatorEventsView.tsx");

  assert.match(nav, /routeBase/);
  assert.match(shell, /params\.set\("base", routeBase\)/);
  assert.match(dashboard, /`\/courses\/\$\{data\.activeLesson\.id\}`/);
  assert.doesNotMatch(memberLearning, /Add lesson/);
  assert.doesNotMatch(memberEvents, /Create event/);
  assert.doesNotMatch(memberEvents, /Publish Zoom link/);
  assert.match(creatorLearning, /Create Course/);
  assert.match(creatorLearning, /Add Video/);
  assert.match(creatorLearning, /Finish Course/);
  assert.match(creatorEvents, /Create Event/);
  assert.match(creatorEvents, /Publish (Room )?Link/);
});

test("member and creator route trees expose separate navigation and guards", () => {
  const nav = read("src/lib/navigation/app-nav.ts");
  const memberAccess = read("src/lib/supabase/access.ts");
  const memberCommunity = read("src/app/community/page.tsx");
  const communityWorkspace = read("src/components/community/CommunityWorkspace.tsx");

  for (const path of ["events", "courses", "community", "messages", "notifications", "settings"]) {
    assert.match(read(`src/app/dashboard/${path}/page.tsx`), /requireActiveMembership|render/);
  }
  for (const path of ["members", "analytics", "revenue", "settings", "notifications"]) {
    assert.match(read(`src/app/creator/${path}/page.tsx`), /requireInfluencerWorkspace/);
  }
  assert.match(read("src/app/creator/channels/page.tsx"), /renderCommunityWorkspace/);
  assert.match(nav, /label: "Overview"/);
  assert.match(nav, /label: "Revenue"/);
  assert.match(nav, /label: "Community settings"/);
  assert.match(nav, /label: "Messages"/);
  assert.match(memberCommunity, /redirect\("\/dashboard\/community"/);
  assert.match(communityWorkspace, /community_channel_directory/);
  assert.match(communityWorkspace, /workspace === "creator"/);
  assert.match(memberAccess, /profile\?\.platform_role === "influencer"/);
});
