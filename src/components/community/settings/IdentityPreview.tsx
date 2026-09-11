"use client";

import Image from "next/image";

/**
 * What a member sees, rendered from the values currently in the form.
 *
 * Identity is one of only two sections with anything visual to preview, so this
 * is not a permanent third column — it sits beside this section alone.
 */
export function IdentityPreview({
  name,
  tagline,
  accentColor,
  welcomeMessage,
  rules,
  showWelcome,
  logoUrl,
}: {
  name: string;
  tagline: string;
  accentColor: string;
  welcomeMessage: string;
  rules: string;
  showWelcome: boolean;
  logoUrl: string | null;
}) {
  return (
    // Scoped custom property, never a rewrite of globals.css: the accent is the
    // focus-ring colour everywhere, and a global edit from a preview would
    // repaint the whole app while the creator is still deciding.
    <div
      style={{ ["--preview-accent" as string]: accentColor }}
      className="rounded-xl border border-surgical-steel bg-surface p-4"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fog-muted">Members see</p>

      <div className="mt-3 flex items-center gap-3">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="size-10 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-lg text-sm font-bold text-on-primary-fixed"
            style={{ background: "var(--preview-accent)" }}
          >
            {name.trim().slice(0, 1).toUpperCase() || "S"}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-headline text-base font-bold text-white">{name || "Your community"}</p>
          {tagline && <p className="truncate text-xs leading-5 text-on-surface-variant">{tagline}</p>}
        </div>
      </div>

      {showWelcome && welcomeMessage && (
        <div className="mt-4 rounded-lg border border-surgical-steel bg-surface-container-low p-3">
          <p className="whitespace-pre-wrap text-sm leading-6 text-on-surface">{welcomeMessage}</p>
        </div>
      )}

      {rules && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fog-muted">Rules</p>
          <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-on-surface-variant">
            {rules}
          </p>
        </div>
      )}

      {!welcomeMessage && !rules && (
        <p className="mt-4 text-xs leading-5 text-fog-muted">
          No welcome message or rules yet. Members see just the name and mark above.
        </p>
      )}
    </div>
  );
}
