"use client"

/*
  Destructive confirmation, in one place.

  It replaces four things that said the same sentence four ways: ActionDialog in
  channels/MessageMenu.tsx, its near-identical twin in channels/MemberList.tsx, and
  the two `window.confirm` calls guarding unsaved event edits in CreatorEventsView.

  Built on AlertDialog rather than Dialog on purpose. An alert dialog does not
  dismiss on an outside click and announces as `role="alertdialog"` - losing work
  because a click landed two pixels outside a card is exactly the failure a
  discard-changes guard exists to prevent.

  `children` is the escape hatch for a confirmation that needs a field: the
  moderation flows collect a reason before they will act, and that is the same
  dialog with one textarea, not a different component.
*/

import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type ConfirmTone = "default" | "danger"

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  confirmDisabled = false,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmTone
  busy?: boolean
  confirmDisabled?: boolean
  onConfirm: () => void | Promise<void>
  children?: React.ReactNode
}) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-scrim bg-scrim duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <AlertDialogPrimitive.Popup
          data-slot="confirm-dialog"
          className={cn(
            "fixed z-overlay flex min-h-0 flex-col gap-content-gap border border-border-hairline bg-popover p-content-gap text-popover-foreground shadow-xl outline-none duration-150",
            "inset-x-0 bottom-0 rounded-t-xl pb-[max(env(safe-area-inset-bottom),var(--spacing-content-gap))]",
            "data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-4",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-4",
            "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100%-2rem)] sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-md sm:pb-content-gap",
            "sm:data-open:zoom-in-95 sm:data-open:slide-in-from-bottom-0 sm:data-closed:zoom-out-95 sm:data-closed:slide-out-to-bottom-0",
          )}
        >
          <div className="flex flex-col gap-1">
            <AlertDialogPrimitive.Title className="text-title-sm font-medium text-text-strong">
              {title}
            </AlertDialogPrimitive.Title>
            {description ? (
              <AlertDialogPrimitive.Description className="text-chrome-base text-text-muted">
                {description}
              </AlertDialogPrimitive.Description>
            ) : null}
          </div>

          {children}

          <div className="flex flex-col-reverse gap-chrome-gap sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Close disabled={busy} render={<Button variant="outline" />}>
              {cancelLabel}
            </AlertDialogPrimitive.Close>
            <Button
              variant={tone === "danger" ? "destructive" : "default"}
              disabled={busy || confirmDisabled}
              onClick={() => void onConfirm()}
            >
              {busy ? "Working…" : confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}

export { ConfirmDialog, type ConfirmTone }
