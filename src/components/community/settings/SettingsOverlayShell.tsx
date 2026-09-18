"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ArrowLeft, X } from "lucide-react";
import { useCallback, useState } from "react";

import { SettingsRail } from "@/components/community/settings/SettingsRail";
import { SettingsSectionBody } from "@/components/community/settings/SettingsSectionBody";
import { useOpenSettings } from "@/components/community/settings/useOpenSettings";
import { buttonVariants } from "@/components/ui/button";
import { settingsHref, type SettingsSectionId } from "@/lib/community-settings/sections";
import type { SettingsWorkspace } from "@/lib/community-settings/workspace";

/**
 * Discord's Server Settings shape: a full-screen modal with a grouped rail on
 * the left, one section in the middle, and a square close button (with its
 * "ESC" caption) top-right. Base UI supplies the focus trap, scroll lock and
 * Escape handling; closing hands control back to the route that opened it.
 *
 * Below `md` the rail is the first view and a section opens as the detail,
 * with a back chevron that returns to the rail.
 *
 * Monolith, phase 12a. Three things changed beyond the palette.
 *
 * **`z-[80]` and `z-[81]` are `z-scrim` and `z-overlay`.** The scale exists so
 * the layering of the product is readable in one file rather than inferred from
 * arbitrary numbers at each call site; 80 and 81 were above every named layer
 * including the toast, which meant a failure raised from inside these settings
 * rendered *behind* them.
 *
 * **Both the backdrop and the popup are `data-closed:pointer-events-none`.**
 * Base UI keeps a closing popup mounted until its exit animation reports
 * finished, so a full-viewport scrim whose animation never completes swallows
 * every click on the page underneath - which is precisely what the in-app
 * browser produces, where animations never run at all.
 *
 * **The close control is `buttonVariants`, not a hand-written border.** It is a
 * `DialogPrimitive.Close`, so it must stay an element the library owns rather
 * than become a `<Button>`.
 */
export function SettingsOverlayShell({
  workspace,
  base,
  fallback,
}: {
  workspace: SettingsWorkspace;
  /** The intercepted settings path, e.g. "/channels/settings". */
  base: string;
  /** Where to go when there is no history to return to. */
  fallback: string;
}) {
  const { visible, query, degraded } = workspace;
  const active = visible.find((section) => section.id === query.section) ?? visible[0];
  const { closeSettings } = useOpenSettings(base, fallback);
  const hrefFor = useCallback((section: SettingsSectionId) => settingsHref(base, section), [base]);
  const [mobileDetail, setMobileDetail] = useState(false);

  return (
    <DialogPrimitive.Root
      open
      modal
      onOpenChange={(open) => {
        if (!open) closeSettings();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-scrim bg-surface-canvas data-closed:pointer-events-none" />
        <DialogPrimitive.Popup
          aria-label="Community settings"
          className="fixed inset-0 z-overlay flex bg-surface-canvas text-text-default outline-none data-closed:pointer-events-none"
        >
          <aside
            className={`w-full shrink-0 overflow-y-auto border-r border-border-hairline bg-surface-panel md:block md:w-[232px] ${
              mobileDetail ? "hidden" : "block"
            }`}
          >
            <p className="terminal-label px-5 pt-5">Community settings</p>
            <SettingsRail
              sections={visible}
              current={query.section}
              hrefFor={hrefFor}
              onNavigate={() => setMobileDetail(true)}
              variant="overlay"
            />
          </aside>

          <div className={`relative min-w-0 flex-1 overflow-y-auto ${mobileDetail ? "block" : "hidden md:block"}`}>
            <div className="mx-auto w-full max-w-3xl px-5 pb-16 pt-6 sm:px-8 md:pt-12">
              <button
                type="button"
                onClick={() => setMobileDetail(false)}
                className={buttonVariants({ variant: "ghost", className: "mb-content-gap md:hidden" })}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                All settings
              </button>

              <header className="mb-content-gap flex flex-col gap-1">
                <DialogPrimitive.Title className="text-title-md font-medium text-text-strong">
                  {active.label}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="max-w-[70ch] text-content-sm text-text-muted">
                  {active.blurb}
                </DialogPrimitive.Description>
              </header>

              {degraded.length > 0 && (
                <div
                  role="alert"
                  className="mb-content-gap rounded-lg border border-status-danger/40 bg-status-danger/10 p-chrome-x"
                >
                  {degraded.map((note) => (
                    <p key={note} className="text-content-sm text-status-danger">
                      {note}
                    </p>
                  ))}
                </div>
              )}

              <SettingsSectionBody workspace={workspace} />
            </div>

            <div className="absolute right-4 top-4 flex flex-col items-center gap-1 sm:right-8 sm:top-8">
              <DialogPrimitive.Close
                aria-label="Close settings"
                className={buttonVariants({ variant: "outline", size: "icon" })}
              >
                <X size={20} aria-hidden="true" />
              </DialogPrimitive.Close>
              <span aria-hidden="true" className="font-mono text-chrome-xs font-medium text-text-muted">
                ESC
              </span>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
