"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ArrowLeft, X } from "lucide-react";
import { useCallback, useState } from "react";

import { SettingsNoticeProvider } from "@/components/community/settings/SettingsNoticeProvider";
import { SettingsRail } from "@/components/community/settings/SettingsRail";
import { SettingsSectionBody } from "@/components/community/settings/SettingsSectionBody";
import { useOpenSettings } from "@/components/community/settings/useOpenSettings";
import { settingsHref, type SettingsSectionId } from "@/lib/community-settings/sections";
import type { SettingsWorkspace } from "@/lib/community-settings/workspace";

/**
 * Discord's Server Settings shape: a full-screen modal with a grouped rail on
 * the left, one section in the middle, and a round close button (with its
 * "ESC" caption) top-right. Base UI supplies the focus trap, scroll lock and
 * Escape handling; closing hands control back to the route that opened it.
 *
 * Below `md` the rail is the first view and a section opens as the detail,
 * with a back chevron that returns to the rail.
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
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[80] bg-surface" />
        <DialogPrimitive.Popup
          aria-label="Community settings"
          className="fixed inset-0 z-[81] flex bg-surface text-on-surface outline-none"
        >
          <SettingsNoticeProvider>
            <aside
              className={`w-full shrink-0 overflow-y-auto border-r border-surgical-steel bg-surface-container-low md:block md:w-[232px] ${
                mobileDetail ? "hidden" : "block"
              }`}
            >
              <p className="terminal-label px-5 pt-5 text-[11px] uppercase tracking-wider text-fog-muted">
                Community settings
              </p>
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
                  className="focus-ring mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-on-surface-variant md:hidden"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  All settings
                </button>

                <header className="mb-6">
                  <DialogPrimitive.Title className="font-headline text-2xl font-bold text-text-strong">
                    {active.label}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="mt-1 text-sm leading-6 text-on-surface-variant">
                    {active.blurb}
                  </DialogPrimitive.Description>
                </header>

                {degraded.length > 0 && (
                  <div role="alert" className="mb-4 rounded-lg border border-error/40 bg-error/10 p-3">
                    {degraded.map((note) => (
                      <p key={note} className="text-sm leading-6 text-error">
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
                  className="focus-ring flex size-11 items-center justify-center rounded-lg border border-surgical-steel text-on-surface-variant transition hover:border-fog-muted hover:text-text-strong"
                >
                  <X size={20} aria-hidden="true" />
                </DialogPrimitive.Close>
                <span aria-hidden="true" className="font-label text-[11px] font-semibold text-fog-muted">
                  ESC
                </span>
              </div>
            </div>
          </SettingsNoticeProvider>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
