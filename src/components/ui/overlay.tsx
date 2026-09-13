"use client"

/*
  The one overlay in the product.

  Before Monolith there were sixteen hand-rolled `fixed inset-0` surfaces, three
  separate hand-rolled focus traps, two `window.confirm` calls, and a z-index
  vocabulary that reached z-[81] and z-100 - because `createPortal` appeared zero
  times in src, so every overlay rendered in-tree and had to out-rank whatever
  ancestor it happened to sit inside.

  Base UI's Dialog owns portalling, scroll lock, focus trap, focus restore and
  Escape. None of that is reimplemented here. What this file adds is the three
  things each of those sixteen surfaces was re-deriving by hand:

    1. the mobile bottom-sheet / desktop-dialog switch, written once;
    2. safe-area bottom padding, which no /channels surface had at all;
    3. a density that matches the rest of the system rather than one dialog's taste.

  Stacking needs no z-index. Base UI portals each popup to <body> in mount order,
  so a dialog opened from inside another dialog's dismiss path - the unsaved-changes
  guard - paints above it because its portal node comes later in the document.
*/

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

type Density = "chrome" | "content"

const DensityContext = React.createContext<Density>("content")

const overlayContentVariants = cva(
  "fixed z-overlay flex min-h-0 flex-col bg-popover text-popover-foreground outline-none " +
    "border border-border-hairline shadow-xl duration-150 " +
    "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
  {
    variants: {
      placement: {
        /*
          The default. A bottom sheet on a phone, a centred dialog from `sm` up.
          Thumbs reach the bottom of a phone; a centred card does not survive a
          software keyboard opening under it.
        */
        responsive:
          "inset-x-0 bottom-0 max-h-[92svh] rounded-t-xl data-open:slide-in-from-bottom-4 data-closed:slide-out-to-bottom-4 " +
          "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[85svh] sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-md " +
          "sm:data-open:zoom-in-95 sm:data-open:slide-in-from-bottom-0 sm:data-closed:zoom-out-95 sm:data-closed:slide-out-to-bottom-0",
        center:
          "top-1/2 left-1/2 max-h-[85svh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-md " +
          "data-open:zoom-in-95 data-closed:zoom-out-95",
        "sheet-bottom":
          "inset-x-0 bottom-0 max-h-[92svh] rounded-t-xl data-open:slide-in-from-bottom-4 data-closed:slide-out-to-bottom-4",
        "sheet-left":
          "inset-y-0 left-0 h-svh max-w-[85vw] rounded-r-xl border-y-0 border-l-0 data-open:slide-in-from-left-4 data-closed:slide-out-to-left-4",
        "sheet-right":
          "inset-y-0 right-0 h-svh max-w-[85vw] rounded-l-xl border-y-0 border-r-0 data-open:slide-in-from-right-4 data-closed:slide-out-to-right-4",
      },
      size: {
        sm: "sm:max-w-sm",
        md: "sm:max-w-lg",
        lg: "sm:max-w-2xl",
        full: "sm:max-w-4xl",
      },
    },
    defaultVariants: { placement: "responsive", size: "md" },
  },
)

/*
  A side sheet is a column, so its width comes from `size` on a different axis.
  Kept out of the cva so the two axes cannot contradict each other.
*/
const SHEET_WIDTH: Record<string, string> = {
  sm: "w-64",
  md: "w-[17rem]",
  lg: "w-80",
  full: "w-96",
}

function Overlay(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="overlay" {...props} />
}

function OverlayTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="overlay-trigger" {...props} />
}

function OverlayClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="overlay-close" {...props} />
}

function OverlayBackdrop({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="overlay-backdrop"
      className={cn(
        "fixed inset-0 z-scrim bg-scrim duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  )
}

function OverlayContent({
  className,
  children,
  placement = "responsive",
  size = "md",
  density = "content",
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props &
  VariantProps<typeof overlayContentVariants> & {
    density?: Density
    showCloseButton?: boolean
  }) {
  const isSideSheet = placement === "sheet-left" || placement === "sheet-right"

  return (
    <DialogPrimitive.Portal>
      <OverlayBackdrop />
      <DialogPrimitive.Popup
        data-slot="overlay-content"
        data-density={density}
        className={cn(
          overlayContentVariants({ placement, size: isSideSheet ? undefined : size }),
          isSideSheet && SHEET_WIDTH[size ?? "md"],
          /*
            The content box carries no padding of its own - header, body and footer
            each bring their own at the right density, so a scrolling body reaches
            the edges instead of stopping short of an outer pad. The safe-area
            inset sits here because it belongs to the sheet, not to the footer that
            happens to be last. A no-op unless layout.tsx sets viewportFit: "cover".
          */
          !isSideSheet && "pb-[env(safe-area-inset-bottom)] sm:pb-0",
          isSideSheet && "safe-b safe-x",
          className,
        )}
        {...props}
      >
        <DensityContext.Provider value={density}>
          {children}
          {showCloseButton ? (
            <DialogPrimitive.Close
              data-slot="overlay-close"
              aria-label="Close"
              className="focus-ring hit-target absolute top-2 right-2 grid size-8 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface-raised hover:text-text-strong"
            >
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          ) : null}
        </DensityContext.Provider>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function useDensityPadding() {
  const density = React.useContext(DensityContext)
  return density === "chrome" ? "px-chrome-x py-chrome-y" : "px-content-gap py-content-gap"
}

function OverlayHeader({ className, ...props }: React.ComponentProps<"div">) {
  const pad = useDensityPadding()
  return (
    <div
      data-slot="overlay-header"
      className={cn("flex shrink-0 flex-col gap-1 border-b border-border-hairline pr-10", pad, className)}
      {...props}
    />
  )
}

function OverlayBody({ className, ...props }: React.ComponentProps<"div">) {
  const pad = useDensityPadding()
  return (
    <div
      data-slot="overlay-body"
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", pad, className)}
      {...props}
    />
  )
}

function OverlayFooter({ className, ...props }: React.ComponentProps<"div">) {
  const pad = useDensityPadding()
  return (
    <div
      data-slot="overlay-footer"
      className={cn(
        "flex shrink-0 flex-col-reverse gap-chrome-gap border-t border-border-hairline sm:flex-row sm:justify-end",
        pad,
        className,
      )}
      {...props}
    />
  )
}

function OverlayTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="overlay-title"
      className={cn("text-title-sm font-medium text-text-strong", className)}
      {...props}
    />
  )
}

function OverlayDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="overlay-description"
      className={cn("text-chrome-base text-text-muted", className)}
      {...props}
    />
  )
}

export {
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
  overlayContentVariants,
}
