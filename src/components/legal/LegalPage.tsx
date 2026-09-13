import type { ReactNode } from "react";

import { PublicFooter, PublicHeader } from "@/components/layout/PublicChrome";

/**
 * The reading layout for /privacy and /terms.
 *
 * What it replaces was a centred card on the legacy Stitch type classes, with
 * no header, no footer, and no way back except the wordmark — so the two pages
 * were the only ones in the product you could arrive at and not leave. They sit
 * in the public chrome now, like everything else a signed-out visitor can see.
 *
 * **Every section is numbered and listed at the top.** Not decoration: a policy
 * is referred to by section, and a page whose clauses cannot be named or linked
 * to cannot be cited in a complaint, a diff, or a support reply.
 *
 * **`updated` is required, not optional.** A policy page without a date does
 * not say which policy it is. Making it a prop the page cannot omit is the only
 * way that stays true after the copy is next edited in a hurry.
 */

export type LegalSection = {
  heading: string;
  body: ReactNode;
};

function slug(heading: string) {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  /** Rendered as written, so the page states a date rather than a build time. */
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="flex min-h-[100svh] flex-col bg-surface-canvas text-text-default">
      <PublicHeader />

      <main className="safe-x flex-1">
        <div className="mx-auto max-w-[70rem] px-gutter-page py-section md:px-content-x">
          <p className="font-mono text-mono-xs tracking-widest text-text-faint uppercase">{`Last updated ${updated}`}</p>
          <h1 className="mt-3 max-w-[20ch] text-title-lg font-medium text-balance text-text-strong">{title}</h1>
          <div className="mt-content-gap max-w-[68ch] text-content-lg text-text-default">{intro}</div>

          <nav
            aria-label="Sections"
            className="mt-content-y flex flex-wrap gap-x-content-gap border-y border-border-hairline py-2"
          >
            {sections.map((section, index) => (
              <a
                key={section.heading}
                href={`#${slug(section.heading)}`}
                className="focus-ring inline-flex min-h-11 items-center gap-2 text-content-sm text-text-muted transition-colors hover:text-text-strong"
              >
                <span className="font-mono text-mono-xs text-text-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {section.heading}
              </a>
            ))}
          </nav>

          {sections.map((section, index) => (
            <section
              key={section.heading}
              id={slug(section.heading)}
              // Clears the sticky header when an anchor jumps to it.
              className="mt-content-y max-w-[68ch] scroll-mt-20"
            >
              <h2 className="flex items-baseline gap-3 text-title-sm font-medium text-text-strong">
                <span className="font-mono text-mono-sm text-text-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {section.heading}
              </h2>
              <div className="mt-3 text-content-base leading-relaxed text-text-muted">{section.body}</div>
            </section>
          ))}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
