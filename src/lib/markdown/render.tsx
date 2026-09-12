"use client";

import { Fragment, useState, type ReactNode } from "react";

import { tokenize, type Token } from "@/lib/markdown/tokenize";

/**
 * Turns a token tree into elements.
 *
 * Never `dangerouslySetInnerHTML`. A message body is the most attacker-facing
 * string in the product — anyone who can post controls it — so it reaches the
 * DOM as React children and nothing else. That is the whole reason the
 * tokenizer emits a tree rather than HTML.
 */

export type MentionResolvers = {
  user: (id: string) => string | undefined;
  role: (id: string) => { name: string; color: string | null } | undefined;
  channel: (id: string) => string | undefined;
  /** Custom emoji arrive in phase 6; until then the token renders as `:name:`. */
  emoji?: (id: string) => string | undefined;
};

const EMPTY: MentionResolvers = {
  user: () => undefined,
  role: () => undefined,
  channel: () => undefined,
};

const mentionChip =
  "rounded px-1 py-0.5 text-[0.95em] font-medium text-accent bg-accent/10 hover:bg-accent/20 transition-colors";

function Spoiler({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      aria-expanded={revealed}
      // A spoiler that is still hidden must not be readable by a screen reader
      // either, or it is not a spoiler.
      aria-label={revealed ? undefined : "Reveal spoiler"}
      className={
        revealed
          ? "rounded bg-surface-container-high px-1"
          : "focus-ring cursor-pointer select-none rounded bg-surface-container-highest px-1 text-transparent"
      }
    >
      <span aria-hidden={revealed ? undefined : true}>{children}</span>
    </button>
  );
}

function renderTokens(tokens: Token[], resolvers: MentionResolvers, keyPrefix = ""): ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}${index}`;

    switch (token.type) {
      case "text":
        return <Fragment key={key}>{token.value}</Fragment>;

      case "break":
        return <br key={key} />;

      case "bold":
        return <strong key={key}>{renderTokens(token.children, resolvers, `${key}.`)}</strong>;

      case "italic":
        return <em key={key}>{renderTokens(token.children, resolvers, `${key}.`)}</em>;

      case "underline":
        return <u key={key}>{renderTokens(token.children, resolvers, `${key}.`)}</u>;

      case "strike":
        return <s key={key}>{renderTokens(token.children, resolvers, `${key}.`)}</s>;

      case "spoiler":
        return <Spoiler key={key}>{renderTokens(token.children, resolvers, `${key}.`)}</Spoiler>;

      case "code":
        return (
          <code key={key} className="rounded bg-surface-container-highest px-1 py-0.5 font-mono text-[0.9em]">
            {token.value}
          </code>
        );

      case "codeblock":
        return (
          <pre
            key={key}
            // Wide code scrolls inside its own box; the message column never
            // scrolls sideways.
            className="my-1 overflow-x-auto rounded-lg border border-surgical-steel bg-surface-container-lowest p-3"
          >
            <code className="font-mono text-[0.85em] leading-6">{token.value}</code>
          </pre>
        );

      case "quote":
        return (
          <blockquote key={key} className="my-1 border-l-2 border-surgical-steel pl-3 text-on-surface-variant">
            {renderTokens(token.children, resolvers, `${key}.`)}
          </blockquote>
        );

      case "heading": {
        const size = token.level === 1 ? "text-lg" : token.level === 2 ? "text-base" : "text-sm";
        return (
          <strong key={key} className={`mt-1 block font-semibold ${size} text-on-surface`}>
            {renderTokens(token.children, resolvers, `${key}.`)}
          </strong>
        );
      }

      case "mention": {
        if (token.kind === "legacy") {
          // Phase 8 stopped extracting `@all` and `@tier-N`. They still exist
          // in older messages, and showing them as live pings would claim a
          // notification went out that never did.
          return (
            <span key={key} className="rounded px-1 text-fog-muted" title="This mention is no longer delivered">
              {token.label}
            </span>
          );
        }
        if (token.kind === "everyone" || token.kind === "here") {
          return (
            <span key={key} className={mentionChip}>
              {token.label}
            </span>
          );
        }
        if (token.kind === "user") {
          const name = token.id ? resolvers.user(token.id) : undefined;
          return (
            <span key={key} className={mentionChip}>
              {`@${name ?? "unknown-member"}`}
            </span>
          );
        }
        if (token.kind === "role") {
          const role = token.id ? resolvers.role(token.id) : undefined;
          return (
            <span
              key={key}
              className={mentionChip}
              style={role?.color ? { color: role.color, backgroundColor: `${role.color}1a` } : undefined}
            >
              {`@${role?.name ?? "deleted-role"}`}
            </span>
          );
        }
        const channelName = token.id ? resolvers.channel(token.id) : undefined;
        return (
          <a key={key} href={token.id ? `/channels/${token.id}` : undefined} className={mentionChip}>
            {`#${channelName ?? "deleted-channel"}`}
          </a>
        );
      }

      case "emoji": {
        const url = resolvers.emoji?.(token.id);
        if (!url) {
          // No custom emoji exist until phase 6, so the readable fallback is
          // the name rather than a broken image.
          return (
            <span key={key} className="text-fog-muted">
              {`:${token.name}:`}
            </span>
          );
        }
        // A custom emoji is a 256 KB asset already sized by the upload, so
        // next/image would add a loader round trip per emoji in a message.
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={key} src={url} alt={`:${token.name}:`} className="inline-block size-5 align-text-bottom" />
        );
      }

      case "link":
        return (
          <a
            key={key}
            href={token.href}
            target="_blank"
            // noreferrer as well as noopener: a member's link should not leak
            // which channel it was posted in.
            rel="noopener noreferrer nofollow ugc"
            className="text-accent underline underline-offset-2 hover:text-accent/80"
          >
            {token.label}
          </a>
        );

      default:
        return null;
    }
  });
}

export function MarkdownBody({
  body,
  resolvers = EMPTY,
  jumbo = false,
}: {
  body: string | null;
  resolvers?: MentionResolvers;
  jumbo?: boolean;
}) {
  if (!body) return null;
  return (
    <div className={`whitespace-pre-wrap break-words ${jumbo ? "text-3xl leading-relaxed" : ""}`}>
      {renderTokens(tokenize(body), resolvers)}
    </div>
  );
}
