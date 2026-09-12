"use client";

import { useCallback, useRef, useState } from "react";
import { MessagesSquare, Pin } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";

/**
 * The two lists that hang off a channel header: what has been pinned, and what
 * threads are running.
 *
 * Both load when the popover opens rather than with the page. Neither is
 * needed to read the channel, and paying for two extra round trips on every
 * channel open — for panels most visits never touch — is a cost the header
 * should not impose.
 */

type Pinned = { id: string; author_name: string | null; body: string | null; pinned_at: string | null };
type Thread = {
  id: string;
  name: string;
  message_count: number;
  last_message_at: string | null;
  archived: boolean;
  locked: boolean;
};

/**
 * Rows fetched the first time the panel is opened.
 *
 * Driven by the open event rather than an effect: opening a popover is
 * something a person did, not state that needs synchronising, and an effect
 * here would re-run on every `rows` change to decide it had nothing to do.
 */
function useLazyRows<T>(load: () => Promise<T[]>) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [failed, setFailed] = useState(false);
  const loadedRef = useRef(false);

  const onOpenChange = (next: boolean) => {
    if (!next || loadedRef.current) return;
    loadedRef.current = true;
    load().then(
      (result) => {
        setRows(result);
        setFailed(false);
      },
      () => {
        // Allow a retry: a failed read should not leave the panel permanently
        // empty because the first attempt happened to be offline.
        loadedRef.current = false;
        setFailed(true);
      },
    );
  };

  return { rows, failed, onOpenChange };
}

export function PinsPopover({ channelId, onJump }: { channelId: string; onJump: (messageId: string) => void }) {
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("community_channel_pins", { channel: channelId });
    if (error) throw error;
    return (data ?? []) as Pinned[];
  }, [channelId]);

  const { rows, failed, onOpenChange } = useLazyRows<Pinned>(load);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange(next);
      }}
    >
      <PopoverTrigger
        aria-label="Pinned messages"
        className="focus-ring rounded-lg p-1.5 text-fog-muted hover:text-on-surface"
      >
        <Pin size={16} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b border-surgical-steel px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fog-muted">
          Pinned
        </p>
        <div className="max-h-80 overflow-y-auto">
          {failed ? <p className="px-3 py-4 text-xs text-red-300">Pinned messages could not be read.</p> : null}
          {!failed && rows === null ? <p className="px-3 py-4 text-xs text-fog-muted">Loading…</p> : null}
          {rows !== null && rows.length === 0 ? (
            <p className="px-3 py-4 text-xs text-fog-muted">Nothing is pinned in this channel yet.</p>
          ) : null}
          {(rows ?? []).map((pin) => (
            <button
              key={pin.id}
              type="button"
              onClick={() => {
                setOpen(false);
                onJump(pin.id);
              }}
              className="focus-ring block w-full border-b border-surgical-steel/40 px-3 py-2 text-left last:border-0 hover:bg-surface-container-low"
            >
              <span className="block text-xs font-medium text-on-surface">{pin.author_name ?? "Former member"}</span>
              {/*
                Plain text, not markdown: this is a reference to a message, and
                rendering a spoiler or a jumbo emoji inside a 320px list makes
                the list harder to scan than the message is to find.
              */}
              <span className="mt-0.5 line-clamp-2 block text-xs text-on-surface-variant">
                {pin.body ?? "(no text)"}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ThreadListPopover({
  channelId,
  onOpenThread,
}: {
  channelId: string;
  onOpenThread: (threadId: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("community_channel_threads", { channel: channelId });
    if (error) throw error;
    return (data ?? []) as Thread[];
  }, [channelId]);

  const { rows, failed, onOpenChange } = useLazyRows<Thread>(load);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange(next);
      }}
    >
      <PopoverTrigger aria-label="Threads" className="focus-ring rounded-lg p-1.5 text-fog-muted hover:text-on-surface">
        <MessagesSquare size={16} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b border-surgical-steel px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fog-muted">
          Threads
        </p>
        <div className="max-h-80 overflow-y-auto">
          {failed ? (
            <p className="px-3 py-4 text-xs text-red-300">
              Threads could not be read. They need migration 20260912090000.
            </p>
          ) : null}
          {!failed && rows === null ? <p className="px-3 py-4 text-xs text-fog-muted">Loading…</p> : null}
          {rows !== null && rows.length === 0 ? (
            <p className="px-3 py-4 text-xs text-fog-muted">No threads in this channel yet.</p>
          ) : null}
          {(rows ?? []).map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenThread(thread.id, thread.name);
              }}
              className="focus-ring block w-full border-b border-surgical-steel/40 px-3 py-2 text-left last:border-0 hover:bg-surface-container-low"
            >
              <span className="flex items-center gap-2">
                <span className="truncate text-xs font-medium text-on-surface">{thread.name}</span>
                {thread.archived ? (
                  <span className="shrink-0 rounded border border-surgical-steel px-1 text-[10px] text-fog-muted">
                    Archived
                  </span>
                ) : null}
                {thread.locked ? (
                  <span className="shrink-0 rounded border border-surgical-steel px-1 text-[10px] text-fog-muted">
                    Locked
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-[11px] text-fog-muted">
                {`${thread.message_count} ${thread.message_count === 1 ? "reply" : "replies"}`}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
