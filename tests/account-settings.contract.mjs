/**
 * Account settings, pinned. Monolith phase 10.
 *
 * The screen is four forms wired to five server actions by nothing but matching
 * strings. A rewrite that renames one field breaks a save with no type error,
 * no lint error and no failing build — the action simply reads `null` and
 * writes the wrong thing. So the first test here is not about design at all: it
 * asserts that every name the actions read is still rendered by the component.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) =>
  (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "");

const WORKSPACE = "src/components/settings/AccountSettingsWorkspace.tsx";
const ACTIONS = "src/app/dashboard/settings/actions.ts";

test("every field the settings actions read is still rendered", async () => {
  const view = await read(WORKSPACE);
  const actions = await read(ACTIONS);

  // The names the server reads, taken from the actions rather than typed here,
  // so a field renamed on both sides stays green and a field renamed on one
  // side fails.
  const wanted = [...actions.matchAll(/formData\.get\("([^"]+)"\)/g)].map((match) => match[1]);
  assert.ok(wanted.length >= 8, `expected the actions to read several fields, found ${wanted.length}`);

  // Matched as a quoted string rather than as `name="…"`, because the four
  // preference fields are rendered from a data array — their names live in the
  // options list, not in an attribute. A rename still fails this.
  for (const name of new Set(wanted)) {
    assert.match(view, new RegExp(`"${name}"`), `the form no longer renders a field named ${name}`);
  }

  // The file input is not read through formData.get in the same shape, and the
  // confirmation gate is a pattern rather than a name.
  assert.match(view, /name="avatar"/);
  assert.match(view, /pattern="DELETE"/);
});

test("a preference checkbox submits the value its action compares against", async () => {
  /*
    `ui/checkbox` is Base UI, not a native input. Base UI only reproduces the
    native "on" default while no `value` prop is given, and passing an empty one
    would submit `""` — which `=== "on"` reads as false for every preference,
    silently, on save. The value is stated here and asserted against the
    comparison the action actually makes.
  */
  const view = stripComments(await read(WORKSPACE));
  const actions = await read(ACTIONS);

  assert.match(actions, /formData\.get\("eventUpdates"\) === "on"/);
  assert.match(view, /value="on"/);
  assert.doesNotMatch(view, /type="checkbox"/, "the primitive, not a hand-rolled input");
});

test("no stock palette on the one control whose job is showing state", async () => {
  // `accent-emerald-500` painted the preference checkboxes a colour the design
  // system does not contain.
  const view = stripComments(await read(WORKSPACE));
  assert.doesNotMatch(view, /\baccent-emerald-\d+\b/);
  assert.doesNotMatch(view, /\btext-error\b/, "the system has --status-danger");
  assert.doesNotMatch(view, /text-accent-contrast/, "that colour belongs on the accent fill, not on a panel");
});

test("the settings page writes no markup of its own", async () => {
  /*
    A hidden <span> used dangerouslySetInnerHTML to inject an HTML comment
    describing the design intent — "THESIS…", "selected shape seed ff507120" —
    into every render. Invisible, unread, and written with the one React API
    that exists to bypass escaping.
  */
  // Comments stripped: the docblock that explains the removal names the API it
  // removed, and this assertion turned red on that prose the first time it ran.
  // Lesson 89, in the file whose own comment caused it.
  const view = stripComments(await read(WORKSPACE));
  assert.doesNotMatch(view, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(view, /THESIS:/);
});

test("the workspace is on the primitives, not on three class-name constants", async () => {
  const view = stripComments(await read(WORKSPACE));
  for (const primitive of ["ui/button", "ui/checkbox", "ui/input", "ui/label"]) {
    assert.match(view, new RegExp(`@/components/${primitive}`), `${primitive} is what this screen should compose`);
  }
  // The three strings that used to stand in for them.
  assert.doesNotMatch(view, /const (inputClass|primaryButton|secondaryButton) =/);
});
