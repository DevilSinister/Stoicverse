import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

/**
 * The rail's job is to be the *same* navigation on both sides of a boundary
 * that used to swap the whole frame. These assertions are about that: one
 * component, one list, mounted twice.
 */

test("one rail, mounted by both shells", async () => {
  const [appShell, channelsShell] = await Promise.all([
    read("src/components/layout/AppShell.tsx"),
    read("src/components/channels/ChannelsShell.tsx"),
  ]);

  for (const [name, source] of [["AppShell", appShell], ["ChannelsShell", channelsShell]]) {
    assert.match(source, /import \{ AppRail \} from "@\/components\/layout\/AppRail"/, `${name} must mount the shared rail`);
    assert.match(source, /<AppRail/, `${name} must render it`);
  }

  // The failure this prevents: a second rail written for the chat client
  // because the workspace one "did not fit". Two rails is the bug the rail
  // was built to remove.
  assert.equal(existsSync(new URL("../src/components/channels/ChannelRail.tsx", import.meta.url)), false);
});

test("the rail is the only nav list, and the old sidebar nav is gone", async () => {
  const appShell = await read("src/components/layout/AppShell.tsx");

  // `buildAppNav` kept two divergent lists — hardcoded absolute paths on one
  // branch, `withRouteBase` on the other, and one destination labelled
  // "Channels" for a creator and "Communities" for a member.
  assert.doesNotMatch(appShell, /buildAppNav/);
  assert.doesNotMatch(appShell, /Workspace navigation/, "the 16rem nav list moved into the rail");
});

test("every destination is a peer — nothing is nested under Community", async () => {
  const rail = await read("src/lib/navigation/rail.ts");

  // Courses and Events are their own rail icons, not sub-navigation of the
  // community. `buildRail`'s behaviour is covered in navigation-rail.test.mjs;
  // this pins the shape of the module itself.
  assert.match(rail, /export function buildRail/);
  assert.doesNotMatch(rail, /children\s*:/, "a rail item may not contain other items");
  assert.doesNotMatch(rail, /parent\s*:/, "a rail item may not name a parent");
});

test("the avatar is the account-settings control, not a menu containing one", async () => {
  const rail = await read("src/components/layout/AppRail.tsx");

  assert.match(rail, /accountHref/);
  assert.match(rail, /account settings/);
  // A dropdown here would put a click between somebody and their own account,
  // and would be the second place sign-out could live.
  assert.doesNotMatch(rail, /DropdownMenu/);
});

test("the creator can reach their own account and therefore sign out", async () => {
  const [account, settings, workspace] = await Promise.all([
    read("src/app/creator/account/page.tsx"),
    read("src/app/dashboard/settings/page.tsx"),
    read("src/components/settings/AccountSettingsWorkspace.tsx"),
  ]);

  // One renderer behind two guards, rather than a duplicated page.
  assert.match(account, /renderAccountSettings\(\{ searchParams, creatorWorkspace: true \}\)/);
  assert.match(settings, /export async function renderAccountSettings/);
  assert.match(settings, /requireInfluencerWorkspace\("\/creator\/account"\)/);

  // The workspace rewrites the URL when a section changes. Hardcoding
  // /dashboard/settings there would bounce a creator to /creator via proxy.ts
  // the moment they clicked a second section.
  assert.match(workspace, /basePath = "\/dashboard\/settings"/);
  assert.doesNotMatch(workspace, /router\.replace\(`\/dashboard\/settings\?/);
});

test("the community's own name and logo reach the rail", async () => {
  const branding = await read("src/lib/navigation/use-community-branding.ts");

  // `community_branding()` shipped granted to anon and authenticated and was
  // never called, so a creator could set a name and upload a logo that no
  // member would ever see.
  assert.match(branding, /rpc\("community_branding"\)/);
  // The bucket is public, so this is string construction rather than a signed
  // round trip on every render.
  assert.match(branding, /getPublicUrl/);
});

test("Master Zone is gated on the tier, on both sides of the boundary", async () => {
  const layout = await read("src/app/channels/layout.tsx");

  // Without this read the icon would exist in the workspace and vanish inside
  // /channels, which reads as the product losing a destination.
  assert.match(layout, /member_tiers/);
  assert.match(layout, /isMaster=\{Boolean\(tier\.data\?\.is_master\)\}/);
});
