import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("every settings shell reads sections from the one registry, never a local list", async () => {
  const page = await read("src/app/creator/settings/page.tsx");
  const pageShell = await read("src/components/community/settings/SettingsPageShell.tsx");
  const overlayShell = await read("src/components/community/settings/SettingsOverlayShell.tsx");
  const loader = await read("src/lib/community-settings/workspace.ts");

  assert.doesNotMatch(page, /VALID_SECTIONS/, "the page validates through the loader, not its own set");
  assert.match(page, /loadSettingsWorkspace\(/);
  assert.match(loader, /visibleSections\(/);
  assert.match(loader, /parseSettingsQuery\(/);
  assert.match(loader, /if \(visible\.length === 0\) redirect\(/, "a viewer with nothing to see is sent away");

  // Both shells render the same rail and the same body.
  for (const shell of [pageShell, overlayShell]) {
    assert.match(shell, /<SettingsRail/);
    assert.match(shell, /<SettingsSectionBody workspace=\{workspace\}/);
    assert.doesNotMatch(shell, /id: "(overview|roles|channels|audit)" as const/, "no inline section literals");
  }
});

test("unbuilt sections render no controls, and every section names a real permission", async () => {
  const registry = await read("src/lib/community-settings/sections.ts");
  const body = await read("src/components/community/settings/SettingsSectionBody.tsx");
  const permissions = await read("src/lib/community-settings/permissions.ts");

  const keys = [...permissions.matchAll(/^\s+"([a-z_]+)",$/gm)].map((match) => match[1]);
  const requires = [...registry.matchAll(/requires: "([a-z_]+)"/g)].map((match) => match[1]);
  assert.ok(requires.length >= 10);
  for (const key of requires) assert.ok(keys.includes(key), `${key} is in the permission catalog`);

  // Tempered: stay inside one section literal so a built section followed by an
  // unbuilt one is not misread.
  const unbuilt = [...registry.matchAll(/id: "([a-z]+)",(?:(?!id: ")[\s\S])*?built: false/g)].map(
    (match) => match[1],
  );
  for (const id of unbuilt) {
    assert.doesNotMatch(body, new RegExp(`case "${id}"`), `${id} has no body until its policy ships`);
  }
});

test("shadcn primitives render in the Stoicverse skin and use the project cn helper", async () => {
  const css = await read("src/app/globals.css");
  const dark = css.slice(css.indexOf(".dark {"), css.indexOf("}", css.indexOf(".dark {")));
  assert.match(dark, /--primary: #10B981;/, "primary actions are emerald, not the lavender default");
  assert.match(dark, /--destructive: #ffb4ab;/, "one red, shared with --color-error");

  const files = (await readdir(new URL("../src/components/ui", import.meta.url))).filter((name) =>
    name.endsWith(".tsx"),
  );
  assert.ok(files.length >= 25, `expected the primitive set, found ${files.length}`);
  for (const name of files) {
    const source = await read(`src/components/ui/${name}`);
    assert.doesNotMatch(source, /from "cn"/, `${name} must import cn from @/lib/utils`);
    assert.doesNotMatch(source, /@\/registry\//, `${name} must not reference the registry alias`);
  }
});
