import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

/**
 * The same file with comments stripped.
 *
 * These files explain their decisions in prose, and the prose names the thing
 * it decided against — "rather than requireActiveMembership", "never
 * dangerouslySetInnerHTML". An assertion reading the raw text matches the
 * explanation and fails on a file that is correct, which is a test pushing the
 * code toward being less well explained.
 */
const readCode = async (path) =>
  (await read(path)).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("the community route is gated on access, never on role", async () => {
  const proxy = await read("proxy.ts");
  // `requireActiveMembership` and the proxy's role redirects both send an
  // influencer to /creator. If /channels were treated as a member route, the
  // creator could never open their own community.
  assert.match(proxy, /const communityRoutes = \["\/channels"\]/);
  assert.match(proxy, /if \(isCommunityRoute\) \{/);

  const communityCheckAt = proxy.indexOf("if (isCommunityRoute) {");
  const adminRedirectAt = proxy.indexOf("if (isAdminRoute && !isAdmin)");
  assert.ok(
    communityCheckAt > -1 && communityCheckAt < adminRedirectAt,
    "the community route must return before the role redirects below it",
  );

  // Still gated: an expired member does not get in.
  assert.match(proxy, /!hasMemberWorkspaceAccess && !isInfluencer && !isAdmin/);
});

test("the layout uses the community access helper, not the member one", async () => {
  const layout = await readCode("src/app/channels/layout.tsx");
  assert.match(layout, /requireCommunityAccess/);
  assert.equal(/requireActiveMembership/.test(layout), false);
});

test("the layout reads its three sources together, not in sequence", async () => {
  const layout = await read("src/app/channels/layout.tsx");
  // Three independent reads, and nothing can paint until all three land, so
  // awaiting them one at a time is three round trips of blank screen.
  assert.match(layout, /Promise\.all\(\[/);
  assert.match(layout, /loadViewerState/);
  assert.match(layout, /community_channel_directory/);
  assert.match(layout, /loadMemberDirectory/);
});

test("a message body never reaches the DOM as HTML", async () => {
  // A message body is the most attacker-facing string in the product: anyone
  // who can post controls it.
  const render = await readCode("src/lib/markdown/render.tsx");
  assert.equal(/dangerouslySetInnerHTML/.test(render), false);
  assert.match(render, /rel="noopener noreferrer nofollow ugc"/);
});

test("paging and refreshing go through the browser rpc, not a server action", async () => {
  const view = await read("src/components/channels/ChannelView.tsx");
  // Next 16 dispatches server actions sequentially per client. Scrolling up
  // twice quickly would queue the second read behind the first.
  assert.match(view, /rpc\("community_channel_messages"/);
  const pagingRegion = view.slice(view.indexOf("const loadOlder"));
  assert.equal(/await loadChannelMessages/.test(pagingRegion), false);
});

test("realtime subscriptions are filtered by channel", async () => {
  const provider = await read("src/components/channels/CommunityProvider.tsx");
  // This is why phase 8 put `channel_id` on `reactions`. Unfiltered, a
  // reaction anywhere in the community wakes every open channel.
  assert.match(provider, /table: "posts", filter: `channel_id=eq\.\$\{channelId\}`/);
  assert.match(provider, /table: "reactions", filter: `channel_id=eq\.\$\{channelId\}`/);
});

test("an optimistic message is reconciled by nonce, not appended twice", async () => {
  const provider = await read("src/components/channels/CommunityProvider.tsx");
  assert.match(provider, /export function mergeMessage/);
  assert.match(provider, /message\.clientNonce === incoming\.clientNonce/);

  const composer = await read("src/components/channels/Composer.tsx");
  assert.match(composer, /clientNonce/);
  // A refused send must put the draft back rather than lose what was typed.
  assert.match(composer, /setBody\(encoded\)/);
});

test("the composer stores ids and shows names", async () => {
  const composer = await read("src/components/channels/Composer.tsx");
  // Renaming a member must not break a message written last month.
  assert.match(composer, /encodeMentions\(body\.trim\(\), dictionary\)/);
});

test("an upload is written where the storage policy can read the channel", async () => {
  const composer = await read("src/components/channels/Composer.tsx");
  // `community_posts_member_upload` parses the channel out of the second path
  // segment. A different shape uploads fine and then fails every read.
  assert.match(composer, /\$\{viewer\.userId\}\/\$\{channel\.id\}\//);
  // `accept=` is bypassed by drag-and-drop and paste, so the type is checked
  // in code as well.
  assert.match(composer, /isAllowedAttachmentType/);
});

test("a locked channel is a teaser, never a page", async () => {
  const shell = await read("src/components/channels/ChannelsShell.tsx");
  const page = await read("src/app/channels/[channelId]/page.tsx");
  // Landing on an empty conversation reads as broken; landing on a teaser as
  // your first impression of the community reads as a paywall.
  assert.match(shell, /if \(channel\.isLocked\)/);
  assert.match(page, /if \(row\.is_locked\) redirect\("\/channels"\)/);
});

test("the dynamic channel path is revalidated with its type argument", async () => {
  const revalidate = await read("src/lib/community-settings/revalidate.ts");
  // A bare revalidatePath("/channels/[channelId]") is a silent no-op in Next
  // 16: every channel keeps serving the page it already had.
  assert.match(revalidate, /revalidatePath\("\/channels\/\[channelId\]", "page"\)/);
  assert.match(revalidate, /"\/channels",/);
});

test("every colour token the channel UI uses is actually defined", async () => {
  // A Tailwind class naming a token that does not exist produces no CSS and no
  // error: `bg-surface-container-highest` rendered a spoiler with transparent
  // text on a transparent background, so hidden content simply vanished. The
  // typechecker cannot see inside a string, and the build does not care, so
  // nothing but a human eye caught it. This is that eye.
  const css = await read("src/app/globals.css");
  const defined = new Set([...css.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]));

  const files = [
    "src/lib/markdown/render.tsx",
    "src/components/channels/ChannelsShell.tsx",
    "src/components/channels/ChannelView.tsx",
    "src/components/channels/Composer.tsx",
  ];

  // Utilities that share a prefix with a colour but never take one.
  const structural =
    /^(?:t|r|b|l|x|y|s|e|solid|dashed|dotted|double|hidden|none|current|transparent|inherit|white|black|\[.*\]|(?:t|r|b|l|x|y|s|e)-\d+|\d.*)$/;

  const offenders = [];
  for (const file of files) {
    const source = await readCode(file);
    for (const [, token] of source.matchAll(/(?:text|bg|border|ring|fill|stroke|decoration|outline)-([a-z][a-z0-9-]*)(?:\/\d+)?/g)) {
      if (structural.test(token)) continue;
      // Tailwind's own palette is always available.
      if (/^(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)$/.test(token)) continue;
      if (!defined.has(token)) offenders.push(`${file}: ${token}`);
    }
  }

  assert.deepEqual(offenders, [], `undefined colour tokens: ${offenders.join(", ")}`);
});

test("a link in a message is legible, not the shadcn surface accent", async () => {
  // `--color-accent` is redefined further down globals.css as the shadcn dark
  // surface, so `text-accent` painted links near-black on a near-black page.
  // The rest of the app uses `text-primary-container` for links; so does this.
  const render = await readCode("src/lib/markdown/render.tsx");
  assert.equal(/text-accent|bg-accent/.test(render), false);
  assert.match(render, /text-primary-container underline/);
});

test("the legacy community surface is still intact", async () => {
  // P1 builds the new page alongside the old one. The browser gate cannot run
  // until the dev-login service-role key is supplied, and deleting the only
  // working community UI in favour of an unverified replacement is not a
  // trade this phase is allowed to make on its own.
  const surface = await read("src/components/community/CommunitySurface.tsx");
  assert.ok(surface.length > 0);
});
