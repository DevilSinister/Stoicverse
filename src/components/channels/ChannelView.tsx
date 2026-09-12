"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CornerUpLeft, FileText, Hash, Loader2, WifiOff } from "lucide-react";

import { toggleReaction } from "@/app/community/actions";
import { Composer } from "@/components/channels/Composer";
import { mergeMessage, useChannelLive, useCommunity, type ChannelRow } from "@/components/channels/CommunityProvider";
import { continuesGroup, startsNewDay } from "@/lib/channels/grouping";
import { COMPOSER_NOTICE } from "@/lib/channels/permissions";
import { MESSAGE_PAGE_SIZE } from "@/lib/community/constants";
import type { ChannelMessage } from "@/lib/community/messages";
import { MarkdownBody } from "@/lib/markdown/render";
import { isJumboEmoji } from "@/lib/markdown/tokenize";
import { createClient } from "@/lib/supabase/client";

/**
 * One channel: its header, its messages, and the composer.
 *
 * The server renders the first page; everything after that is fetched from the
 * browser. Paging is a `supabase.rpc` call rather than a server action because
 * Next 16 dispatches actions sequentially per client — scrolling up twice
 * quickly would queue the second read behind the first.
 */

/** The RPC's snake_case row as the shape the list renders. */
export function toClientMessage(row: Record<string, unknown>): ChannelMessage {
  return {
    id: row.id as string,
    authorId: (row.author_id as string | null) ?? null,
    authorName: (row.author_name as string) ?? "Former member",
    authorAvatar: (row.author_avatar as string | null) ?? null,
    authorColor: (row.author_color as string | null) ?? null,
    body: (row.body as string | null) ?? null,
    postType: (row.post_type as string) ?? "post",
    isPinned: Boolean(row.is_pinned),
    createdAt: row.created_at as string,
    editedAt: (row.edited_at as string | null) ?? null,
    clientNonce: (row.client_nonce as string | null) ?? null,
    replyToPostId: (row.reply_to_post_id as string | null) ?? null,
    replyAuthorName: (row.reply_author_name as string | null) ?? null,
    replyExcerpt: (row.reply_excerpt as string | null) ?? null,
    threadId: (row.thread_id as string | null) ?? null,
    threadName: (row.thread_name as string | null) ?? null,
    threadMessageCount: (row.thread_message_count as number | null) ?? null,
    attachments: (row.attachments as ChannelMessage["attachments"] | null) ?? [],
    reactions: (row.reactions as ChannelMessage["reactions"] | null) ?? [],
  };
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function dayOf(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

function Attachments({ attachments, urls }: { attachments: ChannelMessage["attachments"]; urls: Map<string, string> }) {
  if (attachments.length === 0) return null;

  return (
    <ul className="mt-1 flex flex-wrap gap-2">
      {attachments.map((attachment) => {
        const href = urls.get(attachment.path);
        const isImage = attachment.mimeType.startsWith("image/");
        return (
          <li key={attachment.id}>
            {isImage && href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="focus-ring block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={href}
                  alt=""
                  className="max-h-72 max-w-full rounded-lg border border-surgical-steel object-cover"
                />
              </a>
            ) : (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring flex items-center gap-2 rounded-lg border border-surgical-steel px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-low"
              >
                <FileText size={14} aria-hidden="true" />
                {attachment.path.split("/").pop()}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Reactions({
  message,
  canReact,
  onChanged,
}: {
  message: ChannelMessage;
  canReact: boolean;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  if (message.reactions.length === 0) return null;

  return (
    <ul className="mt-1 flex flex-wrap gap-1">
      {message.reactions.map((reaction) => (
        <li key={reaction.emoji}>
          <button
            type="button"
            disabled={!canReact || pending === reaction.emoji}
            onClick={async () => {
              setPending(reaction.emoji);
              await toggleReaction(message.id, reaction.emoji);
              setPending(null);
              onChanged();
            }}
            aria-pressed={reaction.mine}
            className={`focus-ring flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors disabled:opacity-50 ${
              reaction.mine
                ? "border-accent bg-accent/15 text-on-surface"
                : "border-surgical-steel text-fog-muted hover:bg-surface-container-low"
            }`}
          >
            <span aria-hidden="true">{reaction.emoji}</span>
            <span>{reaction.count}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function MessageRow({
  message,
  grouped,
  urls,
  canReact,
  canReply,
  onReply,
  onChanged,
}: {
  message: ChannelMessage;
  grouped: boolean;
  urls: Map<string, string>;
  canReact: boolean;
  canReply: boolean;
  onReply: (message: ChannelMessage) => void;
  onChanged: () => void;
}) {
  const { resolvers } = useCommunity();
  const jumbo = isJumboEmoji(message.body ?? "");

  if (message.postType === "system") {
    return (
      <li className="px-4 py-1 text-xs italic text-fog-muted">
        <MarkdownBody body={message.body} resolvers={resolvers} />
      </li>
    );
  }

  return (
    <li className={`group relative px-4 hover:bg-surface-container-lowest/60 ${grouped ? "py-0.5" : "pb-0.5 pt-3"}`}>
      {message.replyToPostId ? (
        <p className="mb-0.5 flex items-center gap-1 pl-12 text-xs text-fog-muted">
          <CornerUpLeft size={12} aria-hidden="true" />
          <span className="font-medium">{message.replyAuthorName ?? "someone"}</span>
          <span className="truncate">{message.replyExcerpt}</span>
        </p>
      ) : null}

      <div className="flex gap-3">
        <div className="w-9 shrink-0">
          {grouped ? null : message.authorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={message.authorAvatar} alt="" className="size-9 rounded-full object-cover" />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-full bg-surface-container-high text-sm font-semibold text-on-surface-variant">
              {message.authorName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {grouped ? null : (
            <p className="flex items-baseline gap-2">
              <span
                className="text-sm font-semibold text-on-surface"
                style={message.authorColor ? { color: message.authorColor } : undefined}
              >
                {message.authorName}
              </span>
              <time dateTime={message.createdAt} className="text-[11px] text-fog-muted">
                {timeOf(message.createdAt)}
              </time>
            </p>
          )}

          <div className="text-sm leading-6 text-on-surface-variant">
            <MarkdownBody body={message.body} resolvers={resolvers} jumbo={jumbo} />
            {message.editedAt ? <span className="ml-1 text-[10px] text-fog-muted">(edited)</span> : null}
          </div>

          <Attachments attachments={message.attachments} urls={urls} />
          <Reactions message={message} canReact={canReact} onChanged={onChanged} />

          {message.threadId ? (
            <p className="mt-1 text-xs text-accent">
              {`${message.threadName ?? "Thread"} — ${message.threadMessageCount ?? 0} replies`}
            </p>
          ) : null}
        </div>

        {canReply ? (
          <button
            type="button"
            onClick={() => onReply(message)}
            aria-label={`Reply to ${message.authorName}`}
            className="focus-ring absolute right-4 top-1 hidden rounded-lg border border-surgical-steel bg-surface-container-low p-1.5 text-fog-muted hover:text-on-surface group-hover:block"
          >
            <CornerUpLeft size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function ChannelView({
  channel,
  initialMessages,
  initialCursor,
  initialUrls,
}: {
  channel: ChannelRow;
  initialMessages: ChannelMessage[];
  initialCursor: { createdAt: string; id: string } | null;
  initialUrls: Record<string, string>;
}) {
  const { affordances } = useCommunity();
  const permissions = affordances(channel.id);

  // The RPC returns newest first; the list reads oldest at the top.
  const [messages, setMessages] = useState<ChannelMessage[]>(() => [...initialMessages].reverse());
  const [cursor, setCursor] = useState(initialCursor);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [replyTo, setReplyTo] = useState<ChannelMessage | null>(null);
  const [urls, setUrls] = useState(() => new Map(Object.entries(initialUrls)));
  const paneRef = useRef<HTMLOListElement | null>(null);
  const atBottomRef = useRef(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("community_channel_messages", {
      channel: channel.id,
      before_created_at: null,
      before_id: null,
      page_size: MESSAGE_PAGE_SIZE,
      thread: null,
    });
    if (!data) return;
    setMessages((data as Record<string, unknown>[]).map(toClientMessage).reverse());
  }, [channel.id]);

  // The realtime payload is the raw row: no author name, no reactions, no
  // attachments. Re-reading the page is one round trip and returns the shape
  // the list actually renders, rather than a half-populated bubble.
  const { connected } = useChannelLive(
    channel.id,
    useCallback(() => void refresh(), [refresh]),
    useCallback(() => void refresh(), [refresh]),
  );

  // Stick to the bottom only when the reader is already there, so an arriving
  // message never yanks somebody out of the history they are reading.
  useEffect(() => {
    const pane = paneRef.current;
    if (pane && atBottomRef.current) pane.scrollTop = pane.scrollHeight;
  }, [messages]);

  const loadOlder = useCallback(async () => {
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    const supabase = createClient();
    const { data } = await supabase.rpc("community_channel_messages", {
      channel: channel.id,
      before_created_at: cursor.createdAt,
      before_id: cursor.id,
      page_size: MESSAGE_PAGE_SIZE,
      thread: null,
    });
    const rows = ((data ?? []) as Record<string, unknown>[]).map(toClientMessage);
    const oldest = rows[rows.length - 1];
    setMessages((current) => [...[...rows].reverse(), ...current]);
    setCursor(rows.length === MESSAGE_PAGE_SIZE && oldest ? { createdAt: oldest.createdAt, id: oldest.id } : null);
    setLoadingOlder(false);
  }, [channel.id, cursor, loadingOlder]);

  const rendered = useMemo(() => {
    const nodes: { message: ChannelMessage; grouped: boolean; day: string | null }[] = [];
    let previous: ChannelMessage | null = null;
    for (const message of messages) {
      const newDay = startsNewDay(previous, message);
      nodes.push({
        message,
        grouped: !newDay && continuesGroup(previous, message),
        day: newDay ? dayOf(message.createdAt) : null,
      });
      previous = message;
    }
    return nodes;
  }, [messages]);

  return (
    <>
      <header className="flex items-center gap-2 border-b border-surgical-steel px-4 py-3">
        <Hash size={16} aria-hidden="true" className="shrink-0 text-fog-muted" />
        <h1 className="truncate text-sm font-semibold text-on-surface">{channel.name}</h1>
        {channel.description ? (
          <p className="hidden truncate border-l border-surgical-steel pl-2 text-xs text-fog-muted sm:block">
            {channel.description}
          </p>
        ) : null}
        {connected ? null : (
          <span className="ml-auto flex items-center gap-1 text-xs text-amber-300" role="status">
            <WifiOff size={12} aria-hidden="true" />
            Reconnecting
          </span>
        )}
      </header>

      <ol
        ref={paneRef}
        onScroll={(event) => {
          const pane = event.currentTarget;
          atBottomRef.current = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 80;
          if (pane.scrollTop < 120) void loadOlder();
        }}
        className="min-h-0 flex-1 overflow-y-auto py-2"
      >
        {cursor ? (
          <li className="flex justify-center py-2">
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-surgical-steel px-3 py-1 text-xs text-fog-muted"
            >
              {loadingOlder ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : null}
              Load earlier messages
            </button>
          </li>
        ) : null}

        {rendered.length === 0 ? (
          <li className="px-4 py-12 text-center text-sm text-fog-muted">
            {`Nothing in #${channel.name} yet. Say the first thing.`}
          </li>
        ) : null}

        {rendered.map(({ message, grouped, day }) => (
          <div key={message.id}>
            {day ? (
              <li className="flex items-center gap-3 px-4 py-3">
                <span className="h-px flex-1 bg-surgical-steel" />
                <span className="text-[11px] font-medium uppercase tracking-wide text-fog-muted">{day}</span>
                <span className="h-px flex-1 bg-surgical-steel" />
              </li>
            ) : null}
            <MessageRow
              message={message}
              grouped={grouped}
              urls={urls}
              canReact={permissions.canReact}
              canReply={permissions.canReply}
              onReply={setReplyTo}
              onChanged={() => void refresh()}
            />
          </div>
        ))}
      </ol>

      {permissions.composer === "ready" ? (
        <Composer
          channel={channel}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          onOptimistic={(optimistic) => {
            setMessages((current) => mergeMessage(current, optimistic));
            atBottomRef.current = true;
          }}
          onSettled={() => void refresh()}
          onAttachmentUrl={(path, url) => setUrls((current) => new Map(current).set(path, url))}
        />
      ) : (
        <p role="status" className="border-t border-surgical-steel px-4 py-4 text-center text-sm text-fog-muted">
          {COMPOSER_NOTICE[permissions.composer]}
        </p>
      )}
    </>
  );
}
