"use client";

import { type ReactNode } from "react";

import {
  Overlay,
  OverlayBody,
  OverlayContent,
  OverlayDescription,
  OverlayHeader,
  OverlayTitle,
} from "@/components/ui/overlay";

/**
 * The member modal. Monolith, phase 11b.
 *
 * **This was the last hand-rolled focus trap in the product.** Forty lines of
 * it: a `FOCUSABLE` selector string, a Tab handler that cycled first-to-last by
 * hand, a `previousFocus` ref restored on unmount, `document.body.style.overflow`
 * set and unset directly, an Escape listener on `document`, and a
 * `fixed inset-0 z-[80]` scrim dismissed by `onMouseDown`. Every one of those is
 * something Base UI's Dialog already owns, and each was a chance to get subtly
 * wrong — that Tab handler only intervened at the two ends, so focus could
 * still leave the panel through anything the list did not enumerate.
 *
 * It is `ui/overlay` now. The component keeps its name and props because
 * `MemberDetailModal` is its only caller and that shape is fine; what changed is
 * that none of the behaviour lives here any more.
 *
 * Two deliberate differences: the close control is the overlay's own (top
 * right, 44px hit area) rather than a hand-placed button carrying
 * `data-autofocus`, and initial focus goes where Base UI puts it rather than
 * always onto Close.
 */
export function MemberModalShell({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <Overlay
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <OverlayContent size={wide ? "full" : "lg"} className="sm:max-h-[88svh]">
        <OverlayHeader>
          <OverlayTitle className="text-title-md">{title}</OverlayTitle>
          {description && <OverlayDescription className="max-w-[65ch]">{description}</OverlayDescription>}
        </OverlayHeader>
        <OverlayBody className="p-0">{children}</OverlayBody>
      </OverlayContent>
    </Overlay>
  );
}
