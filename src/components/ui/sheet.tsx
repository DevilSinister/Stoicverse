"use client"

/*
  A shim over ui/overlay.tsx. Sheet and Dialog were always the same primitive -
  the previous version of this file imported base-ui's Dialog and renamed it -
  differing only in positioning classes. That difference is now the overlay's
  `placement` prop, so there is one focus trap, one scroll lock and one
  safe-area rule instead of two of each.

  `side` is mapped to `placement` for API compatibility. It defaults to "right".

  This is the target that channels/MobilePane.tsx converges on: a side sheet with
  a real backdrop, focus trapped and restored, rendered only while open.
*/

import * as React from "react"

import {
  Overlay,
  OverlayBody,
  OverlayClose,
  OverlayContent,
  OverlayDescription,
  OverlayFooter,
  OverlayHeader,
  OverlayTitle,
  OverlayTrigger,
} from "@/components/ui/overlay"

type SheetSide = "top" | "bottom" | "left" | "right"

const SIDE_TO_PLACEMENT = {
  bottom: "sheet-bottom",
  left: "sheet-left",
  right: "sheet-right",
  // Base UI gives no top placement and nothing in this product uses one; a top
  // sheet lands under the notch on a phone, which is why it is mapped away.
  top: "sheet-bottom",
} as const

const Sheet = Overlay
const SheetTrigger = OverlayTrigger
const SheetClose = OverlayClose
const SheetHeader = OverlayHeader
const SheetBody = OverlayBody
const SheetFooter = OverlayFooter
const SheetTitle = OverlayTitle
const SheetDescription = OverlayDescription

function SheetContent({
  side = "right",
  ...props
}: Omit<React.ComponentProps<typeof OverlayContent>, "placement"> & {
  side?: SheetSide
}) {
  return <OverlayContent placement={SIDE_TO_PLACEMENT[side]} {...props} />
}

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  type SheetSide,
}
