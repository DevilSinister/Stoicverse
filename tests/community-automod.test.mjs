import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTOMOD_LIMITS,
  compileKeywordPattern,
  describeRule,
  formatDuration,
  KEYWORD_WILDCARD_BOUND,
  matchesKeywordRule,
  parseAutomodRule,
  parseDomain,
  parseKeyword,
} from "../src/lib/community-settings/automod.ts";

/**
 * The vectors below are the parity contract with
 * `public.community_compile_keyword_pattern` in migration 20260912040000.
 *
 * They were produced by running both implementations against the same inputs
 * on the live database on 2026-09-12 and comparing the strings. If this file
 * changes, run them against the database again — a mirror that has drifted is
 * worse than no mirror, because the interface keeps claiming to preview what
 * the database will do.
 */
const PARITY_VECTORS = [
  {
    keywords: ["scam*", "free money"],
    mode: "word",
    pattern: "(^|[^[:alnum:]_])(scam[[:alnum:]_]{0,30}|free money)([^[:alnum:]_]|$)",
  },
  {
    keywords: ["scam*", "free money"],
    mode: "substring",
    pattern: "(scam[[:alnum:]_]{0,30}|free money)",
  },
  { keywords: ["c++"], mode: "word", pattern: "(^|[^[:alnum:]_])(c\\+\\+)([^[:alnum:]_]|$)" },
  { keywords: ["a.b"], mode: "word", pattern: "(^|[^[:alnum:]_])(a\\.b)([^[:alnum:]_]|$)" },
  { keywords: ["*"], mode: "word", pattern: "(^|[^[:alnum:]_])([[:alnum:]_]{0,30})([^[:alnum:]_]|$)" },
  { keywords: ["hello world", "bye"], mode: "substring", pattern: "(hello world|bye)" },
  { keywords: ["  MiXeD  "], mode: "word", pattern: "(^|[^[:alnum:]_])(mixed)([^[:alnum:]_]|$)" },
];

test("the keyword compiler matches the SQL character for character", () => {
  for (const vector of PARITY_VECTORS) {
    assert.equal(
      compileKeywordPattern(vector.keywords, vector.mode),
      vector.pattern,
      `drifted for ${JSON.stringify(vector.keywords)} in ${vector.mode} mode`,
    );
  }
});

test("the wildcard is bounded, so a phrase list cannot stall a connection", () => {
  const pattern = compileKeywordPattern(["a*"], "word");
  assert.match(pattern, new RegExp(`\\{0,${KEYWORD_WILDCARD_BOUND}\\}`));
  // `.*` would be the obvious implementation and is the one that hangs.
  assert.equal(pattern.includes(".*"), false);
});

test("every regex metacharacter except the wildcard is escaped", () => {
  // Otherwise a listed phrase could blow up or silently match everything.
  assert.equal(compileKeywordPattern([".*"], "substring"), "(\\.[[:alnum:]_]{0,30})");
  assert.equal(compileKeywordPattern(["(a|b)"], "substring"), "(\\(a\\|b\\))");
});

test("word mode matches a whole word and ignores it inside a longer one", () => {
  assert.equal(matchesKeywordRule("a badword here", ["badword"], "word"), true);
  assert.equal(matchesKeywordRule("badwording is fine", ["badword"], "word"), false);
  assert.equal(matchesKeywordRule("BADWORD shouting", ["badword"], "word"), true);
});

test("the wildcard extends a word but respects the boundary", () => {
  // Observed on the database in these exact shapes: "scamp" is caught,
  // "descam" is not, because the wildcard extends forwards only.
  assert.equal(matchesKeywordRule("total scamp here", ["scam*"], "word"), true);
  assert.equal(matchesKeywordRule("a descam thing", ["scam*"], "word"), false);
});

test("substring mode over-matches, which is the whole reason the test box exists", () => {
  // "classic" contains "ass". The interface has to let a creator discover this
  // before members do.
  assert.equal(matchesKeywordRule("a classic mistake", ["ass"], "substring"), true);
  assert.equal(matchesKeywordRule("a classic mistake", ["ass"], "word"), false);
});

test("the matcher is honest about being a speed bump", () => {
  // Separator characters defeat it. The UI says so; this pins the behaviour so
  // nobody later mistakes it for a filter.
  assert.equal(matchesKeywordRule("b-a-d-w-o-r-d", ["badword"], "substring"), false);
});

test("keywords are lowercased, trimmed and restricted to what SQL accepts", () => {
  assert.equal(parseKeyword("  BadWord  "), "badword");
  assert.throws(() => parseKeyword("a"), /between 2 and 60/);
  assert.throws(() => parseKeyword("x".repeat(61)), /between 2 and 60/);
  // The allowed class mirrors `private.automod_assert_keywords`.
  assert.throws(() => parseKeyword("a(b)"), /may only contain/);
  assert.equal(parseKeyword("don't stop"), "don't stop");
  assert.equal(parseKeyword("scam*"), "scam*");
});

test("a domain is a hostname, not a URL", () => {
  assert.equal(parseDomain("https://www.YouTube.com/watch?v=1"), "youtube.com");
  assert.equal(parseDomain(" example.co.uk "), "example.co.uk");
  assert.throws(() => parseDomain("not a domain"), /is not a domain/);
  assert.throws(() => parseDomain("localhost"), /is not a domain/);
});

const rule = (overrides = {}) => ({
  name: "Test rule",
  kind: "keyword",
  keywords: ["badword"],
  matchMode: "word",
  actionBlock: true,
  ...overrides,
});

test("a rule carries only the fields its kind uses", () => {
  // The database's per-kind CHECK rejects anything else, and a 23514 is a
  // worse message than any of ours.
  const keyword = parseAutomodRule(rule());
  assert.deepEqual(keyword.keywords, ["badword"]);
  assert.equal(keyword.mentionLimit, null);
  assert.equal(keyword.presetKey, null);
  assert.deepEqual(keyword.allowedDomains, []);

  const mention = parseAutomodRule(rule({ kind: "mention_spam", mentionLimit: 6 }));
  assert.equal(mention.mentionLimit, 6);
  assert.deepEqual(mention.keywords, []);
});

test("a timeout cannot be issued without blocking the message", () => {
  // Otherwise the member is removed while the message they were removed for
  // stays up, which reads to everyone else as moderation for nothing.
  assert.throws(
    () => parseAutomodRule(rule({ actionBlock: false, timeoutSeconds: 3600 })),
    /has to block the message too/,
  );
  assert.equal(parseAutomodRule(rule({ timeoutSeconds: 3600 })).timeoutSeconds, 3600);
});

test("rule bounds mirror the database constraints", () => {
  assert.throws(() => parseAutomodRule(rule({ name: "x" })), /between 2 and 60/);
  assert.throws(() => parseAutomodRule(rule({ kind: "mention_spam", mentionLimit: 51 })), /between 1 and 50/);
  assert.throws(
    () => parseAutomodRule(rule({ kind: "duplicate_spam", duplicateCount: 1, duplicateWindowSeconds: 60 })),
    /between 2 and 20/,
  );
  assert.throws(() => parseAutomodRule(rule({ timeoutSeconds: 59 })), /1 minute and 28 days/);
  assert.equal(AUTOMOD_LIMITS.timeoutSeconds.max, 2419200);
  assert.equal(AUTOMOD_LIMITS.rules, 25);
});

test("an empty keyword rule is rejected rather than matching everything", () => {
  assert.throws(() => parseAutomodRule(rule({ keywords: [] })), /at least one word/);
  assert.equal(compileKeywordPattern([], "word"), null);
  assert.equal(compileKeywordPattern(["   "], "word"), null);
});

test("an empty allow-list is meaningful, and means every link", () => {
  const parsed = parseAutomodRule(rule({ kind: "link_filter", allowedDomains: [] }));
  assert.deepEqual(parsed.allowedDomains, []);
  assert.match(describeRule(parsed), /any link/);
});

test("duplicate keywords and domains collapse", () => {
  assert.deepEqual(parseAutomodRule(rule({ keywords: ["a b", "A B", " a b "] })).keywords, ["a b"]);
  assert.deepEqual(
    parseAutomodRule(rule({ kind: "link_filter", allowedDomains: ["x.com", "https://X.com/y"] })).allowedDomains,
    ["x.com"],
  );
});

test("a duration reads as a person would say it", () => {
  assert.equal(formatDuration(60), "1 minute");
  assert.equal(formatDuration(300), "5 minutes");
  assert.equal(formatDuration(3600), "1 hour");
  assert.equal(formatDuration(86400), "1 day");
  assert.equal(formatDuration(2419200), "28 days");
});

test("a rule describes both what it catches and what it then does", () => {
  const summary = describeRule(parseAutomodRule(rule({ timeoutSeconds: 3600 })));
  assert.match(summary, /1 word/);
  assert.match(summary, /blocks the message/);
  assert.match(summary, /times the member out for 1 hour/);

  const advisory = describeRule(parseAutomodRule(rule({ actionBlock: false })));
  assert.match(advisory, /alerts moderators/);
});
