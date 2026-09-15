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
  const nav = read("src/lib/navigation/rail.ts");
  const shell = read("src/components/layout/AppShell.tsx");
  /*
    The live dashboard, not `DashboardView.tsx`.

    That file used to hold `LegacyDashboardView`, a second complete dashboard
    with no importer, and this assertion was pinned to a template literal inside
    it — so it was testing a screen nobody could reach. Phase 7 deleted it;
    `DashboardView.tsx` is now the type surface plus a re-export.

    What the assertion is actually for is that the member dashboard's course
    link respects the viewer's route base, so the creator's copy of the screen
    points at `/creator/courses/...` rather than a member route their own proxy
    refuses. The live screen does that through `withRouteBase`, which is
    stronger than the hard-coded path this used to match.
  */
  const dashboard = read("src/components/dashboard/TerminalDashboard.tsx");
  const memberLearning = read("src/components/courses/CourseCatalog.tsx");
  const memberEvents = read("src/components/events/EventsView.tsx");
  const creatorLearning = read("src/components/creator/CreatorCourseManagerV2.tsx");
  const creatorEvents = read("src/components/creator/CreatorEventsView.tsx");

  assert.match(nav, /routeBase/);
  assert.match(shell, /params\.set\("base", routeBase\)/);
  assert.match(dashboard, /withRouteBase\(routeBase, courseId \? `\/courses\/\$\{courseId\}`/);
  assert.match(dashboard, /courseHref\(data\.activeLesson\?\.id\)/);
  assert.doesNotMatch(memberLearning, /Add lesson/);
  assert.doesNotMatch(memberEvents, /Create event/);
  assert.doesNotMatch(memberEvents, /Publish Zoom link/);
  assert.match(creatorLearning, /Create Course/);
  assert.match(creatorLearning, /Add Video/);
  assert.match(creatorLearning, /Finish Course/);
  assert.match(creatorEvents, /Create event/i);
  assert.match(creatorEvents, /Publish (room )?link/i);
});

test("member and creator route trees expose separate navigation and guards", () => {
  const nav = read("src/lib/navigation/rail.ts");
  const memberAccess = read("src/lib/supabase/access.ts");
  const memberCommunity = read("src/app/community/page.tsx");

  for (const path of ["events", "courses", "community", "notifications", "settings"]) {
    assert.match(read(`src/app/dashboard/${path}/page.tsx`), /requireActiveMembership|render/);
  }
  assert.match(read("src/app/dashboard/messages/page.tsx"), /permanentRedirect\("\/channels"\)/);
  /*
    Follows the delegation rather than requiring the call to be inline.

    Two creator routes - /creator/account and /creator/notifications - are the
    member page's renderer behind the influencer guard, which is how the
    duplicate screens phase 9 deleted stay deleted. Matching only on the guard's
    name in the page file would push those back into being copies; matching on
    "render" alone would let an unguarded page pass by mentioning the word. So:
    the guard is either here, or in the module this page imports its renderer
    from, and that module is read and checked.
  */
  for (const path of ["members", "analytics", "revenue", "settings", "notifications"]) {
    const page = read(`src/app/creator/${path}/page.tsx`);
    if (/requireInfluencerWorkspace/.test(page)) continue;

    const delegate = page.match(/import \{ (render\w+) \} from "@\/(app\/[^"]+)"/);
    assert.ok(delegate, `src/app/creator/${path}/page.tsx must guard itself or delegate to a renderer`);
    const source = read(`src/${delegate[2]}.tsx`);
    assert.match(source, /requireInfluencerWorkspace/, `${delegate[2]} guards the creator path`);
    assert.match(source, new RegExp(`${delegate[1]}`), "and exports the renderer the page imports");
  }
  assert.match(read("src/app/creator/channels/page.tsx"), /permanentRedirect\("\/creator\/settings\?section=channels"\)/);
  // The rail carries these, and "Overview" is now "Dashboard" — one label for
  // the home slot rather than a different word per role.
  assert.match(nav, /label: "Dashboard"/);
  assert.match(nav, /label: "Revenue"/);
  assert.match(nav, /"Community settings"/);
  assert.doesNotMatch(nav, /label: "Messages"/);
  // Phase 9: one community surface. The member and the creator both land on
  // /channels, and the directory RPC — not a per-workspace branch — is what
  // decides which channels either of them is shown.
  assert.match(memberCommunity, /redirect\("\/channels"\)/);
  assert.match(read("src/app/channels/layout.tsx"), /community_channel_directory/);
  // `platformRole`, camelCase, since the guards read the request-cached
  // profile rather than a raw PostgREST row.
  assert.match(memberAccess, /profile\?\.platformRole === "influencer"/);
});
