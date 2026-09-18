"use client";

import Image from "next/image";

/**
 * What a member sees, rendered from the values currently in the form.
 *
 * Identity is one of only two sections with anything visual to preview, so this
 * is not a permanent third column - it sits beside this section alone.
 *
 * Monolith, phase 12a. The card stays on `surface-canvas` rather than moving up
 * to `surface-panel` with the product's other cards, and that is deliberate:
 * this is a picture of a *page*, and a member's page background is the canvas.
 * Painting it as a panel would show the creator their community one depth step
 * lighter than anybody will ever see it.
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
      className="rounded-xl border border-border-hairline bg-surface-canvas p-4"
    >
      <p className="terminal-label">Members see</p>

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
            // Near-black on the chosen accent. Safe because the field beside
            // this one refuses any hex under 3:1 against the near-black page,
            // which no colour that is itself near-black can clear.
            className="grid size-10 shrink-0 place-items-center rounded-lg text-content-sm font-semibold text-accent-contrast"
            style={{ background: "var(--preview-accent)" }}
          >
            {name.trim().slice(0, 1).toUpperCase() || "S"}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-title-sm font-medium text-text-strong">{name || "Your community"}</p>
          {tagline && <p className="truncate text-chrome-base text-text-muted">{tagline}</p>}
        </div>
      </div>

      {showWelcome && welcomeMessage && (
        <div className="mt-4 rounded-lg border border-border-hairline bg-surface-panel p-3">
          <p className="whitespace-pre-wrap text-content-sm text-text-default">{welcomeMessage}</p>
        </div>
      )}

      {rules && (
        <div className="mt-3">
          <p className="terminal-label">Rules</p>
          <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-content-sm text-text-muted">{rules}</p>
        </div>
      )}

      {!welcomeMessage && !rules && (
        <p className="mt-4 text-chrome-base text-text-muted">
          No welcome message or rules yet. Members see just the name and mark above.
        </p>
      )}
    </div>
  );
}
