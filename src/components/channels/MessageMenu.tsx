"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import {
  CornerUpLeft,
  Forward,
  MessagesSquare,
  MoreHorizontal,
  Pin,
  PinOff,
  SmilePlus,
} from "lucide-react";

import { createThread, deleteMessage, toggleMessagePin, toggleReaction } from "@/app/community/actions";
import { reportMessage } from "@/app/community/moderation-actions";
import { ForwardDialog } from "@/components/channels/ForwardDialog";
import { EmojiPicker } from "@/components/community/emoji/EmojiPicker";
import { emojiToken } from "@/lib/community/emojis";
import { useCommunity } from "@/components/channels/CommunityProvider";
import { useToast } from "@/components/ui/toast";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { deriveMessageActions, messagePermalink, type MessageAbilities } from "@/lib/channels/message-actions";
import { THREAD_NAME_LIMITS } from "@/lib/community/constants";
import { REPORT_REASONS, REPORT_REASON_LABELS } from "@/lib/community-settings/model";
import type { ChannelMessage } from "@/lib/community/messages";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * The hover bar and the menu behind it.
 *
 * Which items exist is `deriveMessageActions`, not this file — the rule that a
 * moderator may delete but never edit somebody else's words belongs somewhere
 * a test can execute. This renders that answer and runs the action.
 *
 * Destructive items ask first. Deleting your own message is a confirmation;
 * deleting somebody else's writes a moderation case, so it asks for the reason
 * that case will carry.
 *
 * **The bar's buttons do not carry `hit-target`, and that is the considered
 * answer rather than an oversight.** They are 26px icons two pixels apart, so
 * a 44px box around each one overlapped its neighbours by 16px and a click
 * near an edge went to whichever button paints later - a hit area wider than
 * the pitch makes a pointer *less* accurate, not more. Nothing is lost on
 * touch, because this bar never appears there: it is revealed by hover, and
 * every action on it is also on the context menu, which Base UI opens on a
 * 500ms long press. The bar is a pointer convenience over a menu that is the
 * real route. Measured in phase 13b.
 */

type Dialog = null | "delete" | "report" | "thread" | "forward";

/* eslint-disable @typescript-eslint/no-explicit-any -- the dropdown and
   context item types are structurally identical and nominally distinct;
   this only passes children through. */
type MenuItemType = ComponentType<any>;
type MenuSeparatorType = ComponentType<any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

export function MessageMenu({
  message,
  viewerId,
  abilities,
  channelId,
  onReply,
  onEdit,
  onOpenThread,
  onChanged,
  children,
}: {
  message: ChannelMessage;
  viewerId: string | null;
  abilities: MessageAbilities;
  channelId: string;
  onReply: () => void;
  onEdit: () => void;
  onOpenThread: (threadId: string, name?: string | null) => void;
  onChanged: () => void;
  /** The message row itself. Wrapped so a right-click anywhere on it opens the menu. */
  children: ReactNode;
}) {
  const actions = deriveMessageActions({
    message: {
      authorId: message.authorId,
      postType: message.postType,
      isPinned: message.isPinned,
      threadId: message.threadId,
      hasBody: (message.body ?? "").trim() !== "",
      pending: message.id.startsWith("optimistic-"),
    },
    viewerId,
    abilities,
  });

  const notify = useToast();
  const { emojis } = useCommunity();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [reportKind, setReportKind] = useState<string>(REPORT_REASONS[0]);
  const [threadName, setThreadName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const anything =
    actions.reply ||
    actions.react ||
    actions.edit ||
    actions.remove ||
    actions.pin ||
    actions.startThread ||
    actions.openThread ||
    actions.forward ||
    actions.report ||
    actions.copyText ||
    actions.copyLink;
  if (!anything) return null;

  const run = async (work: () => Promise<{ error?: string } | void>) => {
    setBusy(true);
    const result = await work();
    setBusy(false);
    if (result && "error" in result && result.error) {
      // The dialog stays open on a refusal so the reason somebody typed is
      // still there to correct; the refusal itself is a toast, because a line
      // of red inside the dialog resized it under the cursor.
      notify(result.error);
      return;
    }
    setDialog(null);
    onChanged();
  };

  // `navigator.clipboard` is unavailable over plain http on a LAN address and
  // rejects when the document is not focused, so a failure says so rather than
  // looking like the click did nothing.
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      notify("Your browser would not let the page copy that.");
    }
  };

  /**
   * The items, written once and rendered into both menus.
   *
   * base-ui's dropdown and context menus are different component trees, so
   * the same list has to be buildable from either set of pieces. Duplicating
   * it would guarantee the right-click menu drifts from the left-click one.
   */
  const items = (Item: MenuItemType, Separator: MenuSeparatorType) => (
    <>
        {actions.startThread ? (
          <Item
            onClick={() => {
              setThreadName("");
              setDialog("thread");
            }}
          >
            Start a thread
          </Item>
        ) : null}
        {actions.openThread ? (
          <Item onClick={() => message.threadId && onOpenThread(message.threadId, message.threadName)}>
            Open thread
          </Item>
        ) : null}
        {actions.pin ? (
          <Item onClick={() => void run(() => toggleMessagePin(message.id))} disabled={busy}>
            <span className="flex items-center gap-2">
              {message.isPinned ? <PinOff size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />}
              {message.isPinned ? "Unpin message" : "Pin message"}
            </span>
          </Item>
        ) : null}
        {actions.edit ? <Item onClick={onEdit}>Edit message</Item> : null}
        {actions.forward ? (
          <Item onClick={() => setDialog("forward")}>
            <span className="flex items-center gap-2">
              <Forward size={14} aria-hidden="true" />
              Forward
            </span>
          </Item>
        ) : null}

        {actions.copyText || actions.copyLink ? <Separator /> : null}
        {actions.copyText ? (
          <Item onClick={() => void copy(message.body ?? "", "text")}>Copy text</Item>
        ) : null}
        {actions.copyLink ? (
          <Item
            onClick={() => void copy(messagePermalink(window.location.origin, channelId, message.id), "link")}
          >
            Copy link
          </Item>
        ) : null}

        {actions.report || actions.remove ? <Separator /> : null}
        {actions.report ? (
          <Item
            onClick={() => {
              setReportKind(REPORT_REASONS[0]);
              setReason("");
              setDialog("report");
            }}
          >
            Report message
          </Item>
        ) : null}
        {actions.remove ? (
          <Item
            variant="destructive"
            onClick={() => {
              setReason("");
              setDialog("delete");
            }}
          >
            Delete message
          </Item>
        ) : null}
    </>
  );

  return (
    <ContextMenu>
      {/*
        `contents` so the trigger adds no box of its own: the row keeps its
        own layout, and a right-click anywhere on it reaches this menu.
      */}
      <ContextMenuTrigger className="contents">{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">{items(ContextMenuItem, ContextMenuSeparator)}</ContextMenuContent>

      {/*
        `hidden` by default, but forced visible while this row's menu or emoji
        picker is open. Both portal to the body, so opening one takes the mouse
        and the focus out of this <li> — `group-hover` and `group-focus-within`
        both go false, the bar collapses to `display: none`, and the trigger
        loses its bounding box. The positioner then has nothing to anchor to
        and puts the menu in the top-left corner of the screen.
      */}
      {/*
        `surface-raised`, because a hovered row is now `surface-panel` and this
        bar was the same colour as the thing it floats over - it was told apart
        by its hairline alone. One step up, plus the small shadow, is what a
        floating strip is in this system.
      */}
      <div
        className={`absolute right-4 top-1 items-center gap-0.5 rounded-lg border border-border-hairline bg-surface-raised p-0.5 shadow-sm ${
          menuOpen || emojiOpen ? "flex" : "hidden group-focus-within:flex group-hover:flex"
        }`}
      >
        {actions.react ? (
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger
              aria-label="Add a reaction"
              className="focus-ring relative rounded-md p-1.5 text-text-muted transition-colors hover:text-text-strong"
            >
              <SmilePlus size={14} aria-hidden="true" />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <EmojiPicker
                mode="react"
                customEmojis={emojis}
                onSelect={(selection) => {
                  setEmojiOpen(false);
                  void run(async () => {
                    await toggleReaction(
                      message.id,
                      selection.kind === "unicode"
                        ? selection.glyph
                        : emojiToken({ id: selection.id, name: selection.name }),
                    );
                  });
                }}
              />
            </PopoverContent>
          </Popover>
        ) : null}

        {actions.reply ? (
          <button
            type="button"
            onClick={onReply}
            aria-label={`Reply to ${message.authorName}`}
            className="focus-ring relative rounded-md p-1.5 text-text-muted transition-colors hover:text-text-strong"
          >
            <CornerUpLeft size={14} aria-hidden="true" />
          </button>
        ) : null}

        {actions.openThread ? (
          <button
            type="button"
            onClick={() => message.threadId && onOpenThread(message.threadId, message.threadName)}
            aria-label="Open thread"
            className="focus-ring relative rounded-md p-1.5 text-text-muted transition-colors hover:text-text-strong"
          >
            <MessagesSquare size={14} aria-hidden="true" />
          </button>
        ) : null}

        {actions.forward ? (
          <button
            type="button"
            onClick={() => setDialog("forward")}
            aria-label={`Forward the message from ${message.authorName}`}
            className="focus-ring relative rounded-md p-1.5 text-text-muted transition-colors hover:text-text-strong"
          >
            <Forward size={14} aria-hidden="true" />
          </button>
        ) : null}

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            aria-label={`More actions for the message from ${message.authorName}`}
            className="focus-ring relative rounded-md p-1.5 text-text-muted transition-colors hover:text-text-strong"
          >
            <MoreHorizontal size={14} aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {items(DropdownMenuItem, DropdownMenuSeparator)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {copied ? (
        <span
          role="status"
          className="absolute right-4 top-9 rounded-md bg-surface-raised px-2 py-0.5 text-chrome-xs text-text-default"
        >
          {copied === "text" ? "Text copied" : "Link copied"}
        </span>
      ) : null}

      {/*
        Its own dialog rather than another `ActionDialog` case: this one picks
        from a list, reports an outcome per channel, and can end in a partial
        success, none of which the confirm-or-cancel shape can carry.
      */}
      {dialog === "forward" ? (
        <ForwardDialog message={message} onClose={() => setDialog(null)} onSent={onChanged} />
      ) : null}

      {dialog && dialog !== "forward" ? (
        <ActionDialog
          title={
            dialog === "delete"
              ? "Delete this message?"
              : dialog === "report"
                ? "Report this message"
                : "Start a thread"
          }
          busy={busy}
          confirmLabel={dialog === "delete" ? "Delete" : dialog === "report" ? "Send report" : "Start"}
          destructive={dialog === "delete"}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            if (dialog === "delete") {
              void run(() => deleteMessage(message.id, actions.removeNeedsReason ? reason : undefined));
            } else if (dialog === "report") {
              void run(() => reportMessage(message.id, reportKind, reason || undefined));
            } else {
              void run(async () => {
                const result = await createThread(message.id, threadName);
                if (result.threadId) onOpenThread(result.threadId);
                return result;
              });
            }
          }}
        >
          {dialog === "delete" ? (
            actions.removeNeedsReason ? (
              <label className="block text-chrome-sm text-text-muted">
                Reason — recorded in the moderation log and kept with the case.
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  maxLength={500}
                  autoFocus
                  className="focus-ring mt-1 w-full rounded-lg border border-border-hairline bg-surface-sunken p-2 text-content-sm text-text-default"
                />
              </label>
            ) : (
              <p className="text-chrome-sm text-text-muted">This cannot be undone.</p>
            )
          ) : null}

          {dialog === "report" ? (
            <>
              <fieldset className="space-y-1">
                <legend className="text-chrome-sm text-text-muted">What is wrong with it?</legend>
                {REPORT_REASONS.map((kind) => (
                  <label key={kind} className="flex min-h-11 items-center gap-2 text-content-sm text-text-default">
                    <input
                      type="radio"
                      name="report-reason"
                      value={kind}
                      checked={reportKind === kind}
                      onChange={() => setReportKind(kind)}
                    />
                    {REPORT_REASON_LABELS[kind]}
                  </label>
                ))}
              </fieldset>
              <label className="block text-chrome-sm text-text-muted">
                Anything else the moderators should know (optional)
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  maxLength={500}
                  className="focus-ring mt-1 w-full rounded-lg border border-border-hairline bg-surface-sunken p-2 text-content-sm text-text-default"
                />
              </label>
            </>
          ) : null}

          {dialog === "thread" ? (
            <label className="block text-chrome-sm text-text-muted">
              Name this thread
              <input
                value={threadName}
                onChange={(event) => setThreadName(event.target.value)}
                maxLength={THREAD_NAME_LIMITS.max}
                autoFocus
                className="focus-ring mt-1 w-full rounded-lg border border-border-hairline bg-surface-sunken p-2 text-content-sm text-text-default"
              />
            </label>
          ) : null}
        </ActionDialog>
      ) : null}
    </ContextMenu>
  );
}

/**
 * One dialog shape for all three, because they differ only in their body.
 *
 * Fixed to the viewport rather than anchored to the row: this renders inside a
 * scrolling list, and a dialog that scrolls away from the question it is asking
 * is worse than one that covers the list.
 */
function ActionDialog({
  title,
  children,
  busy,
  confirmLabel,
  destructive,
  onCancel,
  onConfirm,
}: {
  title: string;
  children: ReactNode;
  busy: boolean;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  /*
    Deliberately still a local component with the same props: every call site in
    this file keeps working, and the whole difference is in what backs it. This
    was a `fixed inset-0` that closed on Escape and nothing else — an outside
    click could not dismiss it, but neither was focus trapped, so Tab left the
    dialog while it still covered the screen.

    `ConfirmDialog` is an alert dialog, which is the right kind here: these
    actions delete a message or file a report, and an outside click must not be
    able to discard a decision half-made.
  */
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={title}
      confirmLabel={confirmLabel}
      tone={destructive ? "danger" : "default"}
      busy={busy}
      onConfirm={onConfirm}
    >
      <div className="space-y-3">{children}</div>
    </ConfirmDialog>
  );
}
