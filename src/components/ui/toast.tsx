"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AlertCircle, Check, X } from "lucide-react";

/**
 * Transient messages, over the page rather than inside it.
 *
 * Every one of these used to be a paragraph rendered into the component that
 * produced it: a line under the composer, a banner above the message list, a
 * row inside the member list. They said the right thing and they said it in
 * the wrong place — appearing and disappearing reflowed whatever was around
 * them, so the act of failing to send a message moved the message you were
 * reading.
 *
 * A toast is the fix because the cost of a message must not be paid by the
 * layout. These float above everything, take no space when there are none,
 * and leave on their own.
 *
 * What does *not* belong here: anything attached to a field the person is
 * still editing, and anything describing the state of a region rather than
 * the outcome of an action. Validation under an input and "this thread could
 * not be loaded" inside the empty thread pane are both still rendered in
 * place, because their position is what makes them mean anything.
 */

export type ToastTone = "error" | "success";

/**
 * The shape every caller passes around. Named because settings sections hand
 * this down as an `onNotice` prop through three levels of component, and a
 * prop typed `(message: string) => void` silently drops the tone - which is
 * how a failure comes to be announced with a green tick.
 */
export type Notify = (message: string, tone?: ToastTone) => void;

type Toast = { id: number; message: string; tone: ToastTone };

/** Long enough to read twice; failures get longer, because they need acting on. */
const DURATION_MS: Record<ToastTone, number> = { error: 6000, success: 4000 };

/** Older messages fall off rather than filling the screen with a backlog. */
const VISIBLE_LIMIT = 3;

let sequence = 0;

const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

/**
 * `notify(message)` fails loudly without a provider rather than quietly
 * dropping the message — a swallowed error report is worse than a crash in
 * development, and the provider is mounted at the root layout.
 */
export function useToast(): Notify {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("useToast requires a <ToastProvider> above it.");
  return notify;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((message: string, tone: ToastTone = "error") => {
    const text = message.trim();
    if (text === "") return;
    // The id is taken here rather than inside the updater, which has to stay
    // pure: React may call it twice, and a counter would then skip.
    const id = (sequence += 1);
    setToasts((current) => {
      // The same failure twice is one failure said twice, not two things to
      // read. Dropping the old one and appending renews its timer as well.
      const withoutRepeat = current.filter((toast) => toast.message !== text);
      return [...withoutRepeat, { id, message: text, tone }].slice(-VISIBLE_LIMIT);
    });
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      {/*
        `assertive`, not `polite`: every message here is the consequence of
        something the person did a moment ago, and a failure that waits for a
        gap in the screen reader's queue is one they act on too late.
      */}
      <div
        aria-live="assertive"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-toast flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((toast) => (
          <ToastRow key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  // One timer per toast, owned by the toast: a renewed message is a new row
  // with a new id, so it remounts and starts its clock again.
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), DURATION_MS[toast.tone]);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.tone, onDismiss]);

  const failed = toast.tone === "error";

  return (
    <div
      className={`pointer-events-auto flex w-[min(24rem,100%)] animate-in items-start gap-2 rounded-md border px-chrome-x py-chrome-y text-chrome-sm leading-5 shadow-lg fade-in-0 slide-in-from-bottom-2 ${
        failed
          ? "border-status-danger/50 bg-surface-panel text-status-danger"
          : "border-border-hairline bg-surface-panel text-text-default"
      }`}
    >
      {failed ? (
        <AlertCircle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
      ) : (
        <Check size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-status-ok" />
      )}
      <p className="min-w-0 flex-1">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss this message"
        className="focus-ring hit-target relative -mr-1 shrink-0 rounded-sm p-0.5 text-text-muted hover:text-text-strong"
      >
        <X size={12} aria-hidden="true" />
      </button>
    </div>
  );
}
