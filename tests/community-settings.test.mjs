import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCENT_SWATCHES,
  contrastRatio,
  DEFAULT_COMMUNITY_IDENTITY,
  formatContrast,
  IDENTITY_LIMITS,
  isHexColor,
  MIN_ACCENT_CONTRAST,
  MODERATION_LIMITS,
  parseIdentity,
  parseModeration,
  relativeLuminance,
  SURFACE_COLOR,
} from "../src/lib/community-settings/model.ts";

const valid = (overrides = {}) => ({
  name: "Stoicverse",
  tagline: "",
  logoPath: "",
  accentColor: "#10B981",
  welcomeMessage: "",
  rules: "",
  showWelcome: true,
  ...overrides,
});

test("contrast matches the WCAG reference at both extremes", () => {
  // White on black is the defined maximum; a colour against itself is 1.
  assert.equal(Math.round(contrastRatio("#FFFFFF", "#000000")), 21);
  assert.equal(contrastRatio("#10B981", "#10B981"), 1);
  assert.equal(relativeLuminance("#000000"), 0);
  assert.equal(relativeLuminance("#FFFFFF"), 1);
});

test("contrast is null rather than NaN for anything that is not a hex colour", () => {
  assert.equal(contrastRatio("emerald"), null);
  assert.equal(relativeLuminance("#FFF"), null);
  assert.equal(isHexColor("#FFF"), false);
  assert.equal(isHexColor("#10B981"), true);
});

test("every curated swatch clears the contrast floor it is offered under", () => {
  // A swatch that fails its own validator would be a control that rejects the
  // value it just suggested.
  for (const swatch of ACCENT_SWATCHES) {
    const ratio = contrastRatio(swatch.hex, SURFACE_COLOR);
    assert.ok(ratio !== null && ratio >= MIN_ACCENT_CONTRAST, `${swatch.name} ${swatch.hex} is ${ratio}`);
  }
});

test("the default accent is itself acceptable", () => {
  const result = parseIdentity(valid({ accentColor: DEFAULT_COMMUNITY_IDENTITY.accentColor }));
  assert.equal(result.accentColor, "#10B981");
});

test("a low-contrast accent is rejected with the measured ratio in the message", () => {
  // #0A1A2A sits almost on the surface colour, so it would be an invisible
  // focus ring on every page.
  assert.throws(() => parseIdentity(valid({ accentColor: "#0A1A2A" })), /against the page background/);
  assert.throws(() => parseIdentity(valid({ accentColor: "not-a-colour" })), /six-digit hex/);
});

test("names are bounded at both ends and trimmed", () => {
  assert.equal(parseIdentity(valid({ name: "  Stoicverse  " })).name, "Stoicverse");
  assert.throws(() => parseIdentity(valid({ name: "S" })), /between 2 and 60/);
  assert.throws(() => parseIdentity(valid({ name: "x".repeat(61) })), /between 2 and 60/);
});

test("the long text fields are bounded at the same limits as the database", () => {
  assert.throws(() => parseIdentity(valid({ tagline: "x".repeat(141) })), /140 characters or fewer/);
  assert.throws(() => parseIdentity(valid({ welcomeMessage: "x".repeat(2001) })), /2000 characters or fewer/);
  assert.throws(() => parseIdentity(valid({ rules: "x".repeat(10001) })), /10000 characters or fewer/);
  assert.equal(parseIdentity(valid({ rules: "x".repeat(10000) })).rules.length, 10000);
});

test("an empty logo path becomes null rather than an empty string", () => {
  assert.equal(parseIdentity(valid({ logoPath: "" })).logoPath, null);
  assert.equal(parseIdentity(valid({ logoPath: "logo-1.png" })).logoPath, "logo-1.png");
});

test("the checkbox's several truthy forms all mean shown", () => {
  assert.equal(parseIdentity(valid({ showWelcome: "on" })).showWelcome, true);
  assert.equal(parseIdentity(valid({ showWelcome: true })).showWelcome, true);
  assert.equal(parseIdentity(valid({ showWelcome: undefined })).showWelcome, false);
});

test("the accent is normalised to upper case so comparisons are stable", () => {
  assert.equal(parseIdentity(valid({ accentColor: "#10b981" })).accentColor, "#10B981");
});

test("the limits the interface shows are the limits the validator enforces", () => {
  assert.equal(IDENTITY_LIMITS.logoBytes, 2 * 1024 * 1024);
  assert.deepEqual([...IDENTITY_LIMITS.logoTypes], ["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);
  assert.equal(formatContrast(4.567), "4.6:1");
});

const moderation = (overrides = {}) => ({
  editWindowMinutes: 0,
  deleteRequiresReason: false,
  ...overrides,
});

// The seven-key permission_config these four tests covered was replaced in
// phase 2 by the 24-key catalog. Its successors are the catalog and resolver
// units in community-permissions.test.mjs and the SQL-to-TypeScript equality
// assertion in community-roles.contract.mjs.

// Blocked-word matching left this module in phase 5. The four tests that
// covered `matchesBlockedWord` are now the keyword-compiler and match tests in
// community-automod.test.mjs, which additionally assert parity with the SQL
// that actually runs on insert — something these never did.

test("moderation bounds mirror the database constraint", () => {
  // Slow mode left this function in phase 3: it is a property of a channel now,
  // and its bounds are asserted by `parseSlowMode` in
  // community-channel-permissions.contract.mjs.
  assert.throws(() => parseModeration(moderation({ editWindowMinutes: 10081 })), /0 minutes/);
  assert.equal(parseModeration(moderation({ editWindowMinutes: 10080 })).editWindowMinutes, 10080);
  assert.equal(MODERATION_LIMITS.editWindowMinutes.max, 10080);
});

test("moderation carries no blocked-word settings after phase 5", () => {
  // The two community-wide columns were dropped by 20260912040000. If a later
  // change reintroduces them here without a column behind them, this fails
  // rather than shipping a control that saves nothing.
  const parsed = parseModeration(moderation());
  assert.deepEqual(Object.keys(parsed).sort(), ["deleteRequiresReason", "editWindowMinutes"]);
  assert.equal("phrase" in MODERATION_LIMITS, false);
});
