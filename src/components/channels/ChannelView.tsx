"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CornerUpLeft,
  FileText,
  Forward,
  Hash,
  Loader2,
  Menu,
  MessagesSquare,
  Pin,
  Search,
  Users,
  WifiOff,
} from "lucide-react";

import { editMessage, markChannelRead, toggleReaction } from "@/app/community/actions";
import { PinsPopover, ThreadListPopover } from "@/components/channels/ChannelHeaderPopovers";
import { Composer } from "@/components/channels/Composer";
import { mergeMessage, useChannelLive, useCommunity, type ChannelRow } from "@/components/channels/CommunityProvider";
import { MemberList } from "@/components/channels/MemberList";
import { MessageMenu } from "@/components/channels/MessageMenu";
import { MobilePaneDrawer } from "@/components/channels/MobilePane";
import { RulesGateNotice } from "@/components/channels/RulesGateNotice";
import { SearchOverlay } from "@/components/channels/SearchOverlay";
import { VoicePlayer } from "@/components/channels/VoicePlayer";
import { ThreadPanel } from "@/components/channels/ThreadPanel";
import { useToast } from "@/components/ui/toast";
import { attachmentPathsOf, signAttachmentUrls } from "@/lib/channels/attachment-urls";
import { continuesGroup, firstUnreadIndex, startsNewDay } from "@/lib/channels/grouping";
import { JUMP_PAGE_BUDGET } from "@/lib/channels/message-actions";
import { COMPOSER_NOTICE } from "@/lib/channels/permissions";
import { typingSentence } from "@/lib/channels/presence";
import { toClientMessage } from "@/lib/channels/rows";
import { MESSAGE_PAGE_SIZE } from "@/lib/community/constants";
import type { ChannelMessage } from "@/lib/community/messages";
import { MarkdownBody, type MentionResolvers } from "@/lib/markdown/render";
import { isJumboEmoji } from "@/lib/markdown/tokenize";
import { createClient } from "@/lib/supabase/client";

/**
 * One channel: its header, its messages, the composer, and the thread panel.
 *
 * The server renders the first page; everything after that is fetched from the
 * browser. Paging is a `supabase.rpc` call rather than a server action because
 * Next 16 dispatches actions sequentially per client — scrolling up twice
 * quickly would queue the second read behind the first.
 *
 * `?thread=` and `?jump=` are client state the URL carries, not routes. They
 * are written with `router.replace` and `scroll: false`, so opening a thread
 * neither re-runs the server render nor adds a history entry somebody then has
 * to press Back through.
 */

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
        const isAudio = attachment.mimeType.startsWith("audio/");

        // A voice note is played where it sits. Offering a download link for
        // a five-second recording is asking somebody to leave the
        // conversation to hear it.
        if (isAudio && href) {
          return (
            <li key={attachment.id} className="w-full">
              <VoicePlayer src={href} durationSeconds={attachment.durationSeconds} />
            </li>
          );
        }

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
                ? "border-primary-container bg-primary-container/15 text-on-surface"
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

/** Editing happens where the message is, so the surrounding conversation stays readable. */
function InlineEditor({
  initial,
  onCancel,
  onSaved,
}: {
  initial: string;
  onCancel: () => void;
  onSaved: (body: string) => Promise<string | null>;
}) {
  const notify = useToast();
  const [body, setBody] = useState(initial);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (body.trim() === "") return;
    setBusy(true);
    const failure = await onSaved(body);
    setBusy(false);
    // Toasted rather than rendered under the box: this editor sits inside the
    // message list, so a line appearing beneath it pushed every message below
    // it down while somebody was reading them.
    if (failure) notify(failure);
  };

  return (
    <div className="mt-1">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          // Enter saves and Escape abandons — the same two keys the composer
          // uses, so editing does not need a different set of reflexes.
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void save();
          }
          if (event.key === "Escape") onCancel();
        }}
        rows={2}
        autoFocus
        aria-label="Edit your message"
        className="w-full resize-none rounded-lg border border-surgical-steel bg-surface-container-lowest p-2 text-sm text-on-surface outline-none"
      />
      <p className="mt-1 flex items-center gap-3 text-[11px] text-fog-muted">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="focus-ring rounded text-primary-container disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="focus-ring rounded hover:text-on-surface">
          Cancel
        </button>
        <span>Enter to save, Escape to cancel</span>
      </p>
    </div>
  );
}

/**
 * A forwarded message, as it stands right now.
 *
 * The content is read live through `forwarded_from_post_id` rather than
 * copied, so this is the original — not a snapshot of what it said when it
 * was forwarded. When the original is deleted the card says so and shows
 * nothing, which is the whole reason the link is followed rather than copied.
 *
 * The jump into the source channel appears only when the viewer can open it.
 * Somebody can be shown a message forwarded out of a channel they have no
 * access to — that is what forwarding is — but they are not handed a link into
 * it.
 */
function ForwardedCard({
  forwarded,
  resolvers,
}: {
  forwarded: NonNullable<ChannelMessage["forwarded"]>;
  resolvers: MentionResolvers;
}) {
  return (
    <div className="mt-1 border-l-2 border-surgical-steel pl-3">
      <p className="flex items-center gap-1 text-[11px] text-fog-muted">
        <Forward size={11} aria-hidden="true" className="shrink-0" />
        <span>
          {`Forwarded from ${forwarded.authorName}`}
          {forwarded.channelName ? ` in #${forwarded.channelName}` : ""}
        </span>
      </p>

      {forwarded.deleted ? (
        <p className="mt-0.5 text-sm italic text-fog-muted">This message was deleted.</p>
      ) : (
        <>
          <div className="mt-0.5 text-sm leading-6 text-on-surface-variant">
            <MarkdownBody body={forwarded.body} resolvers={resolvers} />
          </div>
          {forwarded.attachmentCount > 0 ? (
            <p className="text-[11px] text-fog-muted">
              {`${forwarded.attachmentCount} ${forwarded.attachmentCount === 1 ? "attachment" : "attachments"} — open the original to see ${forwarded.attachmentCount === 1 ? "it" : "them"}`}
            </p>
          ) : null}
          {forwarded.channelVisible && forwarded.channelId ? (
            <Link
              href={`/channels/${forwarded.channelId}?jump=${forwarded.postId}`}
              className="focus-ring rounded text-[11px] text-primary-container hover:underline"
            >
              Go to the original
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}

function MessageRow({
  message,
  grouped,
  urls,
  channelId,
  editing,
  flashed,
  registerNode,
  onReply,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onOpenThread,
  onJump,
  onChanged,
  canForward,
}: {
  message: ChannelMessage;
  grouped: boolean;
  urls: Map<string, string>;
  channelId: string;
  editing: boolean;
  flashed: boolean;
  registerNode: (id: string, node: HTMLLIElement | null) => void;
  onReply: (message: ChannelMessage) => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, body: string) => Promise<string | null>;
  onOpenThread: (threadId: string, name?: string | null) => void;
  onJump: (messageId: string) => void;
  onChanged: () => void;
  /** Whether this person can post anywhere at all — see `ChannelView`. */
  canForward: boolean;
}) {
  const { resolvers, viewer, affordances, openProfile } = useCommunity();
  const permissions = affordances(channelId);
  const jumbo = isJumboEmoji(message.body ?? "");

  if (message.postType === "system") {
    return (
      <li ref={(node) => registerNode(message.id, node)} className="px-4 py-1 text-xs italic text-fog-muted">
        <MarkdownBody body={message.body} resolvers={resolvers} />
      </li>
    );
  }

  const body = (
    <>
      {message.replyToPostId ? (
        <button
          type="button"
          onClick={() => message.replyToPostId && onJump(message.replyToPostId)}
          className="focus-ring mb-0.5 flex w-full items-center gap-1 rounded pl-12 text-left text-xs text-fog-muted hover:text-on-surface-variant"
        >
          <CornerUpLeft size={12} aria-hidden="true" className="shrink-0" />
          <span className="font-medium">{message.replyAuthorName ?? "someone"}</span>
          <span className="truncate">{message.replyExcerpt}</span>
        </button>
      ) : null}

      <div className="flex gap-3">
        <div className="w-9 shrink-0">
          {grouped ? null : (
            // The picture and the name both open the same card. Two hit
            // targets for one person, which is where somebody clicks when
            // they want to know who just said something.
            <button
              type="button"
              onClick={() => message.authorId && openProfile(message.authorId)}
              disabled={message.authorId === null}
              aria-label={`Open the profile for ${message.authorName}`}
              className="focus-ring rounded-full disabled:cursor-default"
            >
              {message.authorAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={message.authorAvatar} alt="" className="size-9 rounded-full object-cover" />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-full bg-surface-container-high text-sm font-semibold text-on-surface-variant">
                  {message.authorName.slice(0, 1).toUpperCase()}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {grouped ? null : (
            <p className="flex items-baseline gap-2">
              <button
                type="button"
                onClick={() => message.authorId && openProfile(message.authorId)}
                disabled={message.authorId === null}
                className="focus-ring rounded text-sm font-semibold text-on-surface hover:underline disabled:cursor-default disabled:no-underline"
                style={message.authorColor ? { color: message.authorColor } : undefined}
              >
                {message.authorName}
              </button>
              <time dateTime={message.createdAt} className="text-[11px] text-fog-muted">
                {timeOf(message.createdAt)}
              </time>
              {message.isPinned ? (
                <span className="flex items-center gap-0.5 text-[10px] text-fog-muted">
                  <Pin size={10} aria-hidden="true" />
                  Pinned
                </span>
              ) : null}
            </p>
          )}

          {editing ? (
            <InlineEditor
              initial={message.body ?? ""}
              onCancel={onCancelEdit}
              onSaved={(body) => onSaveEdit(message.id, body)}
            />
          ) : (
            <div className="text-sm leading-6 text-on-surface-variant">
              <MarkdownBody body={message.body} resolvers={resolvers} jumbo={jumbo} />
              {message.editedAt ? <span className="ml-1 text-[10px] text-fog-muted">(edited)</span> : null}
            </div>
          )}

          {message.forwarded ? (
            <ForwardedCard forwarded={message.forwarded} resolvers={resolvers} />
          ) : null}

          <Attachments attachments={message.attachments} urls={urls} />
          <Reactions message={message} canReact={permissions.canReact} onChanged={onChanged} />

          {message.threadId ? (
            <button
              type="button"
              onClick={() => message.threadId && onOpenThread(message.threadId, message.threadName)}
              className="focus-ring mt-1 flex items-center gap-1 rounded text-xs text-primary-container hover:underline"
            >
              <MessagesSquare size={12} aria-hidden="true" />
              {`${message.threadName ?? "Thread"} — ${message.threadMessageCount ?? 0} ${
                (message.threadMessageCount ?? 0) === 1 ? "reply" : "replies"
              }`}
            </button>
          ) : null}
        </div>
      </div>

    </>
  );

  return (
    <li
      ref={(node) => registerNode(message.id, node)}
      // The id on the element, not only in a ref: a jump, a test and P5's
      // keyboard navigation all need to find a row from outside this component.
      data-message-id={message.id}
      className={`group relative px-4 transition-colors duration-700 ${grouped ? "py-0.5" : "pb-0.5 pt-3"} ${
        flashed ? "bg-primary-container/20" : "hover:bg-surface-container-lowest/60"
      }`}
    >
      {/*
        While editing there is no menu and no right-click: the row has become
        a form, and offering to delete the message somebody is halfway through
        rewriting is not an offer worth making.
      */}
      {editing ? (
        body
      ) : (
        <MessageMenu
          message={message}
          viewerId={viewer?.userId ?? null}
          channelId={channelId}
          abilities={{
            canReply: permissions.canReply,
            canReact: permissions.canReact,
            canPin: permissions.canPin,
            canManageMessages: permissions.canManageMessages,
            canCreateThread: permissions.canCreateThread,
            canForward,
          }}
          onReply={() => onReply(message)}
          onEdit={() => onStartEdit(message.id)}
          onOpenThread={onOpenThread}
          onChanged={onChanged}
        >
          {body}
        </MessageMenu>
      )}
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
  const { affordances, viewer, setActiveChannel, refreshUnread, typistsIn, channels, pane, setPane } = useCommunity();

  /**
   * Is there anywhere at all to forward to?
   *
   * Computed once for the whole channel rather than per message row: the
   * answer is the same for all fifty of them, and it walks the channel list.
   * The picker asks the same question again when it builds its list, and the
   * database asks it a third time per target — this only decides whether the
   * menu item is worth drawing.
   */
  const canForward = useMemo(
    () => channels.some((entry) => !entry.isLocked && affordances(entry.id).composer === "ready"),
    [channels, affordances],
  );
  const permissions = affordances(channel.id);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const jumpTarget = params.get("jump");
  // The open thread is React state, seeded from the URL so a shared link still
  // opens the panel. It is not *read* from the URL on every render, because a
  // server action that calls `revalidateCommunity` triggers a router update
  // that lands after `router.replace` and resets the query — which silently
  // swallowed the panel every time somebody created a thread. The URL is a
  // mirror of this state, never its source.
  const [openThreadId, setOpenThreadId] = useState<string | null>(() => params.get("thread"));
  // Only a hint for the panel header: a deep link has no name to seed, and the
  // first reply supplies it thereafter.
  const [openThreadName, setOpenThreadName] = useState<string | null>(null);

  const notify = useToast();
  const [searchOpen, setSearchOpen] = useState(false);

  // The RPC returns newest first; the list reads oldest at the top.
  const [messages, setMessages] = useState<ChannelMessage[]>(() => [...initialMessages].reverse());
  const [cursor, setCursor] = useState(initialCursor);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [replyTo, setReplyTo] = useState<ChannelMessage | null>(null);
  const [mentionSeed, setMentionSeed] = useState<{ name: string; at: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [urls, setUrls] = useState(() => new Map(Object.entries(initialUrls)));
  const paneRef = useRef<HTMLOListElement | null>(null);
  const atBottomRef = useRef(true);
  const nodesRef = useRef(new Map<string, HTMLLIElement>());
  const jumpedRef = useRef<string | null>(null);
  const markTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Frozen once, on the first render for this channel. Read the live value and
  // the divider would chase the bottom of the list as marking-read caught up,
  // which is the one thing it must never do.
  const [readBoundary] = useState<string | null>(() => viewer?.readStates?.[channel.id]?.lastReadAt ?? null);

  const registerNode = useCallback((id: string, node: HTMLLIElement | null) => {
    if (node) nodesRef.current.set(id, node);
    else nodesRef.current.delete(id);
  }, []);

  /**
   * Sign the attachments in a batch of messages and merge them into the map.
   *
   * Every path the browser fetches has to pass through here. The server signs
   * the first page; anything that arrives afterwards — a refresh, a page of
   * history, a jump — brings attachments the map has never seen, and an
   * unsigned one renders as an image that cannot load.
   */
  const addUrls = useCallback(async (rows: ChannelMessage[]) => {
    const paths = attachmentPathsOf(rows);
    if (paths.length === 0) return;
    const signed = await signAttachmentUrls(createClient(), paths);
    if (signed.size === 0) return;
    setUrls((current) => {
      const next = new Map(current);
      for (const [path, href] of signed) next.set(path, href);
      return next;
    });
  }, []);

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
    const rows = (data as Record<string, unknown>[]).map(toClientMessage);
    setMessages([...rows].reverse());
    void addUrls(rows);
  }, [channel.id, addUrls]);

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

  // The sidebar stops showing this channel unread the moment it is on screen,
  // rather than waiting for the debounce below to reach the server.
  useEffect(() => {
    setActiveChannel(channel.id);
    return () => setActiveChannel(null);
  }, [channel.id, setActiveChannel]);

  /**
   * Mark read, 1.5 s after the reader settles at the bottom.
   *
   * Debounced because the alternative is a write per arriving message in a
   * busy channel, and delayed because scrolling past the bottom on the way
   * somewhere else is not reading. Only ever called while the tab is visible:
   * a background tab receiving messages is not somebody reading them.
   */
  const scheduleMarkRead = useCallback(() => {
    if (markTimerRef.current) clearTimeout(markTimerRef.current);
    markTimerRef.current = setTimeout(() => {
      if (document.visibilityState !== "visible" || !atBottomRef.current) return;
      const newest = messages[messages.length - 1];
      if (!newest || newest.id.startsWith("optimistic-")) return;
      void markChannelRead(channel.id, newest.id).then(() => refreshUnread());
    }, 1500);
  }, [channel.id, messages, refreshUnread]);

  useEffect(() => {
    if (atBottomRef.current) scheduleMarkRead();
    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleMarkRead();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (markTimerRef.current) clearTimeout(markTimerRef.current);
    };
  }, [scheduleMarkRead]);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null) next.delete(key);
      else next.set(key, value);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const openThread = useCallback(
    (id: string | null, name?: string | null) => {
      setOpenThreadId(id);
      setOpenThreadName(name ?? null);
      setParam("thread", id);
    },
    [setParam],
  );

  const loadOlder = useCallback(async (): Promise<ChannelMessage[]> => {
    if (!cursor || loadingOlder) return [];
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
    void addUrls(rows);
    return rows;
  }, [channel.id, cursor, loadingOlder, addUrls]);

  /**
   * Scroll to a message and flash it.
   *
   * If it is not loaded, walk back a bounded number of pages looking for it. A
   * reply to something from six months ago would otherwise either fetch the
   * whole channel or silently do nothing; a budget and a sentence are honest
   * about which of the two happened.
   */
  const jumpTo = useCallback(
    async (messageId: string) => {
      for (let page = 0; page <= JUMP_PAGE_BUDGET; page += 1) {
        const node = nodesRef.current.get(messageId);
        if (node) {
          atBottomRef.current = false;
          node.scrollIntoView({ block: "center", behavior: "smooth" });
          setFlashId(messageId);
          window.setTimeout(() => setFlashId((current) => (current === messageId ? null : current)), 1600);
          return;
        }
        if (page === JUMP_PAGE_BUDGET) break;
        const rows = await loadOlder();
        if (rows.length === 0) break;
      }
      notify("That message is further back than this view reaches.");
    },
    [loadOlder, notify],
  );

  // A `?jump=` from a copied link or a pin, honoured once per target so a
  // re-render does not keep dragging the reader back to it.
  useEffect(() => {
    if (!jumpTarget || jumpedRef.current === jumpTarget) return;
    jumpedRef.current = jumpTarget;
    void jumpTo(jumpTarget);
  }, [jumpTarget, jumpTo]);

  const saveEdit = useCallback(
    async (id: string, body: string): Promise<string | null> => {
      const result = await editMessage(id, body);
      if (result.error) return result.error;
      setEditingId(null);
      await refresh();
      return null;
    },
    [refresh],
  );

  const rendered = useMemo(() => {
    const unreadAt = firstUnreadIndex(messages, readBoundary, viewer?.userId ?? null);
    const nodes: { message: ChannelMessage; grouped: boolean; day: string | null; isNew: boolean }[] = [];
    let previous: ChannelMessage | null = null;
    for (const [index, message] of messages.entries()) {
      const newDay = startsNewDay(previous, message);
      const isNew = index === unreadAt;
      nodes.push({
        message,
        // The divider breaks the block for the same reason a day divider does:
        // a run of messages split by a line is not one run any more.
        grouped: !newDay && !isNew && continuesGroup(previous, message),
        day: newDay ? dayOf(message.createdAt) : null,
        isNew,
      });
      previous = message;
    }
    return nodes;
  }, [messages, readBoundary, viewer?.userId]);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-surgical-steel px-4 py-3">
          {/*
            The way back to the channel list on a phone. Above `md` the list
            is always on screen, so the button would be a second door to a
            room the reader is already standing in.
          */}
          <button
            type="button"
            onClick={() => setPane("sidebar")}
            aria-label="Show channels"
            className="focus-ring -ml-1 rounded-lg p-1 text-fog-muted hover:text-on-surface md:hidden"
          >
            <Menu size={18} aria-hidden="true" />
          </button>
          <Hash size={16} aria-hidden="true" className="shrink-0 text-fog-muted" />
          <h1 className="truncate text-sm font-semibold text-on-surface">{channel.name}</h1>
          {channel.description ? (
            <p className="hidden truncate border-l border-surgical-steel pl-2 text-xs text-fog-muted sm:block">
              {channel.description}
            </p>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {connected ? null : (
              <span className="flex items-center gap-1 text-xs text-amber-300" role="status">
                <WifiOff size={12} aria-hidden="true" />
                Reconnecting
              </span>
            )}
            {/*
              Search belongs to the conversation, not to the list of rooms:
              it was in the sidebar, which is the one part of the page a phone
              never shows and the one place its results had nowhere to go.
            */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search the community"
              className="focus-ring rounded-lg p-1.5 text-fog-muted hover:text-on-surface"
            >
              <Search size={16} aria-hidden="true" />
            </button>
            <ThreadListPopover channelId={channel.id} onOpenThread={openThread} />
            <PinsPopover
              channelId={channel.id}
              onJump={(id) => void jumpTo(id)}
              onChanged={() => void refresh()}
            />
            {/*
              Hidden from `xl` up, where the member list has its own column.
              Below that it is a drawer, and this is the only way to it.
            */}
            <button
              type="button"
              onClick={() => setPane("members")}
              aria-label="Show members"
              className="focus-ring rounded-lg p-1.5 text-fog-muted hover:text-on-surface xl:hidden"
            >
              <Users size={16} aria-hidden="true" />
            </button>
          </div>
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

          {rendered.map(({ message, grouped, day, isNew }) => (
            <div key={message.id}>
              {isNew ? (
                <li className="flex items-center gap-3 px-4 py-1.5" aria-label="New messages below">
                  <span className="h-px flex-1 bg-error/60" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-error">New</span>
                  <span className="h-px flex-1 bg-error/60" />
                </li>
              ) : null}
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
                channelId={channel.id}
                editing={editingId === message.id}
                flashed={flashId === message.id}
                registerNode={registerNode}
                onReply={setReplyTo}
                onStartEdit={setEditingId}
                onCancelEdit={() => setEditingId(null)}
                onSaveEdit={saveEdit}
                onOpenThread={openThread}
                onJump={(id) => void jumpTo(id)}
                onChanged={() => void refresh()}
                canForward={canForward}
              />
            </div>
          ))}
        </ol>

        {/*
          Above the composer, not inside it: the box is where somebody types,
          and a line that appears and disappears inside it moves the very thing
          they are aiming at.
        */}
        <p aria-live="polite" className="h-4 px-4 text-[11px] text-fog-muted">
          {typingSentence(typistsIn(channel.id)) ?? ""}
        </p>

        {permissions.composer === "ready" ? (
          <Composer
            channel={channel}
            replyTo={replyTo}
            mentionSeed={mentionSeed}
            onClearReply={() => setReplyTo(null)}
            onEditLast={() => {
              // The last thing this person said in this channel that still has
              // words in it. A forward or an attachment-only message has
              // nothing to edit, and an optimistic bubble has no row yet.
              const mine = [...messages]
                .reverse()
                .find(
                  (candidate) =>
                    candidate.authorId === viewer?.userId &&
                    !candidate.id.startsWith("optimistic-") &&
                    (candidate.body ?? "").trim() !== "",
                );
              if (mine) setEditingId(mine.id);
            }}
            onOptimistic={(optimistic) => {
              setMessages((current) => mergeMessage(current, optimistic));
              atBottomRef.current = true;
            }}
            onSettled={() => void refresh()}
            onAttachmentUrl={(path, url) => setUrls((current) => new Map(current).set(path, url))}
          />
        ) : permissions.composer === "rulesNotAccepted" ? (
          <RulesGateNotice />
        ) : (
          <p role="status" className="border-t border-surgical-steel px-4 py-4 text-center text-sm text-fog-muted">
            {COMPOSER_NOTICE[permissions.composer]}
          </p>
        )}
      </div>

      <MemberList channelId={channel.id} onMention={(name) => setMentionSeed({ name, at: Date.now() })} />

      {/*
        The same list, in a pane, for the screens too narrow to carry the
        column. Mounted only while open — a second copy of a list that is
        permanently hidden is a second set of subscriptions for nobody.
      */}
      {pane === "members" ? (
        <MobilePaneDrawer side="right" label="Members" onClose={() => setPane(null)}>
          <MemberList
            channelId={channel.id}
            variant="drawer"
            onMention={(name) => {
              setMentionSeed({ name, at: Date.now() });
              setPane(null);
            }}
          />
        </MobilePaneDrawer>
      ) : null}

      {searchOpen ? <SearchOverlay onClose={() => setSearchOpen(false)} /> : null}

      {openThreadId ? (
        <ThreadPanel
          key={openThreadId}
          channel={channel}
          threadId={openThreadId}
          name={openThreadName}
          onClose={() => openThread(null)}
        />
      ) : null}
    </div>
  );
}
