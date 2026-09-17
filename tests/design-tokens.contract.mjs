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
//
// Line comments count too, and for three phases they did not. This stripped
// only `/* */`, so `TerminalDashboard`'s `// surface-sunken, not
// surface-container-highest - that class is not defined` was being counted as a
// use of the class it exists to warn against. A whole-line `//` is matched
// rather than every `//`, because a URL inside a string literal is not a
// comment. Lesson 89, in the helper written to satisfy lesson 89.
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

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

async function countAcross(pattern, { skip = () => false, strip = false } = {}) {
  const files = await sourceFiles();
  let total = 0;
  const where = [];
  for (const file of files) {
    if (skip(file)) continue;
    const source = await read(file);
    const hits = (strip ? stripComments(source) : source).match(pattern);
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
  /*
    Pure white on a near-black ground is 20.4:1 and reads as glare. 371 sites
    were replaced; 16 of them sat on an accent fill and needed the contrast
    colour rather than the strong text colour.

    Comments are stripped, and that is not a loosening. A file that removes this
    class has every reason to *name* it in the docblock explaining why - phase 7
    did exactly that and turned this assertion red over prose. The rule stays a
    hard zero for anything that renders. Lesson 45, from the other direction.
  */
  const { total, where } = await countAcross(/\btext-white\b/g, { strip: true });
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

test("cn keeps a text colour that a Monolith size follows", async () => {
  /*
    `text-*` is two class groups — font size and text colour — and
    tailwind-merge tells them apart using its own default scale. Every Monolith
    size is absent from that scale, so each was read as a colour and deleted the
    colour before it.

    `ui/button.tsx` composes variant before size, so the default variant merged
    down to `bg-primary … text-content-base`: a lime fill whose label inherited
    the body's light grey, about 1.5:1. It was live on every filled Button and
    invisible in the source, because the class is right there in the string.

    Found in the browser on /checkout/success in phase 5.
  */
  const { cn, MONOLITH_FONT_SIZES } = await import("../src/lib/utils.ts");

  assert.match(
    cn("bg-primary text-primary-foreground h-12 px-5 text-content-base", "mt-7 w-full"),
    /text-primary-foreground/,
    "the button variant's label colour was merged away",
  );
  // The size still wins over another size, which is the behaviour being kept.
  assert.match(cn("text-content-sm", "text-content-lg"), /text-content-lg/);
  assert.doesNotMatch(cn("text-content-sm", "text-content-lg"), /text-content-sm/);
  // And a real colour still overrides a real colour.
  assert.match(cn("text-text-muted", "text-text-strong"), /text-text-strong/);
  assert.doesNotMatch(cn("text-text-muted", "text-text-strong"), /text-text-muted/);

  /*
    A size declared in globals.css and missing from that list is this bug again,
    silently, on whichever button next uses it.
  */
  const css = await read("src/app/globals.css");
  const dark = css.slice(css.indexOf(".dark {"), css.indexOf("\n}", css.indexOf(".dark {")));
  const themed = css.replace(dark, "");
  const declared = [
    ...new Set(
      [...themed.matchAll(/^\s*--text-([a-z0-9-]+):/gm)]
        .map((match) => match[1])
        .filter((name) => !name.includes("--")),
    ),
  ].sort();
  assert.deepEqual([...MONOLITH_FONT_SIZES].sort(), declared, "the type scale and cn's copy of it have drifted");
});

test("buttonVariants resolves its own conflicts, like the component does", async () => {
  /*
    The base layer sets `border-transparent` and the outline variant sets
    `border-border-strong`. cva concatenates, Tailwind resolves the conflict by
    stylesheet order rather than attribute order, and transparent wins - so
    eleven outline buttons and link-buttons rendered with no border until the
    export was routed through `cn`. `<Button>` was never affected, which is
    exactly what made it invisible: the two call styles disagreed.

    Asserted on the wiring rather than on a colour, because the failure is that
    a conflict survives, not that one particular class lost.
  */
  const source = stripComments(await read("src/components/ui/button.tsx"));
  assert.match(source, /function buttonVariants\([^)]*\)\s*\{\s*return cn\(/, "buttonVariants must merge, not concatenate");
  assert.doesNotMatch(source, /export \{[^}]*buttonStyles/, "the raw cva stays private, or callers reintroduce the conflict");
});

test("nothing traps focus by hand", async () => {
  /*
    This assertion used to match /key === "Tab"/ and claim a hard zero. It was
    wrong, and passing for the wrong reason: AppShell's notification panel wrote
    the inverted guard, `event.key !== "Tab"`, so the trap was there the whole
    time and the test could not see it. Two traps existed, not one.

    Widened to the bare token, which catches both spellings, and demoted to a
    ratchet while `MemberModalShell` still carried the second one.

    **It is a hard zero again as of phase 11b**, honestly this time: that shell
    is `ui/overlay` now, and Base UI's Dialog owns trap, restore, scroll lock
    and Escape. A ratchet at 1 would say "one is acceptable", and none is.
  */
  const { total, where } = await countAcross(/"Tab"/g, { strip: true });
  assert.equal(total, 0, `focus is being trapped by hand in: ${where.join(", ")}`);
});

test("no screen writes unescaped markup of its own", async () => {
  /*
    Two screens shipped a hidden element whose only job was to inject an HTML
    comment describing the design intent - "THESIS…", "OWN-WORLD…", and a
    "shape seed" - into every render, through the one React API that exists to
    bypass escaping. Account settings carried one until phase 10 and the member
    registry until 11b, which makes it a pattern rather than an accident:
    whatever produced these screens emitted the brief alongside the markup.

    `lib/markdown/render.tsx` is the renderer and does not use this API either,
    so the correct number is zero rather than a ratchet with an exception.
  */
  const { total, where } = await countAcross(/dangerouslySetInnerHTML/g, { strip: true });
  assert.equal(total, 0, `unescaped markup is being written in: ${where.join(", ")}`);
});

test("every hit-target sits on a positioned element", async () => {
  /*
    `hit-target` paints its 44px area with an absolutely positioned ::before at
    inset -6px. Without a positioning context on the element itself, that box
    resolves against the nearest positioned ancestor — in practice the page —
    and lands 6px outside the document on every side. It is invisible, so what
    you see is not a stray box but an unexplained 6px of horizontal overflow,
    which then steals a scrollbar's height and produces a vertical one too.

    Caught in the browser on the P2a header, where the search trigger had no
    `relative`. ui/button.tsx carries it in the base, which is why none of its
    six hit-target sizes ever showed this.
  */
  const files = await sourceFiles();
  const offenders = [];
  for (const file of files) {
    for (const hit of (await read(file)).match(/className=(?:"[^"]*"|\{`[^`]*`\})/g) ?? []) {
      if (!/\bhit-target\b/.test(hit)) continue;
      if (!/\b(relative|absolute|fixed|sticky)\b/.test(hit)) offenders.push(`${file}: ${hit.slice(0, 60)}…`);
    }
  }
  assert.deepEqual(offenders, [], "a hit-target with no positioning context overflows the page");
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

test("every overlay in the product is the primitive", async () => {
  const files = await sourceFiles();
  const outside = files.filter((f) => !f.startsWith("src/components/ui/"));
  let count = 0;
  const where = [];
  for (const file of outside) {
    // Comments stripped: a file that moves its dialog onto the primitive says
    // in its docblock what it replaced, and that prose is not an overlay.
    const source = stripComments(await read(file));
    if (!source.includes("fixed inset-0")) continue;
    // `fixed inset-0` is how a full-viewport layer is positioned, which a
    // *correct* overlay also does - Base UI's own Backdrop is placed exactly
    // that way. What makes one hand-rolled is owning the scrim with no library
    // above it to supply focus, Escape, scroll lock and inertness. Matching the
    // class alone put `SettingsOverlayShell` in this count while it was already
    // a Base UI dialog, which is the shape of assertion lesson 53 warns about:
    // it pinned the syntax rather than the guarantee, so the number could never
    // reach zero however much was fixed.
    const owned = /@base-ui\/react\/dialog|@\/components\/ui\/(overlay|dialog|sheet|alert-dialog|confirm-dialog|mobile-pane)/.test(
      source,
    );
    if (owned) continue;
    count += 1;
    where.push(file);
  }
  // 9 after phase 8 moved the course-enrollment dialog onto the primitive;
  // 10 at the end of P3. The three that were left in /channels are gone:
  // ForwardDialog and SearchOverlay moved onto the primitive and QuickSwitcher
  // was deleted into SearchOverlay. MessageMenu and MobilePane still match on
  // prose rather than markup. The rest belong to the creator phases.
  // 6 after phase 9 moved the event-details dialog onto the primitive. 2 after
  // phase 11c. 1 after phase 12a narrowed this to overlays that own their own
  // scrim: `SettingsOverlayShell` had been counted for its Base UI Backdrop.
  //
  // 0 after phase 12c moved `StructureEditor` - the last one - onto
  // `ui/overlay`. This stops being a ratchet and becomes an absolute: there is
  // nothing left to migrate, so a number that may only fall says nothing and
  // the correct next value is the one it already has. Lesson 92. A new
  // hand-rolled scrim fails this now, and the message names the file.
  assert.equal(count, 0, `a hand-rolled overlay was added in ${where.join(", ")}; the primitive is ui/overlay.tsx`);
});

test("layering is the named z-scale, with no arbitrary values left", async () => {
  // Stripped, and the number moved a long way when it was. This ratchet read
  // raw source until phase 12a, and **seven of the nine sites it was reporting
  // were prose** - every file that had already moved onto the z-scale names the
  // `z-[80]` or `z-[60]` it replaced, in the docblock explaining why. The
  // assertion was counting the sentences describing its own successes, so the
  // figure it defended had almost nothing to do with the code. Lesson 89, in
  // the family of ratchet that lesson was written about: `stripComments` was
  // added for the absence assertions and never carried to the counting ones.
  const { total, where } = await countAcross(/\bz-\[\d+\]/g, { strip: true });
  // 11 after P2a, as measured raw. 2 was the first honest reading: `EmojiPicker`
  // and `StructureEditor`, both phase 12c. 0 once that phase took them - the
  // picker's tone menu became a portalled popover and the structure modal became
  // `ui/overlay`, and neither needs to out-rank an ancestor any more. Every
  // remaining match in the tree is a docblock naming the number it replaced,
  // which is exactly what `strip` is here to discount.
  assert.equal(total, 0, `an arbitrary z-index was added in ${where.join(", ")}; the scale is in globals.css`);
});

test("the native dialogs only ever decrease", async () => {
  // Stripped, like the other counting ratchets: `ui/confirm-dialog.tsx` and
  // `ui/overlay.tsx` both name `window.confirm` in the docblock explaining what
  // they replaced, and EventsView names `window.alert` for the same reason.
  // Three of the six this used to report were prose. See lesson 89.
  const { total, where } = await countAcross(/window\.(confirm|alert|prompt)\b/g, { strip: true });
  // 6 at the end of phase 1, of which 3 were comments. Phase 9 moved the two
  // event-room errors in EventsView onto the toast provider, leaving the two
  // unsaved-event guards in CreatorEventsView, which phase 11 owns.
  assert.equal(total, 0, `a native dialog was added: ${where.join(", ")}`);
});

test("a class naming a token that does not exist only ever decreases", async () => {
  /*
    `surface-container-highest` is not defined anywhere. The alias scale stops at
    `-high`, so every one of these emits no CSS at all and the surface it dresses
    paints nothing — not a wrong colour, an absent one. Nothing catches it: the
    build is green, the typechecker cannot see inside a string, and on a
    near-black page an unpainted panel looks like a deliberately flat one.

    Two were on the member dashboard (a course preview panel and a progress
    track) and phase 7 fixed them. Three survive, in screens later phases own:
    a course detail panel, an automod section, and one more on the dashboard.
    Phase 9 removed none of them — the ceiling was one higher than the code,
    because it was last set from a count that still included prose.

    Found by reading globals.css for the token rather than by looking at a page,
    which is the only way this class of defect is ever found early.
    See `00 - Shared/Cross-Project Lessons.md` lesson 47.
  */
  const css = await read("src/app/globals.css");
  assert.doesNotMatch(css, /--color-surface-container-highest:/, "if this is ever defined, delete this ratchet");

  /*
    Comments stripped, for the same reason `text-white` strips them: a file that
    removes this class names it in the docblock explaining why, and phase 8
    turned this ratchet red over its own prose on the first run. Code only.
  */
  const { total, where } = await countAcross(/\bsurface-container-highest\b/g, { strip: true });
  // 2 after phase 12b took the AutoMod kind menu's hover fill. That one was the
  // worst of the three: the menu it dressed had no Escape and no outside-press
  // either, so the only state that could have told you the thing was hoverable
  // was the state that emitted no CSS. The two survivors are the course detail
  // panel and `TerminalDashboard`, which phase 13b owns.
  assert.ok(total <= 2, `a class naming an undefined token was added; found ${total} in: ${where.join(", ")}`);
});

test("pure white fills only ever decrease", async () => {
  /*
    Monolith replaced 371 uses of `text-white` because pure white on near-black
    is 20.4:1 and reads as glare. A pure white *fill* is the same decision from
    the other side, and `text-white`'s hard zero never covered it.

    8 when phase 7 started; the member dashboard's mentorship button was one of
    them and was the only full-strength `bg-white` — the rest are low-opacity
    hover washes (`bg-white/[0.04]`), which are a different, milder problem.

    Stripped and re-based at 1 in phase 12b. The ceiling of 3 was set from a raw
    reading that included the prose of the files explaining the removal; the one
    real site left is `ui/slider.tsx`'s thumb, where a white fill on a track is
    the control's own affordance rather than a leftover. If that changes, this
    becomes a hard zero.
  */
  const { total, where } = await countAcross(/\bbg-white\b/g, { strip: true });
  assert.ok(total <= 1, `a pure white fill was added; found ${total} in: ${where.join(", ")}`);
});

test("the deprecated glow only ever decreases", async () => {
  // Stripped, for the reason lesson 89 records: a file that removes the glow
  // names it in the docblock saying so, and two of the eight this reported
  // after phase 8 were that prose rather than a shadow.
  const { total, where } = await countAcross(/\bemerald-glow\b/g, { strip: true });
  /*
    Monolith has no coloured glows. The utility still exists in globals.css and
    resolves to the ordinary raised shadow, so removing a call site changes
    nothing visually — which is exactly why an unmeasured one survives: it is
    invisible in review and invisible in the browser.

    16 when Monolith landed, 13 after phase 5 (the checkout CTA was three of
    them), 8 after phase 7 deleted the dead legacy screens that carried five. The remaining ones are the dashboard, learning-path, events
    and mentorship screens, which later phases own. The utility is deleted with
    the alias block when this reaches zero.
  */
  assert.equal(total, 0, `emerald-glow came back in: ${where.join(", ")}`);
});

test("pill shapes are confined to the places a circle means something", async () => {
  const { total, where } = await countAcross(/\brounded-full\b/g, { strip: true });
  /*
    234 after P2a, 189 after phase 7, 169 after phase 8 - and 43 now, because the
    shape was fixed across the whole product in one pass rather than one screen at
    a time. Monolith is boxy: buttons, inputs, selects and chips are 4px and the
    progress bars are 2px.

    What is left is not residue. rounded-full is correct for avatars and their
    fallbacks, presence and recording dots, unread count badges, skeleton circles,
    waveform bars, and the form controls whose shape carries meaning - a switch
    that is not a capsule reads as a checkbox, and a radio that is not a circle
    reads as one too. So this is a ceiling on a legitimate population, not a
    migration counter: a new pill button pushes it over.
  */
  assert.ok(total <= 42, `pill controls grew to ${total}; buttons, inputs and chips are 4px: ${where.join(", ")}`);
});
