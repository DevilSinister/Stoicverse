import assert from "node:assert/strict";
import test from "node:test";

import { collectMentions, isJumboEmoji, MAX_DEPTH, tokenize } from "../src/lib/markdown/tokenize.ts";

/** Flattens a tree to the plain text a reader would see. */
function plain(tokens) {
  return tokens
    .map((token) => {
      if (token.type === "text") return token.value;
      if (token.type === "code" || token.type === "codeblock") return token.value;
      if (token.type === "mention") return token.label;
      if (token.type === "link") return token.label;
      if (token.type === "emoji") return `:${token.name}:`;
      if (token.type === "break") return "\n";
      return plain(token.children ?? []);
    })
    .join("");
}

const types = (tokens) => tokens.map((token) => token.type);

test("plain text is one node, not one node per character", () => {
  assert.deepEqual(tokenize("hello there"), [{ type: "text", value: "hello there" }]);
});

test("emphasis nests, and *** is bold wrapping italic", () => {
  assert.deepEqual(types(tokenize("**bold**")), ["bold"]);
  assert.deepEqual(types(tokenize("*italic*")), ["italic"]);
  assert.deepEqual(types(tokenize("__underline__")), ["underline"]);
  assert.deepEqual(types(tokenize("~~strike~~")), ["strike"]);
  assert.deepEqual(types(tokenize("||spoiler||")), ["spoiler"]);

  const triple = tokenize("***both***");
  assert.equal(triple[0].type, "bold");
  assert.equal(triple[0].children[0].type, "italic");
  assert.equal(plain(triple), "both");
});

test("an unmatched delimiter is literal text, not a swallowed message", () => {
  // The failure mode this prevents: one stray asterisk eating the rest of the
  // message because the tokenizer kept looking for a closer.
  assert.equal(plain(tokenize("2 ** 3 is eight")), "2 ** 3 is eight");
  assert.deepEqual(tokenize("**never closed"), [{ type: "text", value: "**never closed" }]);
});

test("inline code wins over every other delimiter", () => {
  const tokens = tokenize("use `**not bold**` here");
  assert.equal(tokens[1].type, "code");
  assert.equal(tokens[1].value, "**not bold**");
});

test("a fenced block is never tokenized, with or without a language", () => {
  const withLang = tokenize("```ts\nconst x = **y**;\n```");
  assert.equal(withLang[0].type, "codeblock");
  assert.equal(withLang[0].language, "ts");
  assert.equal(withLang[0].value, "const x = **y**;");

  const withoutLang = tokenize("```\njust text\n```");
  assert.equal(withoutLang[0].language, null);
});

test("an unterminated fence is text, not a block that eats the message", () => {
  const tokens = tokenize("```\nstill typing");
  assert.equal(
    tokens.some((token) => token.type === "codeblock"),
    false,
  );
  assert.match(plain(tokens), /still typing/);
});

test("a backslash escapes the next character and is not shown", () => {
  assert.deepEqual(tokenize("\\*not italic\\*"), [{ type: "text", value: "*not italic*" }]);
});

test("mentions carry ids so a rename cannot break an old message", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  const user = tokenize(`hi <@${id}>`);
  assert.equal(user[1].type, "mention");
  assert.equal(user[1].kind, "user");
  assert.equal(user[1].id, id);

  assert.equal(tokenize(`<@&${id}>`)[0].kind, "role");
  assert.equal(tokenize(`<#${id}>`)[0].kind, "channel");

  const emoji = tokenize(`<:party:${id}>`);
  assert.equal(emoji[0].type, "emoji");
  assert.equal(emoji[0].name, "party");
});

test("@everyone is live and the legacy forms are marked, not dropped", () => {
  assert.equal(tokenize("@everyone")[0].kind, "everyone");
  assert.equal(tokenize("@here")[0].kind, "here");
  // Phase 8 stopped extracting these, but old messages still contain them.
  // Dropping them would silently rewrite what somebody said.
  assert.equal(tokenize("@all")[0].kind, "legacy");
  assert.equal(tokenize("@tier-3")[0].kind, "legacy");
  // Not a mention mid-word.
  assert.equal(plain(tokenize("email@everyone.com")), "email@everyone.com");
});

test("links autolink, and <url> is a link without its brackets", () => {
  const bare = tokenize("see https://example.com/x now");
  assert.equal(bare[1].type, "link");
  assert.equal(bare[1].href, "https://example.com/x");

  // Trailing punctuation belongs to the sentence, not the URL.
  assert.equal(tokenize("see https://example.com.")[1].href, "https://example.com");

  assert.equal(tokenize("www.example.com")[0].href, "https://www.example.com");

  const suppressed = tokenize("<https://example.com>");
  assert.equal(suppressed[0].type, "link");
  assert.equal(plain(suppressed), "https://example.com");
});

test("quotes and headings are line-level", () => {
  const quote = tokenize("> quoted line\nafter");
  assert.equal(quote[0].type, "quote");
  assert.equal(plain(quote[0].children), "quoted line");

  // Consecutive > lines are one quote, the way a pasted excerpt reads.
  assert.equal(tokenize("> one\n> two").filter((token) => token.type === "quote").length, 1);

  // >>> quotes to the end of the message.
  const block = tokenize(">>> everything\nafter too");
  assert.equal(block.length, 1);
  assert.equal(block[0].type, "quote");

  const heading = tokenize("## Title");
  assert.equal(heading[0].type, "heading");
  assert.equal(heading[0].level, 2);
});

test("nesting is bounded, so a crafted message cannot blow the stack", () => {
  const deep = "*".repeat(MAX_DEPTH + 6) + "x" + "*".repeat(MAX_DEPTH + 6);
  const tokens = tokenize(deep);
  assert.ok(Array.isArray(tokens));
  assert.match(plain(tokens), /x/);
});

test("tokenizing is linear, not quadratic", () => {
  // A 10,000-character body is the platform cap. If this ever goes quadratic a
  // channel of long messages freezes the tab, and the symptom looks like a
  // rendering bug rather than a tokenizer one.
  const body = "word **bold** and `code` ".repeat(400);
  const start = process.hrtime.bigint();
  tokenize(body);
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(elapsedMs < 250, `tokenizing took ${elapsedMs.toFixed(1)}ms`);
});

test("emoji-only messages render large, and long ones do not", () => {
  assert.equal(isJumboEmoji("🔥"), true);
  assert.equal(isJumboEmoji("🔥 🎉"), true);
  assert.equal(isJumboEmoji("🔥 nice"), false);
  assert.equal(isJumboEmoji(""), false);
  assert.equal(isJumboEmoji("🔥".repeat(40)), false);
});

test("collectMentions finds every mention including nested ones", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  const found = collectMentions(tokenize(`**hi <@${id}>** and @everyone`));
  assert.deepEqual(
    found.map((mention) => mention.kind),
    ["user", "everyone"],
  );
});
