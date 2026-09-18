/**
 * Payment and lifecycle, pinned. Phase 5.
 *
 * Three of these assertions exist because the thing they forbid was shipped and
 * was invisible from the code that contained it. A price advertised with no
 * price id behind it, a success URL pointing into a guard that sends the payer
 * back to the buy page, and a term written as a literal `+ 1` month next to a
 * screen offering a year. None of the three is a type error and none of them
 * fails a build.
 */
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

import { PURCHASES, membershipTermMonths } from "../src/lib/checkout/plans.ts";

const read = async (path) =>
  (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

/*
  An assertion about what the code does must not match what a comment says.

  Both files this phase added explain the deleted routes and the wrong guard in
  their own docblocks, and the first version of the sweeps below matched that
  prose and failed. The line-comment pattern is anchored to the start of a line
  on purpose: an unanchored one would eat the "//" of every URL in the file.
*/
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

async function sourceFiles(dir = "src") {
  const out = [];
  async function walk(rel) {
    for (const entry of await readdir(new URL(`../${rel}`, import.meta.url), { withFileTypes: true })) {
      const next = `${rel}/${entry.name}`;
      if (entry.isDirectory()) await walk(next);
      else if (next.endsWith(".tsx") || next.endsWith(".ts")) out.push(next);
    }
  }
  await walk(dir);
  return out;
}

const exists = async (path) => {
  try {
    await stat(new URL(`../${path}`, import.meta.url));
    return true;
  } catch {
    return false;
  }
};

test("a paid session returns to /checkout/success, never into the membership guard", async () => {
  /*
    success_url was `${appUrl}/dashboard?checkout=success`. Nothing read the
    parameter, and /dashboard is behind requireActiveMembership while the
    membership itself is written by the webhook — a second request from Stripe
    that can arrive after the browser redirect. When it did, the person who had
    just paid was redirected to /checkout and asked to pay again.
  */
  const route = await read("src/app/api/checkout/route.ts");
  assert.match(route, /success_url: `\$\{appUrl\}\/checkout\/success/);
  assert.doesNotMatch(route, /success_url: `\$\{appUrl\}\/dashboard/);
  assert.ok(await exists("src/app/checkout/success/page.tsx"), "the success route exists");
});

test("the success route is signed-in only, and not behind requireActiveMembership", async () => {
  // Putting that guard here recreates the exact bounce this route exists to
  // prevent: during the window it covers, the guard's answer is /checkout.
  const page = stripComments(await read("src/app/checkout/success/page.tsx"));
  assert.doesNotMatch(page, /requireActiveMembership/);
  assert.match(page, /currentViewer\(\)/);
  assert.match(page, /redirect\("\/login\?next=\/checkout\/success"\)/);
});

test("the granted term comes from the plan that was sold, not from a literal", async () => {
  const webhook = await read("src/app/api/stripe/webhook/route.ts");
  assert.match(webhook, /membershipTermMonths\(session\.metadata\?\.plan\)/);
  // `setUTCMonth(getUTCMonth() + 1)` is what made an annual plan unsellable:
  // the screen would have promised twelve months and the grant would be one.
  assert.doesNotMatch(webhook, /getUTCMonth\(\) \+ 1\b/);

  assert.equal(membershipTermMonths("annual"), 12);
  assert.equal(membershipTermMonths("monthly"), 1);
  // A session created before the choice existed carries no plan and bought a
  // month; an unrecognised one is a bug upstream, and the smaller term is the
  // safe direction to be wrong in.
  assert.equal(membershipTermMonths(undefined), 1);
  assert.equal(membershipTermMonths("yearly"), 1);
});

test("every sellable plan names its own price id and its own term", async () => {
  for (const purchase of PURCHASES) {
    assert.match(purchase.priceEnv, /^STRIPE_[A-Z_]+_PRICE_ID$/, `${purchase.product} names a price env`);
    if (purchase.product === "membership") {
      assert.ok(purchase.termMonths > 0, `${purchase.plan} grants a term`);
    }
  }
  // Two membership terms, each with a distinct price id. One price id serving
  // two plans is the defect in its original form.
  const membership = PURCHASES.filter((entry) => entry.product === "membership");
  assert.deepEqual(
    membership.map((entry) => entry.plan).sort(),
    ["annual", "monthly"],
  );
  assert.equal(new Set(membership.map((entry) => entry.priceEnv)).size, 2);
});

test("an unrecognised plan is refused rather than charged as monthly", async () => {
  const route = await read("src/app/api/checkout/route.ts");
  assert.match(route, /Unknown membership plan/);
  // And a configured product with an unconfigured term says so, instead of
  // falling through to whichever price id happens to be set.
  assert.match(route, /Annual membership is not available yet/);
});

test("no amount is written into the checkout screen", async () => {
  /*
    The deleted /subscription screen is what a typed-in figure ends as: it
    advertised "$100" for an annual plan that had no price id anywhere in the
    product, beside "$10" for a monthly one, and both buttons reached the same
    one-month charge. Amounts are read from the price that will be charged.
  */
  const body = stripComments(await read("src/components/checkout/CheckoutScreen.tsx"));
  assert.doesNotMatch(body, /"\$[\d,]/, "a currency amount is hard-coded in the checkout screen");
});

test("the unreachable subscription routes stay deleted", async () => {
  assert.equal(await exists("src/app/subscription"), false);

  // They were behind requireActiveMembership, so the only person who could read
  // a "choose your plan" page was someone who had already paid — and nothing
  // linked to them in any case. A new link is how they come back.
  const offenders = [];
  for (const file of await sourceFiles()) {
    if (/["'`]\/subscription/.test(stripComments(await read(file)))) offenders.push(file);
  }
  assert.deepEqual(offenders, [], "something links to a deleted subscription route");
});

test("the sitemap lists only what a signed-out visitor can read", async () => {
  const sitemap = stripComments(await read("src/app/sitemap.ts"));
  // /subscription was advertised at priority 0.8 and redirected every visitor
  // who followed it, crawler included.
  assert.doesNotMatch(sitemap, /\$\{baseUrl\}\/subscription/);
  for (const path of ["/login", "/signup", "/privacy", "/terms"]) {
    assert.ok(sitemap.includes(path), `${path} is still listed`);
  }
  assert.doesNotMatch(sitemap, /\$\{baseUrl\}\/checkout/, "checkout is signed-in and not a sitemap URL");
});
