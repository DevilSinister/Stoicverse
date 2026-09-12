"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, Lock, LockOpen, MessagesSquare, X } from "lucide-react";

import { setThreadState } from "@/app/community/actions";
import { Composer } from "@/components/channels/Composer";
import { mergeMessage, useCommunity, useThreadLive, type ChannelRow } from "@/components/channels/CommunityProvider";
import { toClientMessage } from "@/lib/channels/rows";
import { MESSAGE_PAGE_SIZE } from "@/lib/community/constants";
import type { ChannelMessage } from "@/lib/community/messages";
import { MarkdownBody } from "@/lib/markdown/render";
import { createClient } from "@/lib/supabase/client";

/**
 * One thread, in the right-hand slot.
 *
 * Opened by `?thread=<id>`, which is client state the URL happens to carry —
 * not a parallel route. A parallel route would re-run the channel's server
 * render every time somebody opened or closed a thread, which is a full page
 * of messages refetched to show a side panel.
 *
 * The reply list is deliberately flat: replies inside a thread do not branch
 * again. A conversation that can split at every level stops being readable,
 * and the thread's own name is the only context this needs.
 */
export function ThreadPanel({
  channel,
  threadId,
  name,
  onClose,
}: {
  channel: ChannelRow;
  threadId: string;
  /** Known by whatever opened the panel; the replies do not carry it until one exists. */
  name?: string | null;
  onClose: () => void;
}) {
  const { affordances, resolvers, viewer } = useCommunity();
  const permissions = affordances(channel.id);

  // null means "not read yet", which is what the loading line renders. A
  // separate flag would have to be set synchronously inside an effect, and
  // the panel is remounted per thread anyway (keyed by id upstream), so the
  // initial value already says everything a flag would.
  const [messages, setMessages] = useState<ChannelMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urls, setUrls] = useState<Map<string, string>>(() => new Map());
  const paneRef = useRef<HTMLOListElement | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error: readError } = await supabase.rpc("community_channel_messages", {
      channel: channel.id,
      before_created_at: null,
      before_id: null,
      page_size: MESSAGE_PAGE_SIZE,
      thread: threadId,
    });
    if (readError) {
      setError("This thread could not be read.");
      setMessages([]);
      return;
    }
    setMessages(((data ?? []) as Record<string, unknown>[]).map(toClientMessage).reverse());
    setError(null);
  }, [channel.id, threadId]);

  // The rule guards against a synchronous setState cascading a second render.
  // Every setState in `refresh` sits behind the `await` on the RPC, so none of
  // them runs during this effect — but the rule cannot see through the call.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async: every setState is after the await
    void refresh();
  }, [refresh]);

  useThreadLive(
    threadId,
    useCallback(() => void refresh(), [refresh]),
  );

  useEffect(() => {
    const pane = paneRef.current;
    if (pane) pane.scrollTop = pane.scrollHeight;
  }, [messages]);

  const loading = messages === null;
  const rows = messages ?? [];
  // Every reply carries the thread name, so the first one is as good a source
  // as any — but a thread created a second ago has no replies yet, and falling
  // straight to "Thread" told somebody who had just named it that the name had
  // not taken. Whatever opened the panel knows it, so it passes it in.
  const named = rows.find((message) => message.threadName)?.threadName ?? name ?? "Thread";

  return (
    <aside
      aria-label={`Thread: ${named}`}
      className="flex min-h-0 w-full flex-col border-l border-surgical-steel bg-surface-container-lowest lg:w-96"
    >
      <header className="flex items-center gap-2 border-b border-surgical-steel px-3 py-3">
        <MessagesSquare size={16} aria-hidden="true" className="shrink-0 text-fog-muted" />
        <h2 className="truncate text-sm font-semibold text-on-surface">{named}</h2>

        {permissions.canManageThreads ? (
          <>
            <button
              type="button"
              onClick={() => void setThreadState(threadId, { locked: true })}
              aria-label="Lock this thread"
              className="focus-ring ml-auto rounded p-1.5 text-fog-muted hover:text-on-surface"
            >
              <Lock size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void setThreadState(threadId, { locked: false })}
              aria-label="Unlock this thread"
              className="focus-ring rounded p-1.5 text-fog-muted hover:text-on-surface"
            >
              <LockOpen size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void setThreadState(threadId, { archived: true }).then(onClose)}
              aria-label="Archive this thread"
              className="focus-ring rounded p-1.5 text-fog-muted hover:text-on-surface"
            >
              <Archive size={14} aria-hidden="true" />
            </button>
          </>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          aria-label="Close thread"
          className={`focus-ring rounded p-1.5 text-fog-muted hover:text-on-surface ${
            permissions.canManageThreads ? "" : "ml-auto"
          }`}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </header>

      <ol ref={paneRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {loading ? <li className="py-6 text-center text-xs text-fog-muted">Loading the thread…</li> : null}
        {error ? (
          <li role="alert" className="py-6 text-center text-xs text-red-300">
            {error}
          </li>
        ) : null}
        {!loading && !error && rows.length === 0 ? (
          <li className="py-6 text-center text-xs text-fog-muted">Nothing in this thread yet.</li>
        ) : null}

        {rows.map((message) => (
          <li key={message.id} className="border-b border-surgical-steel/40 py-2 last:border-0">
            <p className="flex items-baseline gap-2">
              <span
                className="text-xs font-semibold text-on-surface"
                style={message.authorColor ? { color: message.authorColor } : undefined}
              >
                {message.authorName}
              </span>
              <time dateTime={message.createdAt} className="text-[10px] text-fog-muted">
                {new Date(message.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </time>
            </p>
            <div className="text-sm leading-6 text-on-surface-variant">
              <MarkdownBody body={message.body} resolvers={resolvers} />
              {message.editedAt ? <span className="ml-1 text-[10px] text-fog-muted">(edited)</span> : null}
            </div>
            {message.attachments.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {message.attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <a
                      href={urls.get(attachment.path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring text-xs text-primary-container underline underline-offset-2"
                    >
                      {attachment.path.split("/").pop()}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>

      {/*
        `send_messages_in_threads` is its own permission: a channel can be
        read-only at the top level and still take replies inside its threads,
        which is most of the reason a thread on an announcement is useful.
      */}
      {permissions.canSendInThread ? (
        <Composer
          channel={channel}
          replyTo={null}
          threadId={threadId}
          placeholder={`Reply in ${named}`}
          onClearReply={() => {}}
          onOptimistic={(optimistic) => setMessages((current) => mergeMessage(current ?? [], optimistic))}
          onSettled={() => void refresh()}
          onAttachmentUrl={(path, url) => setUrls((current) => new Map(current).set(path, url))}
        />
      ) : (
        <p role="status" className="border-t border-surgical-steel px-3 py-3 text-center text-xs text-fog-muted">
          {viewer ? "You cannot reply in threads here." : "Sign in to reply."}
        </p>
      )}
    </aside>
  );
}
