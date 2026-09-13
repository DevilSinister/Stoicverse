/**
 * The Monolith token layer, pinned.
 *
 * Two kinds of assertion live here and they are different promises.
 *
 * The strict ones say a thing is gone and must stay gone. The ratchets say a
 * thing is on its way out and may only ever get smaller - the redesign retires
 * the remaining sites screen by screen, and a ratchet is what stops a new one
 * being added in the meantime. Lowering a ratchet number as phases land is the
 * point; raising one is the bug.
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

// Normalised: core.autocrlf is true here, so two files that are byte-identical
// in git can differ by a carriage return on disk.
const read = async (path) =>
  (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

// Assertions about what the code *does* must not match what a comment *says*.
// The overlay docblock explains the z-[81] ladder it replaced; that is prose.
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "");

async function sourceFiles(dir = "src") {
  const out = [];
  async function walk(rel) {
    const entries = await readdir(new URL(`../${rel}`, import.meta.url), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      const next = `${rel}/${entry.name}`;
      if (entry.isDirectory()) await walk(next);
      else if (next.endsWith(".tsx") || next.endsWith(".ts")) out.push(next);
    }
  }
  await walk(dir);
  return out;
}

async function countAcross(pattern, { skip = () => false } = {}) {
  const files = await sourceFiles();
  let total = 0;
  const where = [];
  for (const file of files) {
    if (skip(file)) continue;
    const hits = (await read(file)).match(pattern);
    if (hits) {
      total += hits.length;
      where.push(`${file} (${hits.length})`);
    }
  }
  return { total, where };
}

test("the Monolith semantic roles are defined once, in the dark block", async () => {
  const css = await read("src/app/globals.css");
  const dark = css.slice(css.indexOf(".dark {"), css.indexOf("}", css.indexOf(".dark {")));

  for (const role of [
    "--surface-sunken",
    "--surface-canvas",
    "--surface-panel",
    "--surface-raised",
    "--border-hairline",
    "--border-strong",
    "--text-strong",
    "--text-default",
    "--text-muted",
    "--text-faint",
    "--accent",
    "--accent-contrast",
    "--status-danger",
    "--status-warn",
    "--status-ok",
    "--scrim",
  ]) {
    assert.match(dark, new RegExp(`${role}:`), `${role} is a semantic role, not a literal`);
  }

  // --color-primary was declared in @theme and again in @theme inline, and the
  // later declaration silently won. One declaration, or the bug comes back.
  const primaryDeclarations = css.match(/^\s*--color-primary:/gm) ?? [];
  assert.equal(primaryDeclarations.length, 1, "--color-primary is declared exactly once");
});

test("every deprecated alias still resolves, so nothing loses its colour mid-migration", async () => {
  const css = await read("src/app/globals.css");
  // ~2,600 call sites resolve through these. A missing alias is not a build
  // error - it is a border that silently stops being drawn.
  for (const alias of [
    "--color-surface",
    "--color-surface-container-lowest",
    "--color-surface-container-low",
    "--color-surface-container-high",
    "--color-surface-variant",
    "--color-monolith-surface",
    "--color-surgical-steel",
    "--color-fog-muted",
    "--color-on-surface",
    "--color-on-surface-variant",
    "--color-primary-container",
    "--color-on-primary-fixed",
    "--color-error",
  ]) {
    assert.match(css, new RegExp(`${alias}: var\\(--`), `${alias} points at a semantic role`);
  }

  // shadcn's --accent is a hover fill. Pointing it at the brand accent paints
  // every menu hover lime with near-white text on it, about 1.2:1.
  assert.match(css, /--color-accent: var\(--surface-raised\)/);
});

test("radii are flat integers, not derived", async () => {
  const css = await read("src/app/globals.css");
  // calc() off a 4px base gives 5.6px and 7.2px corners, which shimmer.
  assert.doesNotMatch(css, /--radius-\w+: calc\(/);
  assert.match(css, /--radius-md: 4px;/);
});

test("the z-scale and the safe-area utilities exist as utilities, not theme keys", async () => {
  const css = await read("src/app/globals.css");
  // Tailwind v4 has no --z-* namespace; z-50 is static and cannot be themed.
  for (const name of ["z-rail", "z-drawer", "z-scrim", "z-overlay", "z-menu", "z-toast"]) {
    assert.match(css, new RegExp(`@utility ${name} `), `${name} is a custom utility`);
  }
  for (const name of ["safe-t", "safe-b", "safe-x", "hit-target"]) {
    assert.match(css, new RegExp(`@utility ${name}`), `${name} is a custom utility`);
  }
});

test("shadcn/tailwind.css is still imported", async () => {
  const css = await read("src/app/globals.css");
  // It supplies the data-open / data-closed variants every ui/ primitive's
  // className depends on. Removing it does not error - it silently kills every
  // open and close animation in the product.
  assert.match(css, /@import "shadcn\/tailwind\.css";/);
});

test("the body rule is not overridden inline by the root layout", async () => {
  const layout = await read("src/app/layout.tsx");
  // layout.tsx used to set the background and colour as arbitrary values, which
  // silently overrode @layer base - so that rule had never once applied.
  assert.doesNotMatch(layout, /<body[^>]*bg-\[/);
  assert.doesNotMatch(layout, /<body[^>]*text-\[/);
  // Without viewportFit: cover, every env(safe-area-inset-*) resolves to 0px and
  // the safe-* utilities are decorative.
  assert.match(layout, /viewportFit: "cover"/);
});

test("text-white is gone and does not come back", async () => {
  // Pure white on a near-black ground is 20.4:1 and reads as glare. 371 sites
  // were replaced; 16 of them sat on an accent fill and needed the contrast
  // colour rather than the strong text colour.
  const { total, where } = await countAcross(/\btext-white\b/g);
  assert.equal(total, 0, `text-white survives in: ${where.join(", ")}`);
});

test("src/components/ui carries no literal colour and no arbitrary z-index", async () => {
  const files = (await readdir(new URL("../src/components/ui", import.meta.url))).filter((n) =>
    n.endsWith(".tsx"),
  );
  for (const name of files) {
    const source = stripComments(await read(`src/components/ui/${name}`));
    assert.doesNotMatch(source, /#[0-9a-fA-F]{6}\b/, `${name} uses tokens, not literal hex`);
    assert.doesNotMatch(source, /\bz-\[\d+\]/, `${name} uses the z-scale`);
    assert.doesNotMatch(source, /\bshadow-\[/, `${name} uses the shadow scale`);
  }
});

test("nobody hand-rolls a focus trap", async () => {
  // Base UI's Dialog owns trap, restore, scroll lock and Escape. Three separate
  // hand-rolled traps existed before Monolith; this is the one that must stay
  // at zero rather than merely trending down.
  const { total, where } = await countAcross(/key === "Tab"/g);
  assert.equal(total, 0, `a hand-rolled Tab trap is back in: ${where.join(", ")}`);
});

test("isTypingTarget stays identical in its two homes", async () => {
  // lib/channels/shortcuts.ts cannot import the shared copy: it is loaded as raw
  // TypeScript by channels-shortcuts.test.mjs under node --test, where the "@/"
  // alias does not resolve. The duplication is deliberate; this is its gate.
  const body =
    /export function isTypingTarget\(target: EventTarget \| null\): boolean \{[\s\S]*?\n\}/;
  const shared = (await read("src/lib/ui/is-typing-target.ts")).match(body);
  const channels = (await read("src/lib/channels/shortcuts.ts")).match(body);
  assert.ok(shared && channels, "both copies still define isTypingTarget");
  assert.equal(shared[0], channels[0], "the two copies have drifted");
});

/* ---------------------------------------------------------------- ratchets */

test("the hand-rolled overlays only ever decrease", async () => {
  const files = await sourceFiles();
  const outside = files.filter((f) => !f.startsWith("src/components/ui/"));
  let count = 0;
  for (const file of outside) {
    if ((await read(file)).includes("fixed inset-0")) count += 1;
  }
  // 16 at the end of phase 1. P2 takes the AppShell search modal and the mobile
  // drawer, P3 takes the ten in /channels, P11-P13 take the rest.
  assert.ok(count <= 16, `hand-rolled overlays grew to ${count}; the primitive is ui/overlay.tsx`);
});

test("arbitrary z-index only ever decreases", async () => {
  const { total, where } = await countAcross(/\bz-\[\d+\]/g);
  // 12 at the end of phase 1, all in surfaces that portal in-tree. They go as
  // those surfaces move onto the overlay, which portals to body and needs none.
  assert.ok(total <= 12, `arbitrary z-index grew to ${total}: ${where.join(", ")}`);
});

test("the native dialogs only ever decrease", async () => {
  const { total, where } = await countAcross(/window\.(confirm|alert|prompt)\b/g);
  // 6 at the end of phase 1: the unsaved-event guards in CreatorEventsView and
  // the room errors in EventsView. Both are P12, and ui/confirm-dialog.tsx and
  // the toast provider are what replace them.
  assert.ok(total <= 6, `a native dialog was added: ${where.join(", ")}`);
});

test("pill controls only ever decrease", async () => {
  const { total } = await countAcross(/\brounded-full\b/g);
  // 242 at the end of phase 1. rounded-full is legitimate for avatars, presence
  // dots, unread badges and the rail marker; every other use is a pill button,
  // chip or input left over from the previous design system.
  assert.ok(total <= 242, `pill controls grew to ${total}; buttons and inputs are 4px`);
});
