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
    "src/components/channels/MessageMenu.tsx",
    "src/components/channels/ThreadPanel.tsx",
    "src/components/channels/ChannelHeaderPopovers.tsx",
    "src/components/channels/SearchBar.tsx",
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

// --------------------------------------------------------------- phase P2

test("the thread list goes through an RPC, never the threads table", async () => {
  // `public.threads` has a view_channel policy that would make a direct read
  // safe today. The member path still reads functions, because a table whose
  // policy is one clause away from a staff gate is the bug class that layer
  // exists to prevent.
  const loader = await readCode("src/lib/community/messages.ts");
  assert.equal(/\.from\("threads"\)/.test(loader), false);
  assert.match(loader, /rpc\("community_channel_threads"/);

  const migration = await read("supabase/migrations/20260912090000_community_channel_threads.sql");
  // Security invoker: threads_read already answers who may see a thread, and a
  // definer here would be a second copy of that rule free to drift from it.
  assert.match(migration, /security invoker/);
  // A function is executable by PUBLIC unless that is revoked.
  assert.match(migration, /revoke execute on function public\.community_channel_threads\(uuid\) from public, anon/);
  assert.match(migration, /set search_path to 'public', 'pg_temp'/);
});

test("the thread migration has a rollback that says what it breaks", async () => {
  const down = await read("supabase/rollback/20260912090000_community_channel_threads.down.sql");
  assert.match(down, /drop function if exists public\.community_channel_threads/);
  assert.match(down, /thread list popover/i);
});

test("a deletion carries the reason the case log will record", async () => {
  const actions = await readCode("src/app/community/actions.ts");
  assert.match(actions, /export async function deleteMessage\(postId: string, reason\?: string\)/);
  assert.match(actions, /delete_reason: clean === "" \? null : clean/);

  // The menu asks only when the reason is going into somebody else's case.
  const menu = await readCode("src/components/channels/MessageMenu.tsx");
  assert.match(menu, /deleteMessage\(message\.id, actions\.removeNeedsReason \? reason : undefined\)/);
});

test("the thread panel subscribes on the thread, not on the channel", async () => {
  const provider = await read("src/components/channels/CommunityProvider.tsx");
  // A busy channel would otherwise wake every open thread panel for every
  // message posted outside it, each one refetching to learn nothing changed.
  assert.match(provider, /export function useThreadLive/);
  assert.match(provider, /table: "posts", filter: `thread_id=eq\.\$\{threadId\}`/);
});

test("a thread is client state in the URL, not a parallel route", async () => {
  const view = await readCode("src/components/channels/ChannelView.tsx");
  // A parallel route re-runs the channel's server render — a full page of
  // messages refetched — every time somebody opens or closes the side panel.
  assert.match(view, /router\.replace\(query \? `\$\{pathname\}\?\$\{query\}` : pathname, \{ scroll: false \}\)/);
  assert.equal(/@thread/.test(view), false);

  // The URL is a mirror of the state, not its source. Reading the param on
  // every render lost the panel whenever a server action revalidated: the
  // router update landed after router.replace and reset the query. Seeded
  // once, so a shared link still opens the thread.
  assert.match(view, /useState<string \| null>\(\(\) => params\.get\("thread"\)\)/);
  const afterSeed = view.slice(view.indexOf("const openThread = useCallback"));
  assert.equal(/params\.get\("thread"\)/.test(afterSeed), false, "the open thread must not be re-read from the URL");
});

test("a jump walks back a bounded number of pages, then says so", async () => {
  const view = await readCode("src/components/channels/ChannelView.tsx");
  assert.match(view, /JUMP_PAGE_BUDGET/);
  // Silence would be indistinguishable from a broken link.
  assert.match(view, /further back than this view reaches/);
});

test("a thread reply needs its own permission, not the channel's", async () => {
  const permissions = await readCode("src/lib/channels/permissions.ts");
  assert.match(permissions, /canSendInThread: !blocked && has\(permissions, "send_messages_in_threads"\)/);

  const panel = await readCode("src/components/channels/ThreadPanel.tsx");
  // An announcement channel is read-only at the top level and still takes
  // replies in its threads, which is most of why a thread there is useful.
  assert.match(panel, /permissions\.canSendInThread/);
  assert.match(panel, /threadId=\{threadId\}/);
});

test("the header panels load when opened, not with the page", async () => {
  const popovers = await readCode("src/components/channels/ChannelHeaderPopovers.tsx");
  // Two extra round trips on every channel open, for panels most visits never
  // touch, is a cost the header should not impose. Asserted on the trigger
  // rather than on the exact statement: the first version of this checked the
  // literal line, so refactoring the effect into an open handler broke a test
  // of behaviour that had not changed.
  assert.match(popovers, /onOpenChange = \(next: boolean\)/);
  assert.match(popovers, /if \(next\) reload\(\);/);
  // And nothing loads it on mount.
  assert.equal(/useEffect/.test(popovers), false);

  // Every open, not only the first. Caching forever meant pinning a message
  // and then opening this panel showed the list from before the pin, with no
  // way to correct it short of reloading the page.
  assert.equal(/loadedRef/.test(popovers), false, "the panel must not cache across opens");

  // And a pin can be removed from the list that shows the pins.
  assert.match(popovers, /togglePostHighlight\(postId\)/);
  assert.match(popovers, /aria-label=\{`Unpin the message from/);
  assert.match(popovers, /rpc\("community_channel_pins"/);
  assert.match(popovers, /rpc\("community_channel_threads"/);
});

// --------------------------------------------------------------- phase P3

test("search filters narrow the query, never the page", async () => {
  // The RPC returns one page of 25. Filtering after the fact shows two results
  // out of a page and a "load more" that behaves at random.
  const migration = await read("supabase/migrations/20260912100000_community_search_filters.sql");
  assert.match(migration, /drop function if exists public\.community_search_messages\(text, uuid, timestamptz, integer\)/);
  assert.match(migration, /author uuid default null/);
  assert.match(migration, /after_created_at timestamptz default null/);
  assert.match(migration, /has text default null/);
  assert.match(migration, /revoke execute on function public\.community_search_messages\(text, uuid, timestamptz, integer, uuid, timestamptz, text\) from public, anon/);

  const loader = await readCode("src/lib/community/messages.ts");
  assert.match(loader, /author: options\.authorId \?\? null/);
  assert.match(loader, /has: options\.has \?\? null/);
});

test("the old search signature is dropped, not left as an overload", async () => {
  // Two arities and PostgREST picks between them by the argument names a
  // caller happened to send, which is a coin toss nobody would ever debug.
  const migration = await read("supabase/migrations/20260912100000_community_search_filters.sql");
  const dropAt = migration.indexOf("drop function if exists public.community_search_messages(text, uuid, timestamptz, integer)");
  const createAt = migration.indexOf("create or replace function public.community_search_messages");
  assert.ok(dropAt > -1 && dropAt < createAt, "the four-argument function must be dropped before the new one is created");

  const down = await read("supabase/rollback/20260912100000_community_search_filters.down.sql");
  assert.match(down, /drop function if exists public\.community_search_messages\(text, uuid, timestamptz, integer, uuid, timestamptz, text\)/);
  assert.match(down, /create or replace function public\.community_search_messages/);
});

test("an unresolved filter stops the search instead of running it", async () => {
  const bar = await readCode("src/components/channels/SearchBar.tsx");
  // A search that silently drops `from:someone` returns everybody's messages
  // and looks like it worked.
  assert.match(bar, /if \(!parsed\.runnable\)/);
  assert.match(bar, /setProblems\(parsed\.problems\)/);
  // And a slow first request must not land on a fast second one.
  assert.match(bar, /if \(ticket !== runRef\.current\) return;/);
});

test("unread listens across the community, and marking read is debounced", async () => {
  const unread = await readCode("src/components/channels/useUnread.ts");
  // The point of an unread badge is the channel you are not looking at, so
  // this subscription deliberately carries no channel filter.
  assert.match(unread, /table: "posts" \}, schedule/);
  assert.match(unread, /table: "channel_read_states" \}, schedule/);
  assert.match(unread, /setTimeout\(\(\) => void reread\(\), SETTLE_MS\)/);

  const view = await readCode("src/components/channels/ChannelView.tsx");
  // A write per arriving message in a busy channel, and scrolling past the
  // bottom on the way elsewhere is not reading.
  assert.match(view, /markChannelRead\(channel\.id, newest\.id\)/);
  assert.match(view, /document\.visibilityState !== "visible" \|\| !atBottomRef\.current/);
  assert.match(view, /\}, 1500\)/);
  // An optimistic id is a nonce; marking read against it would fail.
  assert.match(view, /newest\.id\.startsWith\("optimistic-"\)/);
});

test("the NEW divider is frozen when the channel opens", async () => {
  const view = await readCode("src/components/channels/ChannelView.tsx");
  // A divider that moved as you read would sit permanently at the bottom.
  assert.match(view, /const \[readBoundary\] = useState<string \| null>/);
  assert.match(view, /firstUnreadIndex\(messages, readBoundary/);
  // Read from the live viewer state on every render and it would chase the
  // bottom as marking-read caught up.
  const afterFreeze = view.slice(view.indexOf("const rendered = useMemo"));
  assert.equal(/readStates/.test(afterFreeze), false);
});

test("muting dims the channel but never hides its mentions", async () => {
  const shell = await readCode("src/components/channels/ChannelsShell.tsx");
  // Muting says "do not shout at me", not "hide it from me".
  assert.match(shell, /const bold = channel\.hasUnread && !active && !muted/);
  assert.match(shell, /channel\.mentionCount > 0/);
  assert.match(shell, /setChannelNotificationLevel\(channel\.id, level\)/);
  // Date.now() during render is impure: an expiring mute would flip on any
  // re-render rather than on the clock.
  assert.equal(/Date\.now\(\)\s*[;)]/.test(shell.replace("useState(() => Date.now())", "")), false);
});

test("a message shows the thread hanging off it", async () => {
  // The original join was `threads.id = post.thread_id`, and the channel view
  // returns only posts whose `thread_id is null` — that clause is what keeps
  // thread replies out of the main list. So the join matched nothing, every
  // time, and the thread summary was structurally always null in a channel.
  //
  // The obvious repair is the wrong one: setting `posts.thread_id` on the root
  // post would make that join work and would delete the message from its own
  // channel. A thread hangs off its root post, so the join follows
  // `root_post_id`.
  const migration = await read("supabase/migrations/20260912110000_community_thread_summary.sql");
  assert.match(migration, /left join public\.threads started on started\.root_post_id = post\.id/);
  assert.match(migration, /left join public\.threads inside on inside\.id = post\.thread_id/);
  assert.match(migration, /coalesce\(started\.id, post\.thread_id\)/);
  assert.match(migration, /coalesce\(started\.name, inside\.name\)/);
  assert.match(migration, /coalesce\(started\.message_count, inside\.message_count\)/);

  // The clause that separates a channel from its threads must survive: without
  // it every thread reply floods the channel it was moved out of.
  assert.match(migration, /case when thread is null then post\.thread_id is null else post\.thread_id = thread end/);

  const down = await read("supabase/rollback/20260912110000_community_thread_summary.down.sql");
  assert.match(down, /left join public\.threads thread_row on thread_row\.id = post\.thread_id/);
});

test("the hover bar keeps its box while its own menu is open", async () => {
  // The menu and the emoji picker both portal to the body. Once the pointer
  // moves off the row and onto the menu, `group-hover` and `group-focus-within`
  // both go false; if the bar is `display: none` at that moment the trigger has
  // no bounding box, and the positioner re-measures a 0x0 anchor and drops the
  // menu in the top-left corner of the screen.
  const menu = await readCode("src/components/channels/MessageMenu.tsx");
  assert.match(menu, /menuOpen \|\| emojiOpen \? "flex" : "hidden group-focus-within:flex group-hover:flex"/);
  // The open state has to be controlled, or the bar cannot know to stay.
  assert.match(menu, /<DropdownMenu open=\{menuOpen\} onOpenChange=\{setMenuOpen\}>/);
});

test("the legacy community surface is still intact", async () => {
  // P1 builds the new page alongside the old one. The browser gate cannot run
  // until the dev-login service-role key is supplied, and deleting the only
  // working community UI in favour of an unverified replacement is not a
  // trade this phase is allowed to make on its own.
  const surface = await read("src/components/community/CommunitySurface.tsx");
  assert.ok(surface.length > 0);
});
