"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * A pane that slides over the conversation on a narrow screen.
 *
 * Both of the page's side columns become one of these below their breakpoint:
 * the channel list from the left, the member list from the right. It is a
 * dialog rather than a shifted layout because on a phone there is no room to
 * shift into — the conversation would be pushed off screen either way, and a
 * dialog at least says so to a screen reader and closes on Escape.
 *
 * It is rendered only while open, so nothing of it is in the accessibility
 * tree the rest of the time, and nothing of it can be reached by Tab from a
 * conversation the reader thinks is the only thing on screen.
 */
export function MobilePaneDrawer({
  side,
  label,
  onClose,
  children,
}: {
  side: "left" | "right";
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus moves into the pane when it opens, or Tab from the still-focused
  // trigger behind it walks the conversation rather than the pane.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-40 flex"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      {/*
        The backdrop is a button, not a div with a click handler: dismissing
        by tapping beside the pane is a real control, and one that keyboard
        users need to be able to reach and understand.
      */}
      <button
        type="button"
        aria-label={`Close ${label.toLowerCase()}`}
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 ${side === "left" ? "order-2" : "order-1"}`}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative flex h-full w-[17rem] max-w-[85vw] flex-col border-surgical-steel bg-surface-container-lowest outline-none ${
          side === "left" ? "order-1 border-r" : "order-2 ml-auto border-l"
        }`}
      >
        <div className="flex items-center justify-between border-b border-surgical-steel px-3 py-2">
          <span className="text-sm font-semibold text-on-surface">{label}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${label.toLowerCase()}`}
            className="focus-ring rounded-lg p-1 text-fog-muted hover:text-on-surface"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
