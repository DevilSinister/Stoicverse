"use client";

import { useMemo, useState } from "react";
import { Check, Hash, Loader2, Search } from "lucide-react";

import { forwardMessage, type ForwardOutcome } from "@/app/community/actions";
import { useCommunity } from "@/components/channels/CommunityProvider";
import { Button } from "@/components/ui/button";
import {
  Overlay,
  OverlayBody,
  OverlayContent,
  OverlayDescription,
  OverlayFooter,
  OverlayHeader,
  OverlayTitle,
} from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
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
 *
 * The shell is `ui/overlay` rather than the hand-rolled scrim-and-card it was. What
 * that buys, none of which was written here: a focus trap, focus restore to the
 * forward button, a scroll lock, a portal out of the message row, and — the one
 * that mattered on a phone — a bottom sheet that clears the home indicator
 * instead of a centred card a software keyboard shoves off screen.
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
  const notify = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "picking" });

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
    setSelected((current) => {
      if (current.includes(channelId)) return current.filter((id) => id !== channelId);
      if (current.length >= FORWARD_CHANNEL_LIMIT) return current;
      return [...current, channelId];
    });
  };

  const send = async () => {
    if (selected.length === 0) return;
    setStage({ kind: "sending" });

    const result = await forwardMessage(message.id, selected, note);
    if (result.error || !result.outcomes) {
      setStage({ kind: "picking" });
      notify(result.error ?? "That message could not be forwarded.");
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
    <Overlay
      open
      onOpenChange={(next) => {
        // A send in flight is not interruptible: the server is already writing
        // copies, and closing over it would lose the per-channel answer.
        if (!next && !busy) onClose();
      }}
    >
      <OverlayContent placement="responsive" size="sm" density="chrome" showCloseButton={false}>
        <OverlayHeader className="pr-chrome-x">
          <OverlayTitle>Forward</OverlayTitle>
          <OverlayDescription className="line-clamp-2">
            {preview
              ? `${message.authorName}: ${preview}`
              : `${message.authorName} — ${message.attachments.length > 0 ? "an attachment" : "a message"}`}
          </OverlayDescription>
        </OverlayHeader>

        {stage.kind === "done" ? (
          <OverlayBody>
            <ul className="space-y-1.5 text-chrome-base">
              {stage.outcomes.map((outcome) => (
                <li key={outcome.channelId} className="flex items-start gap-2">
                  {outcome.postId ? (
                    <Check size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
                  ) : (
                    <span aria-hidden="true" className="mt-0.5 shrink-0 text-status-danger">
                      &times;
                    </span>
                  )}
                  <span className={outcome.postId ? "text-text-default" : "text-status-danger"}>
                    {outcome.postId
                      ? `Sent to #${nameOf(outcome.channelId)}`
                      : `#${nameOf(outcome.channelId)} — ${outcome.failure}`}
                  </span>
                </li>
              ))}
            </ul>
          </OverlayBody>
        ) : (
          <>
            <div className="shrink-0 border-b border-border-hairline px-chrome-x py-chrome-y">
              <label className="flex h-8 items-center gap-2 rounded-lg border border-border-hairline bg-surface-sunken px-2.5">
                <Search size={13} aria-hidden="true" className="shrink-0 text-text-faint" />
                <span className="sr-only">Search channels</span>
                <input
                  // The first field in the sheet, so Base UI's initial focus
                  // lands here without a ref and an effect to put it there.
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search channels"
                  className="min-w-0 flex-1 bg-transparent text-chrome-base text-text-strong outline-none placeholder:text-text-faint"
                />
              </label>
            </div>

            <OverlayBody className="px-1.5">
              {groups.length === 0 ? (
                <p className="px-2 py-6 text-center text-chrome-base text-text-muted">
                  {query.trim()
                    ? "No channel of that name that you can post in."
                    : "There is no channel here you can post in."}
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.id} className="mb-3">
                    <p className="px-2 pb-1 font-mono text-mono-xs tracking-widest text-text-faint uppercase">
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
                              className={`focus-ring flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-chrome-base transition-colors disabled:opacity-40 sm:min-h-[34px] ${
                                ticked
                                  ? "bg-surface-raised text-text-strong"
                                  : "text-text-muted hover:bg-surface-raised hover:text-text-strong"
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className={`flex size-4 shrink-0 items-center justify-center rounded-sm border ${
                                  ticked ? "border-primary bg-primary" : "border-border-strong"
                                }`}
                              >
                                {ticked ? <Check size={11} className="text-primary-foreground" /> : null}
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
            </OverlayBody>

            <div className="shrink-0 border-t border-border-hairline px-chrome-x py-chrome-y">
              <label className="block text-chrome-sm text-text-muted">
                Add a message — optional
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  maxLength={MESSAGE_MAX_CHARS}
                  disabled={busy}
                  className="focus-ring mt-1 w-full resize-none rounded-lg border border-border-hairline bg-surface-sunken p-2 text-chrome-base text-text-strong"
                />
              </label>
            </div>
          </>
        )}

        <OverlayFooter className="sm:items-center sm:justify-between">
          <p className="text-chrome-sm text-text-faint">
            {stage.kind === "done"
              ? null
              : atLimit
                ? `${FORWARD_CHANNEL_LIMIT} channels — the most at once`
                : selected.length > 0
                  ? `${selected.length} selected`
                  : null}
          </p>
          <div className="flex gap-chrome-gap sm:justify-end">
            <Button variant="outline" size="chrome" disabled={busy} onClick={onClose}>
              {stage.kind === "done" ? "Close" : "Cancel"}
            </Button>
            {stage.kind === "done" ? null : (
              <Button size="chrome" disabled={busy || selected.length === 0} onClick={() => void send()}>
                {busy ? <Loader2 size={12} aria-hidden="true" className="animate-spin" /> : null}
                Send
              </Button>
            )}
          </div>
        </OverlayFooter>
      </OverlayContent>
    </Overlay>
  );
}
