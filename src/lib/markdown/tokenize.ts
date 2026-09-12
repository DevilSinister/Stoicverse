/**
 * The message markdown tokenizer.
 *
 * Zero imports, so the unit test loads this module directly and so it can run
 * on either side of the wire. It produces a tree, not HTML: the renderer turns
 * nodes into elements, which is what keeps a message body from ever becoming
 * `dangerouslySetInnerHTML`.
 *
 * This is deliberately *not* CommonMark. It is the subset people actually type
 * in a chat box, which is closer to Discord's dialect than to a document
 * format: no tables, no images, no reference links, no raw HTML. A message is
 * a sentence with emphasis, not a document.
 *
 * Two properties the rest of the page depends on:
 *
 *   * **Linear time.** Every scan advances `index`; nothing rescans from the
 *     start. A 10,000-character message is the cap, and a quadratic tokenizer
 *     over a few hundred of those in a channel is a frozen tab.
 *   * **Bounded depth.** Nesting stops at `MAX_DEPTH`; past it the delimiters
 *     are literal text. Unbounded nesting on attacker-controlled input is a
 *     stack overflow with extra steps.
 */

export const MAX_DEPTH = 8;

/** Beyond this many characters, an emoji-only message renders at normal size. */
export const JUMBO_EMOJI_LIMIT = 27;

export type MentionKind = "user" | "role" | "channel" | "everyone" | "here" | "legacy";

export type Token =
  | { type: "text"; value: string }
  | { type: "bold"; children: Token[] }
  | { type: "italic"; children: Token[] }
  | { type: "underline"; children: Token[] }
  | { type: "strike"; children: Token[] }
  | { type: "spoiler"; children: Token[] }
  | { type: "code"; value: string }
  | { type: "codeblock"; language: string | null; value: string }
  | { type: "quote"; children: Token[] }
  | { type: "heading"; level: 1 | 2 | 3; children: Token[] }
  | { type: "mention"; kind: MentionKind; id: string | null; label: string }
  | { type: "emoji"; name: string; id: string }
  | { type: "link"; href: string; label: string }
  | { type: "break" };

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

// Anchored at the current index, so each is tried once per position rather
// than scanned across the whole body.
const ENTITY_PATTERNS: { pattern: RegExp; build: (match: RegExpExecArray) => Token }[] = [
  {
    pattern: new RegExp(`^<@&(${UUID})>`),
    build: (match) => ({ type: "mention", kind: "role", id: match[1], label: "role" }),
  },
  {
    pattern: new RegExp(`^<@(${UUID})>`),
    build: (match) => ({ type: "mention", kind: "user", id: match[1], label: "member" }),
  },
  {
    pattern: new RegExp(`^<#(${UUID})>`),
    build: (match) => ({ type: "mention", kind: "channel", id: match[1], label: "channel" }),
  },
  {
    pattern: new RegExp(`^<:([a-z0-9_]{2,32}):(${UUID})>`),
    build: (match) => ({ type: "emoji", name: match[1], id: match[2] }),
  },
];

/**
 * `@everyone`, `@here`, and the legacy `@all` / `@tier-N`.
 *
 * The legacy pair became role mentions in phase 8 and nothing extracts them
 * any more, but they survive in messages written before that. They tokenize as
 * `legacy` so the renderer can show them greyed out rather than as a live
 * ping — dropping them would silently rewrite what somebody said.
 */
const AT_MENTION = /^@(everyone|here|all|tier-[1-5])(?![0-9A-Za-z_-])/;

const AUTOLINK = /^(https?:\/\/[^\s<>]+[^\s<>.,!?:;)\]}'"]|www\.[^\s<>]+[^\s<>.,!?:;)\]}'"])/;

/** A `<https://…>` wrapper means "link, but do not unfurl". The brackets are not shown. */
const SUPPRESSED_LINK = /^<(https?:\/\/[^\s<>]+)>/;

function isWordChar(character: string | undefined): boolean {
  return character !== undefined && /[0-9A-Za-z_]/.test(character);
}

type Cursor = { body: string; index: number };

function pushText(tokens: Token[], value: string) {
  if (value === "") return;
  const last = tokens[tokens.length - 1];
  // Merging as we go keeps the tree small; the character-at-a-time fallback
  // would otherwise emit one node per unmatched character.
  if (last && last.type === "text") {
    last.value += value;
    return;
  }
  tokens.push({ type: "text", value });
}

/**
 * Reads until `closer`, returning null if it never appears.
 *
 * Returning null rather than throwing is what makes an unmatched `**` render
 * as two asterisks instead of swallowing the rest of the message.
 */
function readUntil(cursor: Cursor, closer: string, depth: number): Token[] | null {
  const start = cursor.index;
  const closeAt = cursor.body.indexOf(closer, cursor.index);
  if (closeAt === -1) {
    cursor.index = start;
    return null;
  }
  const inner = cursor.body.slice(cursor.index, closeAt);
  cursor.index = closeAt + closer.length;
  return tokenizeInline(inner, depth + 1);
}

const INLINE_DELIMITERS: { open: string; close: string; type: "bold" | "italic" | "underline" | "strike" | "spoiler" }[] =
  [
    { open: "***", close: "***", type: "bold" },
    { open: "**", close: "**", type: "bold" },
    { open: "__", close: "__", type: "underline" },
    { open: "~~", close: "~~", type: "strike" },
    { open: "||", close: "||", type: "spoiler" },
    { open: "*", close: "*", type: "italic" },
    { open: "_", close: "_", type: "italic" },
  ];

function tokenizeInline(body: string, depth: number): Token[] {
  const tokens: Token[] = [];
  const cursor: Cursor = { body, index: 0 };

  while (cursor.index < body.length) {
    const character = body[cursor.index];
    const rest = body.slice(cursor.index);

    // A backslash escapes the next character and is never itself shown.
    if (character === "\\" && cursor.index + 1 < body.length) {
      pushText(tokens, body[cursor.index + 1]);
      cursor.index += 2;
      continue;
    }

    if (character === "\n") {
      tokens.push({ type: "break" });
      cursor.index += 1;
      continue;
    }

    // Inline code wins over every other delimiter, so `**` inside backticks is
    // two asterisks and not an unterminated bold.
    if (character === "`") {
      const closeAt = body.indexOf("`", cursor.index + 1);
      if (closeAt !== -1) {
        tokens.push({ type: "code", value: body.slice(cursor.index + 1, closeAt) });
        cursor.index = closeAt + 1;
        continue;
      }
    }

    if (character === "<") {
      const entity = ENTITY_PATTERNS.find((candidate) => candidate.pattern.test(rest));
      if (entity) {
        const match = entity.pattern.exec(rest);
        if (match) {
          tokens.push(entity.build(match));
          cursor.index += match[0].length;
          continue;
        }
      }
      const suppressed = SUPPRESSED_LINK.exec(rest);
      if (suppressed) {
        tokens.push({ type: "link", href: suppressed[1], label: suppressed[1] });
        cursor.index += suppressed[0].length;
        continue;
      }
    }

    if (character === "@" && !isWordChar(body[cursor.index - 1])) {
      const mention = AT_MENTION.exec(rest);
      if (mention) {
        const name = mention[1];
        const kind: MentionKind = name === "everyone" || name === "here" ? name : "legacy";
        tokens.push({ type: "mention", kind, id: null, label: `@${name}` });
        cursor.index += mention[0].length;
        continue;
      }
    }

    if (character === "h" || character === "w") {
      const link = AUTOLINK.exec(rest);
      if (link && !isWordChar(body[cursor.index - 1])) {
        const href = link[1].startsWith("www.") ? `https://${link[1]}` : link[1];
        tokens.push({ type: "link", href, label: link[1] });
        cursor.index += link[1].length;
        continue;
      }
    }

    if (depth < MAX_DEPTH) {
      const delimiter = INLINE_DELIMITERS.find((candidate) => rest.startsWith(candidate.open));
      if (delimiter) {
        cursor.index += delimiter.open.length;
        const children = readUntil(cursor, delimiter.close, depth);
        if (children !== null) {
          // `***` is bold wrapping italic, which is how everyone expects it to
          // read even though it is one delimiter.
          if (delimiter.open === "***") {
            tokens.push({ type: "bold", children: [{ type: "italic", children }] });
          } else if (delimiter.type === "bold") {
            tokens.push({ type: "bold", children });
          } else if (delimiter.type === "italic") {
            tokens.push({ type: "italic", children });
          } else if (delimiter.type === "underline") {
            tokens.push({ type: "underline", children });
          } else if (delimiter.type === "strike") {
            tokens.push({ type: "strike", children });
          } else {
            tokens.push({ type: "spoiler", children });
          }
          continue;
        }
        // No closer: the delimiter is literal text.
        pushText(tokens, delimiter.open);
        continue;
      }
    }

    pushText(tokens, character);
    cursor.index += 1;
  }

  return tokens;
}

/** `>` and `>>>` quotes, and `#`/`##`/`###` headings, which are line-level. */
function tokenizeBlock(body: string, depth: number): Token[] {
  const tokens: Token[] = [];
  const lines = body.split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    // `>>>` quotes everything that follows, to the end of the message.
    if (line.startsWith(">>> ") || line === ">>>") {
      const rest = [line.slice(4), ...lines.slice(index + 1)].join("\n");
      tokens.push({
        type: "quote",
        children: depth < MAX_DEPTH ? tokenizeBlock(rest, depth + 1) : [{ type: "text", value: rest }],
      });
      return tokens;
    }

    if (line.startsWith("> ") || line === ">") {
      // Consecutive `>` lines are one quote, the way a pasted excerpt reads.
      const quoted: string[] = [];
      while (index < lines.length && (lines[index].startsWith("> ") || lines[index] === ">")) {
        quoted.push(lines[index].slice(2));
        index += 1;
      }
      const inner = quoted.join("\n");
      tokens.push({
        type: "quote",
        children: depth < MAX_DEPTH ? tokenizeBlock(inner, depth + 1) : [{ type: "text", value: inner }],
      });
      continue;
    }

    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) {
      tokens.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        children: tokenizeInline(heading[2], depth + 1),
      });
      index += 1;
      if (index < lines.length) tokens.push({ type: "break" });
      continue;
    }

    tokens.push(...tokenizeInline(line, depth));
    index += 1;
    if (index < lines.length) tokens.push({ type: "break" });
  }

  return tokens;
}

/**
 * Turn a message body into a token tree.
 *
 * Fenced code blocks are lifted out first, because their contents must not be
 * tokenized at all — a ``` block containing `**` is code, not bold.
 */
export function tokenize(body: string): Token[] {
  const text = body ?? "";
  if (text === "") return [];

  const tokens: Token[] = [];
  let index = 0;

  while (index < text.length) {
    const fenceAt = text.indexOf("```", index);
    if (fenceAt === -1) {
      tokens.push(...tokenizeBlock(text.slice(index), 0));
      break;
    }

    const closeAt = text.indexOf("```", fenceAt + 3);
    if (closeAt === -1) {
      // An unterminated fence is literal text, not a block that eats the rest
      // of the message.
      tokens.push(...tokenizeBlock(text.slice(index), 0));
      break;
    }

    if (fenceAt > index) {
      tokens.push(...tokenizeBlock(text.slice(index, fenceAt), 0));
    }

    const raw = text.slice(fenceAt + 3, closeAt);
    const newlineAt = raw.indexOf("\n");
    // ```ts\ncode``` — the first line names a language only when a newline
    // follows it and it looks like one.
    const firstLine = newlineAt === -1 ? "" : raw.slice(0, newlineAt);
    const hasLanguage = newlineAt !== -1 && /^[a-zA-Z0-9+#-]{1,20}$/.test(firstLine);

    tokens.push({
      type: "codeblock",
      language: hasLanguage ? firstLine.toLowerCase() : null,
      value: (hasLanguage ? raw.slice(newlineAt + 1) : raw).replace(/^\n/, "").replace(/\n$/, ""),
    });

    index = closeAt + 3;
  }

  return tokens;
}

/**
 * Whether a message is emoji and nothing else, and therefore renders large.
 *
 * Chat clients do this and people expect it. The length cap stops a wall of
 * emoji from becoming a wall of 48px emoji.
 */
export function isJumboEmoji(body: string): boolean {
  const text = (body ?? "").trim();
  if (text === "" || text.length > JUMBO_EMOJI_LIMIT) return false;

  // Custom emoji tokens count as emoji; anything else non-emoji disqualifies it.
  const withoutCustom = text.replace(new RegExp(`<:[a-z0-9_]{2,32}:${UUID}>`, "g"), "");
  const remainder = withoutCustom.replace(/\s/g, "");
  if (remainder === "") return withoutCustom !== text;
  // No ASCII at all, and short: the same shape the reaction validator uses.
  return !/[\x00-\x7F]/.test(remainder);
}

/** Every mention in a body, in order, for the composer's "who will this ping" line. */
export function collectMentions(tokens: Token[]): { kind: MentionKind; id: string | null }[] {
  const found: { kind: MentionKind; id: string | null }[] = [];
  const walk = (nodes: Token[]) => {
    for (const node of nodes) {
      if (node.type === "mention") found.push({ kind: node.kind, id: node.id });
      else if ("children" in node) walk(node.children);
    }
  };
  walk(tokens);
  return found;
}
