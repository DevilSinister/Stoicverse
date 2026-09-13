/**
 * What a keystroke on the channels page means.
 *
 * Split out from the shell for the same reason `message-actions.ts` was: the
 * question "does Ctrl+K open the switcher right now" has a right answer that
 * does not involve React, and a shortcut that fires while somebody is typing
 * a message is a bug you can only find by typing a message.
 *
 * The rule that does most of the work here is `typing`. Every one of these
 * keys is also a key somebody presses inside the composer — `k` is a letter,
 * Escape cancels a reply, the arrows move the caret — so a shortcut that does
 * not ask whether the caret is in a text field will steal from the composer.
 * The two exceptions are deliberate: Ctrl/Cmd+K and Alt+arrow carry a modifier
 * no text field uses, which is what makes them safe to take.
 *
 * Zero imports, so the unit test loads this directly.
 */

export type ShortcutEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  /** True when the caret is in an input, a textarea or anything contenteditable. */
  typing: boolean;
};

export type ShortcutAction =
  | "quickSwitcher"
  | "previousChannel"
  | "nextChannel"
  | "closeTopmost"
  | "editLastMessage"
  | null;

export function resolveShortcut(event: ShortcutEvent): ShortcutAction {
  const command = event.ctrlKey || event.metaKey;

  // Ctrl/Cmd+K, from anywhere including the composer. No text field binds it,
  // and somebody halfway through a message who wants another channel should
  // not have to leave the box first.
  if (command && !event.altKey && event.key.toLowerCase() === "k") return "quickSwitcher";

  // Alt+arrow walks the channel list. Alt rather than Ctrl because Ctrl+arrow
  // is word-wise caret movement in every text field on every platform.
  if (event.altKey && !command && event.key === "ArrowUp") return "previousChannel";
  if (event.altKey && !command && event.key === "ArrowDown") return "nextChannel";

  // Escape closes whatever is on top — a pane, the switcher — and is left
  // alone inside a text field, where it already cancels a reply or an edit.
  if (event.key === "Escape" && !event.typing) return "closeTopmost";

  // Up arrow on an empty composer edits your last message, the way it does in
  // every chat client. Only the shell can tell whether the composer is empty,
  // so this reports the intent and the caller decides.
  if (event.key === "ArrowUp" && !command && !event.altKey && !event.shiftKey && event.typing) {
    return "editLastMessage";
  }

  return null;
}

/** Whether the event's target is somewhere a keystroke means text, not a command. */
/*
  Deliberately duplicated from lib/ui/is-typing-target.ts, and gated by a contract
  test that asserts the two bodies stay identical.

  This module is imported as raw TypeScript by tests/channels-shortcuts.test.mjs
  under `node --test`, where the "@/" path alias does not resolve - the same reason
  rail.ts is written zero-import. Re-exporting the shared copy from here makes the
  whole test file fail to load, taking seven other tests with it.

  So: lib/ui/is-typing-target.ts is the canonical copy for everything that is not
  reached by a node test, this stays self-contained, and the contract test is what
  stops them drifting.
*/
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
