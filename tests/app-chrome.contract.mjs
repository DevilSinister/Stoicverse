/**
 * The chrome spine, pinned.
 *
 * P2a moved three overlays that the chrome owns — global search, the
 * notification preview and the mobile drawer — off hand-written implementations
 * and onto the primitives. Each of the three had lost something different, so
 * each gets an assertion naming what it lost rather than one blanket check.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) =>
  (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

// Assertions about what the code does must not match what a comment says: these
// files document the defects they replaced.
const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

test("the chrome owns no overlay of its own", async () => {
  const shell = stripComments(await read("src/components/layout/AppShell.tsx"));

  // The local Modal at :306 had no focus trap, no Escape and no scroll lock —
  // it closed on an outside mousedown and nothing else.
  assert.doesNotMatch(shell, /function Modal\(/, "the local Modal is gone, not restyled");
  assert.doesNotMatch(shell, /fixed inset-0/, "no hand-rolled scrim; the backdrop belongs to the primitive");
  assert.doesNotMatch(shell, /"Tab"/, "Base UI traps focus; the hand-written Tab cycle is gone");
  assert.doesNotMatch(shell, /\bz-\[\d+\]/, "portalled surfaces need no z-index");

  for (const primitive of [/from "@\/components\/ui\/overlay"/, /from "@\/components\/ui\/popover"/]) {
    assert.match(shell, primitive, "the chrome composes the shared primitives");
  }
});

test("search is reachable from the keyboard", async () => {
  const shell = stripComments(await read("src/components/layout/AppShell.tsx"));

  // The workspace had no binding at all: the only one in the product was
  // /channels' quick switcher, which is a different surface entirely.
  assert.match(shell, /ctrlKey \|\| event\.metaKey/, "Ctrl and Cmd both open search");
  assert.match(shell, /toLowerCase\(\) !== "k"/);
  assert.match(shell, /ArrowDown/, "the result list is navigable without a pointer");
  assert.match(shell, /ArrowUp/);
});

test("the rail draws labels wherever hover does not exist", async () => {
  const rail = stripComments(await read("src/components/layout/AppRail.tsx"));
  const shell = stripComments(await read("src/components/layout/AppShell.tsx"));

  /*
    A tooltip is the whole reason an icon rail can be 4.5rem wide. It is also
    unreachable on a touch screen, so rendering the icons-only rail inside a
    phone drawer left the entire primary navigation as nine unnamed glyphs.
  */
  assert.match(rail, /variant\?: RailVariant/, "the rail has a labelled shape");
  assert.match(shell, /variant="drawer"/, "and the mobile drawer asks for it");

  /*
    /channels has a drawer of its own and it carries two levels of navigation at
    once, so a full-width labelled row does not fit. `stack` is the same list as
    a labelled icon column. The label is `text-chrome-xs` - the 11px floor - and
    is pinned here because shrinking it is the obvious way to buy the width back.
  */
  const channels = stripComments(await read("src/components/channels/ChannelsShell.tsx"));
  assert.match(channels, /variant="stack"/, "the channels drawer asks for the labelled column");
  assert.match(rail, /line-clamp-2 text-chrome-xs/, "and its label wraps rather than going under 11px");

  // One list, three presentations. A second array here is how a destination
  // comes to exist in one variant and not the others.
  const buildRailCalls = rail.match(/buildRail\(/g) ?? [];
  assert.equal(buildRailCalls.length, 1, "every variant renders the same buildRail list");
});

test("two bells cannot open one panel each into the same screen", async () => {
  const shell = stripComments(await read("src/components/layout/AppShell.tsx"));

  /*
    The breakpoint hides a header with `display`, not by unmounting it, so both
    bells are always mounted. They shared one `open` state, and a popup portals
    to <body> - so opening the visible bell opened the hidden one's panel too
    and the product drew two. Each bell owns its state now; the hidden one's
    trigger is unclickable, so nothing can open it.
  */
  const mounts = shell.match(/<NotificationBell /g) ?? [];
  assert.equal(mounts.length, 2, "one bell per header");
  assert.doesNotMatch(shell, /open=\{notificationsOpen\}/, "and no shared open state between them");
  assert.match(shell, /const \[open, setOpen\] = useState\(false\);/, "the bell holds its own");
});

test("every role's notification bell points somewhere that role may go", async () => {
  const rail = stripComments(await read("src/lib/navigation/rail.ts"));
  const proxy = await read("proxy.ts");

  /*
    The rail sent every role to /dashboard/notifications, and `proxy.ts` bounces
    an influencer off every /dashboard route - so a creator pressing
    Notifications was redirected to /creator and their notifications could not
    be reached from anywhere in the product.
  */
  assert.match(rail, /href: `\$\{base\}\/notifications`/, "the rail's notifications entry is per-role");
  assert.doesNotMatch(rail, /href: "\/dashboard\/notifications"/);
  assert.match(proxy, /requiresMembership && isInfluencer/, "which matters because the proxy still bounces them");
});

test("the active marker composites instead of laying out", async () => {
  const rail = stripComments(await read("src/components/layout/AppRail.tsx"));

  // It was `transition-all` across h-0 -> h-8, which animates layout on every
  // navigation. A fixed height and a scaleY does not.
  assert.match(rail, /scale-y-0/);
  assert.match(rail, /scale-y-100/);
  assert.match(rail, /transition-transform/);
  assert.doesNotMatch(rail, /transition-all/, "no layout-animating transition in the rail");
});

test("the chrome is a hairline, and the badge is on-palette", async () => {
  const rail = stripComments(await read("src/components/layout/AppRail.tsx"));
  const shell = stripComments(await read("src/components/layout/AppShell.tsx"));

  for (const [name, source] of [
    ["AppRail", rail],
    ["AppShell", shell],
  ]) {
    // Tailwind's default red was the last off-palette colour in the chrome.
    assert.doesNotMatch(source, /bg-red-\d00/, `${name} uses the status token, not a default palette red`);
  }

  // 64px of lighter fill over a darker page reads as a second surface; 48px on
  // the same canvas reads as an edge.
  assert.doesNotMatch(shell, /<header[^>]*h-16/, "both headers are one chrome bar tall");
  const chromeBars = shell.match(/h-chrome-bar/g) ?? [];
  assert.equal(chromeBars.length, 2, "the mobile header and the desktop header, both on the token");

  // Without these the phone header sits under the notch and the status bar.
  assert.match(shell, /safe-t safe-x/, "the mobile header clears the safe area");
});
