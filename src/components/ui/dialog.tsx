"use client"

/*
  A shim over ui/overlay.tsx, kept so the familiar shadcn Dialog API still works.

  This file used to be a second, independently styled dialog implementation. It
  had zero importers - as did sheet.tsx and alert-dialog.tsx - while sixteen
  screens hand-rolled their own `fixed inset-0` surfaces. Rather than delete it
  and leave the registry name dangling, it now resolves to the one overlay.

  One deliberate difference from stock shadcn: DialogContent defaults to
  `placement="responsive"`, so it is a bottom sheet on a phone and a centred
  dialog from `sm` up. Pass `placement="center"` for the stock behaviour.

  DialogContent portals itself, so DialogPortal is only here for API
  compatibility and should not be wrapped around DialogContent.
*/

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import {
  Overlay,
  OverlayBackdrop,
  OverlayBody,
  OverlayClose,
  OverlayContent,
  OverlayDescription,
  OverlayFooter,
  OverlayHeader,
  OverlayTitle,
  OverlayTrigger,
} from "@/components/ui/overlay"

const Dialog = Overlay
const DialogTrigger = OverlayTrigger
const DialogClose = OverlayClose
const DialogContent = OverlayContent
const DialogHeader = OverlayHeader
const DialogBody = OverlayBody
const DialogFooter = OverlayFooter
const DialogTitle = OverlayTitle
const DialogDescription = OverlayDescription
const DialogOverlay = OverlayBackdrop

function DialogPortal(props: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
