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
                  className="max-h-72 max-w-full rounded-lg border border-border-hairline object-cover"
                />
              </a>
            ) : (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring flex items-center gap-2 rounded-lg border border-border-hairline px-3 py-2 text-chrome-sm text-text-default hover:bg-surface-raised"
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
    <ul className="mt-1 flex flex-wrap gap-1.5">
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
            // `accent-soft` is the accent at 12%, which is the token for a
            // selected state; the hand-mixed `/15` beside a full-strength
            // accent border was a second opinion about the same thing.
            className={`focus-ring flex min-h-7 items-center gap-1 rounded-lg border px-2 py-0.5 text-chrome-sm transition-colors disabled:opacity-50 ${
              reaction.mine
                ? "border-primary bg-accent-soft text-text-strong"
                : "border-border-hairline text-text-muted hover:bg-surface-raised hover:text-text-default"
            }`}
          >
            <span aria-hidden="true">{reaction.emoji}</span>
            <span className="font-mono text-mono-xs">{reaction.count}</span>
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
        /*
          `focus-ring`, and no `outline-none`. This box carried the second
          without the first, so the one control on the page that is focused the
          instant it appears had no focus indicator at all - and it is inside a
          scrolling list, where "where am I" is the only question a keyboard
          user has. The ring is the shared 2px accent at 2px offset.
        */
        className="focus-ring w-full resize-none rounded-lg border border-border-hairline bg-surface-sunken p-2 text-content-sm text-text-default"
      />
      <p className="mt-1 flex items-center gap-3 text-chrome-xs text-text-muted">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="focus-ring rounded-md text-primary disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="focus-ring rounded-md hover:text-text-strong">
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
    <div className="mt-1 border-l-2 border-border-hairline pl-3">
      <p className="flex items-center gap-1 text-chrome-xs text-text-muted">
        <Forward size={11} aria-hidden="true" className="shrink-0" />
        <span>
          {`Forwarded from ${forwarded.authorName}`}
          {forwarded.channelName ? ` in #${forwarded.channelName}` : ""}
        </span>
      </p>

      {forwarded.deleted ? (
        <p className="mt-0.5 text-content-sm italic text-text-muted">This message was deleted.</p>
      ) : (
        <>
          <div className="mt-0.5 text-content-sm text-text-default">
            <MarkdownBody body={forwarded.body} resolvers={resolvers} />
          </div>
          {forwarded.attachmentCount > 0 ? (
            <p className="text-chrome-xs text-text-muted">
              {`${forwarded.attachmentCount} ${forwarded.attachmentCount === 1 ? "attachment" : "attachments"} — open the original to see ${forwarded.attachmentCount === 1 ? "it" : "them"}`}
            </p>
          ) : null}
          {forwarded.channelVisible && forwarded.channelId ? (
            <Link
              href={`/channels/${forwarded.channelId}?jump=${forwarded.postId}`}
              className="focus-ring rounded-md text-chrome-xs text-primary hover:underline"
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
      <li ref={(node) => registerNode(message.id, node)} className="px-4 py-1 text-chrome-sm italic text-text-muted">
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
          className="focus-ring mb-0.5 flex w-full items-center gap-1 rounded-md pl-12 text-left text-chrome-sm text-text-muted hover:text-text-default"
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
                <span className="flex size-9 items-center justify-center rounded-full bg-surface-raised text-chrome-base font-medium text-text-strong">
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
                className="focus-ring rounded-md text-chrome-base font-medium text-text-strong hover:underline disabled:cursor-default disabled:no-underline"
                style={message.authorColor ? { color: message.authorColor } : undefined}
              >
                {message.authorName}
              </button>
              {/* A timestamp is measurement, so it is mono, like every other
                  figure in the product. */}
              <time dateTime={message.createdAt} className="font-mono text-mono-xs text-text-muted">
                {timeOf(message.createdAt)}
              </time>
              {message.isPinned ? (
                <span className="flex items-center gap-0.5 text-chrome-xs text-text-muted">
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
            // A message body is reading text, so it names the content ramp -
            // 14px at 1.6 - while everything around it stays on the chrome one.
            // This is the mixed surface DESIGN.md describes, said in tokens.
            <div className="text-content-sm text-text-default">
              <MarkdownBody body={message.body} resolvers={resolvers} jumbo={jumbo} />
              {message.editedAt ? <span className="ml-1 text-chrome-xs text-text-muted">(edited)</span> : null}
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
              className="focus-ring mt-1 flex items-center gap-1 rounded-md text-chrome-sm text-primary hover:underline"
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
      /*
        Hover lifts. It used to darken - `surface-container-lowest/60`, the
        sunken well - which was the right instinct on a page that was panel
        coloured and the wrong one now the conversation is the canvas: a row
        that recedes under the pointer reads as disabled. `surface-panel` is
        the one step up from canvas, and it is the fill the rail already uses
        for the same gesture.
      */
      className={`group relative px-4 transition-colors duration-700 ${grouped ? "py-0.5" : "pb-0.5 pt-3"} ${
        flashed ? "bg-accent-soft" : "hover:bg-surface-panel"
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
  const { affordances, viewer, setActiveChannel, refreshUnread, typistsIn, channels, pane, setPane, setSearchOpen } =
    useCommunity();

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
        {/*
          On a phone this header is the top of the app — /channels mounts no
          chrome above it — so it is what has to clear the notch. `safe-t` on
          its own would replace py-3's top padding rather than add to it, hence
          the calc: the inset is additive to the padding the bar already has.
        */}
        {/*
          48px of bar, plus the notch. `h-chrome-bar` is what every other
          header in the product measures, and what the channel column beside
          this one measures - the two rules meet now instead of missing each
          other by 4px. The inset is added to the height rather than replacing
          the padding, so the bar is 48px of content wherever it is drawn.
        */}
        <header className="flex h-[calc(var(--spacing-chrome-bar)+env(safe-area-inset-top))] shrink-0 items-center gap-chrome-gap border-b border-border-hairline px-4 pt-[env(safe-area-inset-top)]">
          {/*
            The way back to the channel list on a phone. Above `md` the list
            is always on screen, so the button would be a second door to a
            room the reader is already standing in.
          */}
          <button
            type="button"
            onClick={() => setPane("sidebar")}
            aria-label="Show channels"
            className="focus-ring hit-target relative -ml-1 rounded-lg p-1 text-text-muted hover:text-text-strong md:hidden"
          >
            <Menu size={18} aria-hidden="true" />
          </button>
          <Hash size={16} aria-hidden="true" className="shrink-0 text-text-muted" />
          <h1 className="truncate text-chrome-base font-medium text-text-strong">{channel.name}</h1>
          {channel.description ? (
            <p className="hidden truncate border-l border-border-hairline pl-2 text-chrome-sm text-text-muted sm:block">
              {channel.description}
            </p>
          ) : null}

          {/*
            36px controls at an 8px gap, which is a 44px pitch - and `hit-target`
            draws exactly 44, so the four boxes abut and none of them overlaps.

            They were 28px at the same gap, a 36px pitch under a 44px hit area,
            so **every neighbouring pair overlapped by 8px** and a tap within 4px
            of a midpoint went to whichever sibling paints later. The comment
            this replaces said the gap had been widened to fix precisely that,
            and it had been widened to a number that does not: the overlap is
            decided by the pitch against the hit box, and 8px of gap cannot
            carry a 44px target around a 28px icon however it is arranged.
            Measured on a 375px viewport, then re-measured after.
          */}
          <div className="ml-auto flex shrink-0 items-center gap-chrome-gap">
            {connected ? null : (
              // `status-warn`, not Tailwind's amber-300. This was one of the
              // last three off-system colours in the product and the only one
              // on a surface a member sees every day.
              <span className="flex items-center gap-1 text-chrome-sm text-status-warn" role="status">
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
              className="focus-ring hit-target relative rounded-lg p-2.5 text-text-muted hover:text-text-strong"
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
              className="focus-ring hit-target relative rounded-lg p-2.5 text-text-muted hover:text-text-strong xl:hidden"
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
                className="focus-ring inline-flex items-center gap-2 rounded-lg border border-border-hairline px-3 py-1 text-chrome-sm text-text-muted hover:bg-surface-panel hover:text-text-default"
              >
                {loadingOlder ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : null}
                Load earlier messages
              </button>
            </li>
          ) : null}

          {rendered.length === 0 ? (
            <li className="px-4 py-12 text-center text-content-sm text-text-muted">
              {`Nothing in #${channel.name} yet. Say the first thing.`}
            </li>
          ) : null}

          {rendered.map(({ message, grouped, day, isNew }) => (
            <div key={message.id}>
              {isNew ? (
                <li className="flex items-center gap-3 px-4 py-1.5" aria-label="New messages below">
                  <span className="h-px flex-1 bg-status-danger/60" />
                  <span className="text-chrome-xs font-medium uppercase tracking-wider text-status-danger">New</span>
                  <span className="h-px flex-1 bg-status-danger/60" />
                </li>
              ) : null}
              {day ? (
                <li className="flex items-center gap-3 px-4 py-3">
                  <span className="h-px flex-1 bg-border-hairline" />
                  <span className="text-chrome-xs font-medium uppercase tracking-wide text-text-muted">{day}</span>
                  <span className="h-px flex-1 bg-border-hairline" />
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
        <p aria-live="polite" className="h-4 px-4 text-chrome-xs text-text-muted">
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
          <p role="status" className="border-t border-border-hairline px-4 py-4 text-center text-content-sm text-text-muted">
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
