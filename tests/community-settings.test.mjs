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
  matchesBlockedWord,
  MODERATION_LIMITS,
  MODERATOR_BASELINE,
  parseBlockedPhrase,
  parseIdentity,
  parseModeration,
  parsePermissionConfig,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
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
  slowModeSeconds: 0,
  editWindowMinutes: 0,
  deleteRequiresReason: false,
  blockedWordMode: "block",
  blockedWordMatch: "word",
  ...overrides,
});

test("an unknown permission key is dropped, exactly as the database CHECK drops it", () => {
  // A typo like mention_All would otherwise read as NULL in SQL: the grant
  // silently never applies and nothing errors.
  const parsed = parsePermissionConfig({ pin: true, mention_All: true, post: "yes", manage_channels: false });
  assert.deepEqual(parsed, { pin: true, manage_channels: false });
});

test("parsePermissionConfig survives the shapes jsonb can actually hold", () => {
  assert.deepEqual(parsePermissionConfig(null), {});
  assert.deepEqual(parsePermissionConfig([]), {});
  assert.deepEqual(parsePermissionConfig("pin"), {});
});

test("the moderator baseline withholds the two escalating grants", () => {
  // @all reaches every active member at once and channel management reshapes
  // what everyone sees. Neither is free with the moderator role.
  assert.ok(!MODERATOR_BASELINE.includes("mention_all"));
  assert.ok(!MODERATOR_BASELINE.includes("manage_channels"));
  assert.deepEqual(MODERATOR_BASELINE, ["post", "pin", "delete_others", "mention_tier"]);
});

test("every permission key carries a label, and the escalating ones are marked", () => {
  for (const key of PERMISSION_KEYS) {
    assert.ok(PERMISSION_LABELS[key], `${key} has no label`);
  }
  assert.equal(PERMISSION_LABELS.delete_others.escalating, true);
  assert.equal(PERMISSION_LABELS.manage_channels.escalating, true);
  assert.equal(PERMISSION_LABELS.mention_all.escalating, true);
  assert.equal(PERMISSION_LABELS.post.escalating, false);
});

test("word mode matches a whole word and ignores it inside a longer one", () => {
  assert.equal(matchesBlockedWord("a badword here", ["badword"], "word"), "badword");
  assert.equal(matchesBlockedWord("badwording is fine", ["badword"], "word"), null);
  assert.equal(matchesBlockedWord("BADWORD shouting", ["badword"], "word"), "badword");
});

test("substring mode over-matches, which is the whole reason the test box exists", () => {
  // "classic" contains "ass". The interface has to let a creator discover this
  // before members do.
  assert.equal(matchesBlockedWord("a classic mistake", ["ass"], "substring"), "ass");
  assert.equal(matchesBlockedWord("a classic mistake", ["ass"], "word"), null);
});

test("a phrase with regex metacharacters is matched literally, not compiled", () => {
  // Otherwise a listed phrase could blow up or silently match everything.
  assert.equal(matchesBlockedWord("buy c++ now", ["c++"], "word"), "c++");
  assert.equal(matchesBlockedWord("anything at all", [".*"], "word"), null);
});

test("the matcher is honest about being a speed bump", () => {
  // Separator characters defeat it. The UI says so; this pins the behaviour so
  // nobody later mistakes it for a filter.
  assert.equal(matchesBlockedWord("b-a-d-w-o-r-d", ["badword"], "substring"), null);
});

test("moderation bounds mirror the database constraint", () => {
  assert.throws(() => parseModeration(moderation({ slowModeSeconds: 21601 })), /0 seconds/);
  assert.throws(() => parseModeration(moderation({ editWindowMinutes: 10081 })), /0 minutes/);
  assert.throws(() => parseModeration(moderation({ blockedWordMode: "delete" })), /block the message or flag/);
  assert.throws(() => parseModeration(moderation({ blockedWordMatch: "regex" })), /whole words or any substring/);
  assert.equal(parseModeration(moderation({ slowModeSeconds: 21600 })).slowModeSeconds, 21600);
});

test("blocked phrases are lowercased, trimmed and bounded", () => {
  assert.equal(parseBlockedPhrase("  BadWord  "), "badword");
  assert.throws(() => parseBlockedPhrase("a"), /between 2 and 60/);
  assert.throws(() => parseBlockedPhrase("x".repeat(61)), /between 2 and 60/);
  assert.equal(MODERATION_LIMITS.phrase.max, 60);
});
