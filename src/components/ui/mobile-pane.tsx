"use client"

import * as React from "react"

import { Sheet, SheetContent, type SheetSide } from "@/components/ui/sheet"

/*
  Promotes channels/MobilePane.tsx out of the channels namespace and onto the one
  overlay, which is where its focus trap and focus restore come from - the original
  focused into the panel on open and restored nothing.

  Its two good ideas are kept. It renders only while open, so a hidden duplicate of
  a member list never holds a second set of realtime subscriptions. And only one
  pane may be open at a time, which the caller enforces: two overlapping drawers on
  a phone leaves nothing of the conversation to return to.
*/

function MobilePane({
  open,
  onOpenChange,
  side = "left",
  label,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  side?: Extract<SheetSide, "left" | "right">
  label: string
  children: React.ReactNode
}) {
  if (!open) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        size="md"
        density="chrome"
        aria-label={label}
        showCloseButton={false}
        className="bg-surface-sunken"
      >
        {children}
      </SheetContent>
    </Sheet>
  )
}

export { MobilePane }
