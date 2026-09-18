/**
 * Events and mentorship, pinned. Monolith phase 9.
 *
 * These are not style assertions. Each one stands for a defect that shipped and
 * was visible to a member: a call to action that answered 404, a price nothing
 * checked, literal asterisks in the one message explaining a locked session,
 * and a dialog that owned none of what a dialog owes its reader.
 */
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) =>
  (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "");

const exists = async (path) => {
  try {
    await access(new URL(`../${path}`, import.meta.url));
    return true;
  } catch {
    return false;
  }
};

test("the dashboard's mentorship call to action resolves to a route", async () => {
  /*
    The panel links to `withRouteBase(routeBase, "/mentorship")`, and the member
    dashboard passes `routeBase="/dashboard"`. That is `/dashboard/mentorship`,
    which existed nowhere: the most prominent call to action on the member's
    home screen answered 404 from the day the link was written.

    Asserted as "the link and the route agree" rather than as a string, because
    either half may move and the bug is only ever the disagreement.
  */
  const dashboard = await read("src/components/dashboard/TerminalDashboard.tsx");
  assert.match(dashboard, /withRouteBase\(routeBase, "\/mentorship"\)/);

  assert.ok(await exists("src/app/dashboard/mentorship/page.tsx"), "/dashboard/mentorship must exist");
  const page = await read("src/app/dashboard/mentorship/page.tsx");
  assert.match(page, /renderMentorshipPage/);
  assert.match(page, /routeBase: "\/dashboard"/);
});

test("every mentorship route carries a loading boundary", async () => {
  // A dynamic route without one is not prefetched at all — the missing skeleton
  // costs the whole round trip, not just the feedback. See lesson 83.
  for (const segment of ["mentorship", "dashboard/mentorship", "creator/mentorship"]) {
    assert.ok(await exists(`src/app/${segment}/loading.tsx`), `${segment} has no loading.tsx`);
  }
});

test("the mentorship amount comes from Stripe, never from the component", async () => {
  /*
    "$1,000.00" used to be a string in the view, beside "2 Months" and "60 days
    of full access" — while `plans.ts` gives mentorship `termMonths: null`. A
    figure typed into a component is a claim nothing checks. See lesson 86.
  */
  const view = stripComments(await read("src/components/mentorship/MentorshipView.tsx"));
  assert.doesNotMatch(view, /\$\s?\d/, "an amount was typed into the mentorship view");

  const page = await read("src/app/mentorship/page.tsx");
  assert.match(page, /priceFor/);
  assert.match(page, /findPurchase\("mentorship", null\)/);
});

test("the creator mentorship page has one implementation, not a second copy", async () => {
  const creator = await read("src/app/creator/mentorship/page.tsx");
  assert.match(creator, /renderMentorshipPage/);
  assert.match(creator, /creatorWorkspace: true/);
  assert.doesNotMatch(creator, /from\("mentorships"\)/, "the creator page re-queried what the shared render already reads");
});

test("the mentor's initial is not painted in its own background colour", async () => {
  /*
    The avatar tile was `bg-primary-container … text-primary-container`: the
    accent on itself, so the letter was invisible and the tile read as empty.
    Same family as lesson 47 — a Tailwind colour failure is silent.
  */
  const view = stripComments(await read("src/components/mentorship/MentorshipView.tsx"));
  // `(?![\w-])` and not `\b`: `text-primary-foreground` is the *fix*, and a
  // word boundary matches inside it, so the loose spelling fails the corrected
  // code and passes nothing useful.
  const tiles = view.match(/className="[^"]*bg-primary(?![\w-])[^"]*"/g) ?? [];
  for (const tile of tiles) {
    assert.doesNotMatch(tile, /text-primary(?![\w-])/, `a tile paints its text in its own fill: ${tile}`);
  }
  assert.ok(tiles.length > 0, "the mentor tile no longer carries the accent fill this guards");
});

test("the events detail dialog is the primitive, and its failures are toasts", async () => {
  const view = stripComments(await read("src/components/events/EventsView.tsx"));
  assert.match(view, /from "@\/components\/ui\/overlay"/);
  assert.doesNotMatch(view, /fixed inset-0/, "the dialog is hand-rolled again");
  assert.doesNotMatch(view, /\bz-50\b/, "z-50 is not on the project's z-scale");
  assert.doesNotMatch(view, /window\.(alert|confirm|prompt)\b/, "a native dialog is back");
  assert.match(view, /useToast/);
});

test("the tier gate emphasises with markup, not with asterisks", async () => {
  /*
    `**{getTierTitle(level)}**` inside a paragraph is not markdown to React. The
    reader saw `**Intermediate**`, literally, on the only message that explains
    why they cannot enroll.
  */
  const view = stripComments(await read("src/components/events/EventsView.tsx"));
  assert.doesNotMatch(view, /\*\*\{/, "literal markdown emphasis is rendered as asterisks");
  assert.match(view, /<strong/);
});

test("the events cards are reachable by keyboard", async () => {
  // The card used to be a `<div onClick>`: openable by mouse, invisible to the
  // keyboard and to anything that reads the page as a document.
  const view = stripComments(await read("src/components/events/EventsView.tsx"));
  assert.doesNotMatch(view, /<article\b[^>]*\sonClick=/, "a card handles clicks on a non-interactive element");
  assert.match(view, /after:absolute after:inset-0/, "the card's control is no longer stretched over it");
});

test("a cancelled session is listed once", async () => {
  /*
    `recent` already admitted cancelled events inside the last day, and a third
    list re-filtered the same rows under "Recently cancelled" — so a session
    cancelled this morning appeared twice on the page.
  */
  const view = stripComments(await read("src/components/events/EventsView.tsx"));
  assert.doesNotMatch(view, /Recently cancelled/);
});
