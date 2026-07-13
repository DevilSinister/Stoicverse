import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("proxy and auth callback route influencers into the creator namespace", () => {
  const proxy = read("proxy.ts");
  const callback = read("src/app/auth/callback/route.ts");

  assert.match(proxy, /const creatorRoute = "\/creator"/);
  assert.match(proxy, /mapMemberRouteToCreator/);
  assert.match(proxy, /requiresMembership && isInfluencer/);
  assert.match(proxy, /destination = next\?\.startsWith\(creatorRoute\) \? next : creatorRoute/);
  assert.match(callback, /NextResponse\.redirect\(new URL\("\/creator"/);
});

test("creator pages use creator-only routes and workspace access", () => {
  const creatorPage = read("src/app/creator/page.tsx");
  const creatorDashboard = read("src/app/creator/dashboard/page.tsx");
  const creatorCourses = read("src/app/creator/courses/page.tsx");
  const creatorEvents = read("src/app/creator/events/page.tsx");
  const creatorLesson = read("src/app/creator/courses/lesson/[id]/page.tsx");
  const access = read("src/lib/supabase/access.ts");

  assert.match(creatorPage, /requireInfluencerWorkspace/);
  assert.match(creatorDashboard, /requireInfluencerWorkspace/);
  assert.match(creatorCourses, /CreatorCoursesView/);
  assert.match(creatorEvents, /CreatorEventsView/);
  assert.match(creatorLesson, /requireInfluencerWorkspace/);
  assert.match(access, /export async function requireInfluencerWorkspace/);
});

test("member screens are clean while creator screens own the management controls", () => {
  const nav = read("src/lib/navigation/app-nav.ts");
  const shell = read("src/components/layout/AppShell.tsx");
  const dashboard = read("src/components/dashboard/DashboardView.tsx");
  const memberLearning = read("src/components/courses/LearningPathView.tsx");
  const memberEvents = read("src/components/events/EventsView.tsx");
  const creatorLearning = read("src/components/creator/CreatorCoursesView.tsx");
  const creatorEvents = read("src/components/creator/CreatorEventsView.tsx");

  assert.match(nav, /routeBase/);
  assert.match(shell, /params\.set\("base", routeBase\)/);
  assert.match(dashboard, /withRouteBase\(routeBase, `\/courses\/lesson\/\$\{data\.activeLesson\.id\}`\)/);
  assert.doesNotMatch(memberLearning, /Add lesson/);
  assert.doesNotMatch(memberEvents, /Create event/);
  assert.doesNotMatch(memberEvents, /Publish Zoom link/);
  assert.match(creatorLearning, /Add lesson/);
  assert.match(creatorEvents, /Create event/);
  assert.match(creatorEvents, /Publish Zoom link/);
});
