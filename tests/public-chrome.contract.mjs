import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readCode = async (path) =>
  (await read(path)).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const missing = async (path) => {
  try {
    await access(new URL(`../${path}`, import.meta.url));
    return false;
  } catch {
    return true;
  }
};

test("the broken orphan chrome stays deleted", async () => {
  /*
    Both had zero importers and were wrong where they were not merely unused:
    the header linked to /philosophers, which is not a route, and to #pricing,
    which is not an id on any page; it offered /channels - members only - to
    anonymous visitors. All four of the footer's links were href="#".
  */
  assert.ok(await missing("src/components/layout/Header.tsx"), "layout/Header.tsx is gone");
  assert.ok(await missing("src/components/layout/Footer.tsx"), "layout/Footer.tsx is gone");
});

test("no public surface links to a route that does not exist", async () => {
  const files = [
    "src/components/layout/PublicChrome.tsx",
    "src/components/screens/LandingScreen.tsx",
    "src/components/legal/LegalPage.tsx",
  ];

  for (const file of files) {
    const source = await readCode(file);
    const hrefs = [...source.matchAll(/href=(?:"([^"]+)"|\{`([^`]+)`\})/g)].map((m) => m[1] ?? m[2]);

    for (const href of hrefs) {
      assert.notEqual(href, "#", `${file} has a placeholder link`);
      assert.notEqual(href, "/philosophers", `${file} links to a route that does not exist`);
    }
  }
});

test("the chrome's section links work from every public page, not just the landing one", async () => {
  const chrome = await readCode("src/components/layout/PublicChrome.tsx");

  /*
    A bare `#curriculum` scrolls on / and silently does nothing on /privacy and
    /terms, which is why this is pinned rather than reviewed: it is broken on
    two of the three pages that render it, and looks fine on the third.
  */
  const anchors = [...chrome.matchAll(/href: "([^"]*#[^"]*)"/g)].map((m) => m[1]);
  assert.ok(anchors.length >= 3, "the section list is still here");
  for (const anchor of anchors) {
    assert.ok(anchor.startsWith("/#"), `${anchor} must be absolute to work off the landing page`);
  }
});

test("a legal page cannot be published without saying when it changed", async () => {
  const layout = await readCode("src/components/legal/LegalPage.tsx");
  // Required, not optional: a policy with no date does not say which policy it
  // is, and an optional prop is one hurried edit from being dropped.
  assert.match(layout, /updated: string;/);
  assert.doesNotMatch(layout, /updated\?: string/);
  assert.match(layout, /Last updated \$\{updated\}/);

  for (const page of ["src/app/privacy/page.tsx", "src/app/terms/page.tsx"]) {
    const source = await readCode(page);
    assert.match(source, /updated="\d{1,2} \w+ \d{4}"/, `${page} states a date`);
    // And both sit in the public chrome, which is what gives them a way back:
    // before this they had no header and no footer at all.
    assert.match(source, /LegalPage/);
  }
});

test("the landing page ships no client bundle and no banned decoration", async () => {
  const landing = await read("src/components/screens/LandingScreen.tsx");
  assert.doesNotMatch(landing, /"use client"/, "anonymous visitors get no application bundle");
  // The masked grid field and the emerald glow are what Monolith replaced.
  assert.doesNotMatch(landing, /mask-image/);
  assert.doesNotMatch(landing, /rounded-full/);
  assert.doesNotMatch(landing, /shadow-\[/);
});
