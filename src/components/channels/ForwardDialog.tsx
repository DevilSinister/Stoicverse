"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Forward, Hash, Loader2, Search } from "lucide-react";

import { forwardMessage, type ForwardOutcome } from "@/app/community/actions";
import { useCommunity } from "@/components/channels/CommunityProvider";
import { FORWARD_CHANNEL_LIMIT, MESSAGE_MAX_CHARS } from "@/lib/community/constants";
import type { ChannelMessage } from "@/lib/community/messages";

/**
 * Pick the channels a message is going to.
 *
 * Only channels this person may actually post in are listed. The alternative —
 * listing everything and greying out the rest — turns the picker into a map of
 * the community's permissions, which is not what somebody forwarding a message
 * asked to see.
 *
 * Sending is not all-or-nothing. `community_forward_message` answers per
 * channel, so a message can land in four of five and say which one refused it
 * and why; the dialog stays open on a partial result rather than closing over
 * the half that failed.
 */

type Stage =
  | { kind: "picking" }
  | { kind: "sending" }
  | { kind: "done"; outcomes: ForwardOutcome[] };

export function ForwardDialog({
  message,
  onClose,
  onSent,
}: {
  message: ChannelMessage;
  onClose: () => void;
  /** Fires when at least one copy landed, so the open channel can re-read. */
  onSent: () => void;
}) {
  const { channels, affordances } = useCommunity();
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "picking" });
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Where this person may post, in the order the creator arranged. A locked
  // channel is one they cannot open at all, so it is not a destination.
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const result: { id: string; name: string; channels: { id: string; name: string }[] }[] = [];
    for (const channel of channels) {
      if (channel.isLocked) continue;
      if (affordances(channel.id).composer !== "ready") continue;
      if (needle && !channel.name.toLowerCase().includes(needle)) continue;
      const existing = result.find((group) => group.id === channel.categoryId);
      const entry = { id: channel.id, name: channel.name };
      if (existing) existing.channels.push(entry);
      else result.push({ id: channel.categoryId, name: channel.categoryName, channels: [entry] });
    }
    return result;
  }, [channels, affordances, query]);

  const nameOf = (channelId: string) => channels.find((channel) => channel.id === channelId)?.name ?? "a channel";
  const atLimit = selected.length >= FORWARD_CHANNEL_LIMIT;

  const toggle = (channelId: string) => {
    setError(null);
    setSelected((current) => {
      if (current.includes(channelId)) return current.filter((id) => id !== channelId);
      if (current.length >= FORWARD_CHANNEL_LIMIT) return current;
      return [...current, channelId];
    });
  };

  const send = async () => {
    if (selected.length === 0) return;
    setStage({ kind: "sending" });
    setError(null);

    const result = await forwardMessage(message.id, selected, note);
    if (result.error || !result.outcomes) {
      setStage({ kind: "picking" });
      setError(result.error ?? "That message could not be forwarded.");
      return;
    }

    const landed = result.outcomes.filter((outcome) => outcome.postId !== null);
    if (landed.length > 0) onSent();

    // Every one of them worked: there is nothing left to read, so the dialog
    // gets out of the way. Anything less stays open with the reasons.
    if (landed.length === result.outcomes.length) {
      onClose();
      return;
    }
    setStage({ kind: "done", outcomes: result.outcomes });
  };

  const preview = message.forwarded?.body ?? message.body;
  const busy = stage.kind === "sending";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Forward this message"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !busy) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-xl border border-surgical-steel bg-surface-container-low">
        <div className="border-b border-surgical-steel px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
            <Forward size={14} aria-hidden="true" />
            Forward
          </h2>
          <p className="mt-1 line-clamp-2 text-xs text-fog-muted">
            {preview
              ? `${message.authorName}: ${preview}`
              : `${message.authorName} — ${message.attachments.length > 0 ? "an attachment" : "a message"}`}
          </p>
        </div>

        {stage.kind === "done" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <ul className="space-y-1.5 text-xs">
              {stage.outcomes.map((outcome) => (
                <li key={outcome.channelId} className="flex items-start gap-2">
                  {outcome.postId ? (
                    <Check size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-primary-container" />
                  ) : (
                    <span aria-hidden="true" className="mt-0.5 shrink-0 text-error">
                      &times;
                    </span>
                  )}
                  <span className={outcome.postId ? "text-on-surface-variant" : "text-error"}>
                    {outcome.postId
                      ? `Sent to #${nameOf(outcome.channelId)}`
                      : `#${nameOf(outcome.channelId)} — ${outcome.failure}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="border-b border-surgical-steel px-4 py-2">
              <label className="flex items-center gap-2 rounded-lg border border-surgical-steel bg-surface-container-lowest px-2 py-1.5">
                <Search size={13} aria-hidden="true" className="shrink-0 text-fog-muted" />
                <span className="sr-only">Search channels</span>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search channels"
                  className="w-full bg-transparent text-sm text-on-surface outline-none placeholder:text-fog-muted"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {groups.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-fog-muted">
                  {query.trim()
                    ? "No channel of that name that you can post in."
                    : "There is no channel here you can post in."}
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.id} className="mb-3">
                    <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-fog-muted">
                      {group.name}
                    </p>
                    <ul className="space-y-0.5">
                      {group.channels.map((channel) => {
                        const ticked = selected.includes(channel.id);
                        return (
                          <li key={channel.id}>
                            <button
                              type="button"
                              aria-pressed={ticked}
                              // Unticking is always allowed; the cap only ever
                              // stops the eleventh tick, never the untick that
                              // would get somebody back under it.
                              disabled={busy || (atLimit && !ticked)}
                              onClick={() => toggle(channel.id)}
                              className={`focus-ring flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm disabled:opacity-40 ${
                                ticked
                                  ? "bg-surface-container-high text-on-surface"
                                  : "text-fog-muted hover:bg-surface-container-low hover:text-on-surface"
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                                  ticked ? "border-primary-container bg-primary-container" : "border-surgical-steel"
                                }`}
                              >
                                {ticked ? <Check size={11} className="text-monolith-surface" /> : null}
                              </span>
                              <Hash size={14} aria-hidden="true" className="shrink-0" />
                              <span className="truncate">{channel.name}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-surgical-steel px-4 py-2">
              <label className="block text-[11px] text-fog-muted">
                Add a message — optional
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  maxLength={MESSAGE_MAX_CHARS}
                  disabled={busy}
                  className="mt-1 w-full resize-none rounded-lg border border-surgical-steel bg-surface-container-lowest p-2 text-sm text-on-surface outline-none"
                />
              </label>
            </div>
          </>
        )}

        {error ? (
          <p role="alert" className="px-4 pb-1 text-xs text-error">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-surgical-steel px-4 py-3">
          <p className="text-[11px] text-fog-muted">
            {stage.kind === "done"
              ? null
              : atLimit
                ? `${FORWARD_CHANNEL_LIMIT} channels — the most at once`
                : selected.length > 0
                  ? `${selected.length} selected`
                  : null}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="focus-ring rounded-lg border border-surgical-steel px-3 py-1.5 text-xs text-on-surface-variant disabled:opacity-50"
            >
              {stage.kind === "done" ? "Close" : "Cancel"}
            </button>
            {stage.kind === "done" ? null : (
              <button
                type="button"
                onClick={() => void send()}
                disabled={busy || selected.length === 0}
                className="focus-ring flex items-center gap-1.5 rounded-lg bg-primary-container px-3 py-1.5 text-xs font-semibold text-monolith-surface disabled:opacity-50"
              >
                {busy ? <Loader2 size={12} aria-hidden="true" className="animate-spin" /> : null}
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
