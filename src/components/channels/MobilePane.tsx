"use client";

import type { ReactNode } from "react";

import { Overlay, OverlayContent, OverlayTitle } from "@/components/ui/overlay";

/**
 * A pane that slides over the conversation on a narrow screen.
 *
 * Both of the page's side columns become one of these below their breakpoint:
 * the channel list from the left, the member list from the right. It is a
 * dialog rather than a shifted layout because on a phone there is no room to
 * shift into — the conversation would be pushed off screen either way, and a
 * dialog at least says so to a screen reader.
 *
 * What this used to be, and what it stopped having to be: a `fixed inset-0`
 * with a hand-written Escape handler, a `focus()` on mount, and a full-screen
 * button for the backdrop. It closed on Escape, but Tab still walked straight
 * out of it into the conversation behind, and the conversation still scrolled
 * under it. Base UI owns the trap, the restore, the scroll lock and Escape;
 * `sheet-left` and `sheet-right` are the same two directions this always had,
 * and the safe-area padding is new — the folder had none anywhere.
 *
 * The close button is gone from the header because `OverlayContent` draws one.
 */
export function MobilePaneDrawer({
  side,
  label,
  onClose,
  size = "md",
  children,
}: {
  side: "left" | "right";
  label: string;
  onClose: () => void;
  /**
   * `md` is 17rem, enough for one list. The channel drawer carries two levels
   * of navigation side by side, so it asks for `lg` - 20rem, which the
   * primitive caps at 85vw.
   */
  size?: "md" | "lg";
  children: ReactNode;
}) {
  return (
    <Overlay
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <OverlayContent
        placement={side === "left" ? "sheet-left" : "sheet-right"}
        size={size}
        density="chrome"
        className="bg-surface-sunken"
      >
        <div className="flex h-chrome-row shrink-0 items-center border-b border-border-hairline pr-10 pl-chrome-x">
          <OverlayTitle className="text-chrome-base font-medium text-text-strong">{label}</OverlayTitle>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </OverlayContent>
    </Overlay>
  );
}
