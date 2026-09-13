/*
  Promoted out of lib/channels/shortcuts.ts, where it was domain-free the whole
  time. Every keyboard shortcut in the product needs the same question - is the
  person typing right now, and therefore is this keystroke theirs rather than the
  application's - and a shortcut outside /channels should not have to import from
  the channels namespace to ask it.
*/
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
