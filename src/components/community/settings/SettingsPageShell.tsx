"use client";

import { useCallback } from "react";

import { SettingsRail } from "@/components/community/settings/SettingsRail";
import { SettingsSectionBody } from "@/components/community/settings/SettingsSectionBody";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { settingsHref, type SettingsSectionId } from "@/lib/community-settings/sections";
import type { SettingsWorkspace } from "@/lib/community-settings/workspace";

/**
 * The full-page settings shell: app chrome, grouped rail, one section body.
 * The section comes from the URL and is validated server-side; the rail only
 * links, so a reload lands on exactly what was open.
 *
 * Monolith, phase 12a. The heading is `ui/page-header` rather than a fourth
 * hand-written copy of the same h1-and-blurb pair, and the transient messages
 * this subtree raises now go to the product's one toast - see
 * `SettingsSectionBody` for what was removed and why.
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
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:grid md:grid-cols-[16rem_minmax(0,1fr)] md:gap-8">
        <div className="mb-6 md:mb-0">
          <SettingsRail sections={visible} current={query.section} hrefFor={hrefFor} variant="page" />
        </div>

        <section aria-label={active.label} className="min-w-0">
          <PageHeader title={active.label} description={active.blurb} />

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
        </section>
      </div>
    </AppShell>
  );
}
