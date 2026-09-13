/**
 * The overlay primitive, and the skeletons, pinned.
 *
 * These two things are in one file because they fail together: a skeleton draws
 * the shape of the thing about to arrive, so a change to a control that does not
 * reach its skeleton is a layout shift dressed up as a courtesy.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) =>
  (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

// Assertions about what the code does must not match what a comment says.
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

test("the overlay owns none of the behaviour it could get wrong", async () => {
  const overlay = stripComments(await read("src/components/ui/overlay.tsx"));

  // Base UI's Dialog provides portal, scroll lock, focus trap, focus restore and
  // Escape. Reimplementing any of them here is how they drift apart.
  assert.match(overlay, /from "@base-ui\/react\/dialog"/);
  assert.match(overlay, /DialogPrimitive\.Portal/);
  assert.doesNotMatch(overlay, /key === "Tab"/);
  assert.doesNotMatch(overlay, /document\.body\.style\.overflow/);

  // The scrim and the popup sit on the named scale. The old ladder reached
  // z-[81] and z-100 only because nothing portalled.
  assert.match(overlay, /z-scrim/);
  assert.match(overlay, /z-overlay/);
  assert.doesNotMatch(overlay, /z-\[\d+\]/);
});

test("the mobile sheet and the safe area are written once", async () => {
  const overlay = stripComments(await read("src/components/ui/overlay.tsx"));

  // Sixteen hand-rolled surfaces each re-derived the bottom-sheet-on-a-phone,
  // centred-dialog-above-sm switch, and no /channels surface had safe-area at all.
  assert.match(overlay, /placement/);
  assert.match(overlay, /responsive:/);
  assert.match(overlay, /env\(safe-area-inset-bottom\)/);
  assert.match(overlay, /max-h-\[92svh\]/, "a phone sheet is bounded in svh, never vh");
  assert.doesNotMatch(overlay, /100vh/, "svh only - vh is wrong under a mobile browser chrome");
});

test("confirmation is an alert dialog, so an outside click cannot discard work", async () => {
  const confirm = await read("src/components/ui/confirm-dialog.tsx");
  assert.match(confirm, /from "@base-ui\/react\/alert-dialog"/);
  // role=alertdialog and no dismiss-on-outside-click are the reason it is not
  // built on Dialog: losing unsaved edits to a stray click is the exact failure
  // a discard guard exists to prevent.
  assert.match(confirm, /tone === "danger"/);
});

test("dialog and sheet are shims over the one overlay, not second implementations", async () => {
  const dialog = await read("src/components/ui/dialog.tsx");
  const sheet = await read("src/components/ui/sheet.tsx");

  for (const [name, source] of [
    ["dialog", dialog],
    ["sheet", sheet],
  ]) {
    assert.match(source, /from "@\/components\/ui\/overlay"/, `${name} resolves to the overlay`);
    assert.doesNotMatch(
      source,
      /DialogPrimitive\.Popup|Dialog\.Popup/,
      `${name} renders no popup of its own`,
    );
  }

  // Sheet was never a separate primitive - the previous file imported base-ui's
  // Dialog and renamed it. side is the overlay's placement now.
  assert.match(sheet, /SIDE_TO_PLACEMENT/);
});

test("every skeleton renders through the one atom", async () => {
  for (const path of [
    "src/components/layout/Skeletons.tsx",
    "src/app/channels/[channelId]/loading.tsx",
  ]) {
    const source = stripComments(await read(path));
    assert.match(source, /from "@\/components\/ui\/skeleton"/, `${path} imports the shared atom`);
    assert.doesNotMatch(
      source,
      /animate-pulse/,
      `${path} must not restate the shimmer; ui/skeleton owns it`,
    );
  }
});

test("a skeleton never draws a pill where the real control is 4px", async () => {
  const skeletons = await read("src/components/layout/Skeletons.tsx");
  // Buttons, inputs and chips stopped being pills in commit 1.5. rounded-full in
  // a skeleton is legitimate only for a round thing - an avatar or a dot - which
  // is always sized with size-.
  const rounds = skeletons.match(/<Skeleton[^>]*className="([^"]*rounded-full[^"]*)"/g) ?? [];
  for (const hit of rounds) {
    assert.match(hit, /size-\d/, `a skeleton draws a pill the real control no longer has: ${hit}`);
  }
});
