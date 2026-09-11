"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Hash, MessageSquare, Sparkles } from "lucide-react";

import { StructureEditor } from "@/components/community/structure/StructureEditor";
import type { CommunityCategory, CommunityChannel } from "@/components/community/types";
import { ComposerSection } from "@/components/creator/settings/ComposerSection";
import { IdentitySection } from "@/components/creator/settings/IdentitySection";
import { AppShell } from "@/components/layout/AppShell";
import type { CommunityComposer, CommunityIdentity } from "@/lib/community-settings/model";

export type CommunitySettingsSection = "identity" | "channels" | "composer";

/** Sections with a server action and a database policy behind them. */
const SECTIONS = [
  {
    id: "identity" as const,
    label: "Identity & welcome",
    blurb: "The name, mark, and first words a member meets.",
    icon: Sparkles,
  },
  {
    id: "channels" as const,
    label: "Channels",
    blurb: "Name, group, and gate every channel members can open.",
    icon: Hash,
  },
  {
    id: "composer" as const,
    label: "Composer & reactions",
    blurb: "What a message may contain, and how members can respond to one.",
    icon: MessageSquare,
  },
];

/**
 * Sections the plan builds in later phases. Listed, not rendered as controls:
 * a toggle with no service behind it is worse than an absent one, because it
 * tells the creator a rule is in force when nothing enforces it.
 */
const PLANNED = [
  { label: "Roles & permissions", blurb: "What each role may do — post, pin, delete, mention." },
  { label: "Moderation", blurb: "Slow mode, blocked words, edit window, and delete reasons." },
  { label: "Audit log", blurb: "Every edit, delete, pin, and unpin, with the previous message." },
];

export function CommunitySettingsWorkspace({
  initialSection,
  categories,
  channels,
  identity,
  composer,
  logoUrl,
  degraded,
}: {
  initialSection: CommunitySettingsSection;
  categories: CommunityCategory[];
  channels: CommunityChannel[];
  identity: CommunityIdentity;
  composer: CommunityComposer;
  logoUrl: string | null;
  /** What could not be read. Reads degrade; the matching writes are disabled. */
  degraded: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [section, setSection] = useState<CommunitySettingsSection>(initialSection);
  const [notice, setNotice] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setNotice(null);
      toastTimer.current = null;
    }, 2600);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const openSection = (next: CommunitySettingsSection) => {
    setSection(next);
    router.replace(`${pathname}?section=${next}`, { scroll: false });
  };

  const active = SECTIONS.find((entry) => entry.id === section) ?? SECTIONS[0];

  return (
    <AppShell active="Community settings" title="Community settings" routeBase="/creator" platformRole="influencer">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:grid md:grid-cols-[16rem_minmax(0,1fr)] md:gap-8">
        <nav aria-label="Community settings sections" className="mb-6 md:mb-0">
          <ul className="space-y-1">
            {SECTIONS.map((entry) => {
              const isCurrent = entry.id === section;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => openSection(entry.id)}
                    aria-current={isCurrent ? "page" : undefined}
                    className={`focus-ring flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold transition ${
                      isCurrent
                        ? "bg-surface-container-high text-white"
                        : "text-on-surface-variant hover:bg-surface-container-high/50"
                    }`}
                  >
                    <entry.icon size={15} aria-hidden="true" className="shrink-0 text-fog-muted" />
                    {entry.label}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 border-t border-surgical-steel pt-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fog-muted">Not built yet</h2>
            <ul className="mt-2 space-y-2">
              {PLANNED.map((entry) => (
                <li key={entry.label} className="text-sm text-fog-muted">
                  <span className="block font-medium text-on-surface-variant/70">{entry.label}</span>
                  <span className="block text-xs leading-5">{entry.blurb}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-5 text-fog-muted">
              Each ships with the database rule that enforces it, so nothing here is a setting the server ignores.
            </p>
          </div>
        </nav>

        <section aria-label={active.label} className="min-w-0">
          <header className="mb-4">
            <h1 className="font-headline text-2xl font-bold text-white">{active.label}</h1>
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

          {section === "identity" && (
            <IdentitySection identity={identity} logoUrl={logoUrl} canSave={degraded.length === 0} />
          )}
          {section === "composer" && <ComposerSection composer={composer} canSave={degraded.length === 0} />}
          {section === "channels" && (
            <div className="overflow-hidden rounded-xl border border-surgical-steel bg-surface-container-low">
              <StructureEditor variant="inline" categories={categories} channels={channels} onNotice={showNotice} />
            </div>
          )}
        </section>
      </div>

      <div aria-live="polite" className="sr-only">
        {notice}
      </div>

      {notice && (
        <div
          role="presentation"
          className="fixed bottom-4 left-1/2 z-[75] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-surgical-steel bg-monolith-surface px-4 py-3 text-sm text-on-surface shadow-[0_18px_48px_-24px_rgba(0,0,0,0.9)]"
        >
          {notice}
        </div>
      )}
    </AppShell>
  );
}
