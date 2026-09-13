"use client";

import { useCallback } from "react";

import { SettingsNoticeProvider } from "@/components/community/settings/SettingsNoticeProvider";
import { SettingsRail } from "@/components/community/settings/SettingsRail";
import { SettingsSectionBody } from "@/components/community/settings/SettingsSectionBody";
import { AppShell } from "@/components/layout/AppShell";
import { settingsHref, type SettingsSectionId } from "@/lib/community-settings/sections";
import type { SettingsWorkspace } from "@/lib/community-settings/workspace";

/**
 * The full-page settings shell: app chrome, grouped rail, one section body.
 * The section comes from the URL and is validated server-side; the rail only
 * links, so a reload lands on exactly what was open.
 */
export function SettingsPageShell({
  workspace,
  base,
  routeBase,
  platformRole,
}: {
  workspace: SettingsWorkspace;
  /** The page's own path, used to build section links. */
  base: string;
  routeBase: string;
  platformRole: "member" | "moderator" | "influencer" | "super_admin";
}) {
  const { visible, query, degraded } = workspace;
  const active = visible.find((section) => section.id === query.section) ?? visible[0];
  const hrefFor = useCallback((section: SettingsSectionId) => settingsHref(base, section), [base]);

  return (
    <AppShell active="Community settings" title="Community settings" routeBase={routeBase} platformRole={platformRole}>
      <SettingsNoticeProvider>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:grid md:grid-cols-[16rem_minmax(0,1fr)] md:gap-8">
          <div className="mb-6 md:mb-0">
            <SettingsRail sections={visible} current={query.section} hrefFor={hrefFor} variant="page" />
          </div>

          <section aria-label={active.label} className="min-w-0">
            <header className="mb-4">
              <h1 className="font-headline text-2xl font-bold text-text-strong">{active.label}</h1>
              <p className="mt-1 text-sm leading-6 text-on-surface-variant">{active.blurb}</p>
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
          </section>
        </div>
      </SettingsNoticeProvider>
    </AppShell>
  );
}
