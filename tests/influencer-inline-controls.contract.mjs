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

test("creator wrappers reuse shared pages with creator workspace access", () => {
  const creatorPage = read("src/app/creator/page.tsx");
  const creatorDashboard = read("src/app/creator/dashboard/page.tsx");
  const creatorCourses = read("src/app/creator/courses/page.tsx");
  const creatorLesson = read("src/app/creator/courses/lesson/[id]/page.tsx");
  const access = read("src/lib/supabase/access.ts");

  assert.match(creatorPage, /renderCommunityPage/);
  assert.match(creatorDashboard, /renderDashboardPage/);
  assert.match(creatorCourses, /renderCoursesPage/);
  assert.match(creatorLesson, /creatorWorkspace: true/);
  assert.match(access, /export async function requireInfluencerWorkspace/);
});

test("shared UI uses creator-prefixed navigation and keeps influencer controls", () => {
  const nav = read("src/lib/navigation/app-nav.ts");
  const shell = read("src/components/layout/AppShell.tsx");
  const dashboard = read("src/components/dashboard/DashboardView.tsx");
  const learning = read("src/components/courses/LearningPathView.tsx");
  const events = read("src/components/events/EventsView.tsx");

  assert.match(nav, /routeBase/);
  assert.match(shell, /params\.set\("base", routeBase\)/);
  assert.match(dashboard, /withRouteBase\(routeBase, `\/courses\/lesson\/\$\{data\.activeLesson\.id\}`\)/);
  assert.match(learning, /data\.platformRole === "influencer"/);
  assert.match(learning, /Add lesson/);
  assert.match(events, /Create event/);
  assert.match(events, /Publish Zoom link/);
});
