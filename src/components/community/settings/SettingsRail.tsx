"use client";

import Link from "next/link";

import { SECTION_ICONS } from "@/components/community/settings/section-icons";
import { SETTINGS_GROUPS, type SettingsSection, type SettingsSectionId } from "@/lib/community-settings/sections";

/**
 * The grouped section list shared by the settings page and the overlay. Both
 * receive the same `visibleSections()` output, so they cannot disagree about
 * what a viewer may open.
 *
 * Monolith, phase 12a. The group heading was `terminal-label` *plus* a
 * hand-written copy of everything `terminal-label` already does - the mono
 * family, 11px, uppercase, the tracking and the muted colour, all restated in
 * four more classes. Two of those four then disagreed with it
 * (`tracking-wider` is 0.05em against the utility's 0.12em), so the class that
 * looked redundant was quietly overriding the one that was not.
 */
export function SettingsRail({
  sections,
  current,
  hrefFor,
  onNavigate,
  variant,
}: {
  sections: readonly SettingsSection[];
  current: SettingsSectionId;
  hrefFor: (section: SettingsSectionId) => string;
  onNavigate?: (section: SettingsSectionId) => void;
  variant: "page" | "overlay";
}) {
  const groups = SETTINGS_GROUPS.map((group) => ({
    ...group,
    sections: sections.filter((section) => section.group === group.id),
  })).filter((group) => group.sections.length > 0);

  return (
    <nav aria-label="Settings sections" className={variant === "overlay" ? "px-2 py-4" : undefined}>
      {groups.map((group) => (
        <div key={group.id} className="mb-content-gap last:mb-0">
          <p className="terminal-label px-3 pb-1">{group.label}</p>
          <ul className="space-y-0.5">
            {group.sections.map((section) => {
              const Icon = SECTION_ICONS[section.id];
              const isCurrent = section.id === current;
              return (
                <li key={section.id}>
                  <Link
                    href={hrefFor(section.id)}
                    replace
                    scroll={false}
                    aria-current={isCurrent ? "page" : undefined}
                    onClick={() => onNavigate?.(section.id)}
                    className={`focus-ring flex min-h-11 items-center gap-2 rounded-lg px-3 text-content-sm font-medium transition-colors ${
                      isCurrent
                        ? "bg-surface-raised text-text-strong"
                        : "text-text-muted hover:bg-surface-raised/50 hover:text-text-strong"
                    }`}
                  >
                    <Icon size={15} aria-hidden="true" className="shrink-0 text-text-faint" />
                    {section.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
