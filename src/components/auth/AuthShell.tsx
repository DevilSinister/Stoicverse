import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The frame every signed-out screen sits in.
 *
 * Extracted when phase 4 added three more of them - the confirmation screen and
 * the two halves of password reset - because the split layout, the safe-area
 * padding and the 26rem measure were about to be copied four times.
 *
 * The left panel is a *panel*, not decoration. It used to carry a masked grid
 * overlay behind the copy, which Monolith bans outright: the sentence and the
 * step list are the only things in it now, on a surface one step darker than
 * the form beside them. Below `lg` it is not rendered at all - a phone gets the
 * wordmark and the form, because a 375px column has no room to say anything
 * twice.
 */
export function AuthShell({
  headline,
  children,
  aside,
  lede,
}: {
  /** The left panel's sentence. Omitted for the screens that are one card. */
  headline?: string;
  /** Under the headline: the step list, or a paragraph. */
  aside?: ReactNode;
  lede?: string;
  children: ReactNode;
}) {
  const split = Boolean(headline);

  return (
    // svh, not vh: mobile browser chrome makes 100vh taller than the visible
    // area, which pushes the submit button under the URL bar.
    <div
      className={`min-h-[100svh] bg-surface-canvas text-text-default ${
        split ? "lg:grid lg:min-h-screen lg:grid-cols-[1fr_34rem]" : ""
      }`}
    >
      {split ? (
        <section className="safe-x hidden flex-col justify-between border-r border-border-hairline bg-surface-sunken p-content-y lg:flex xl:p-section">
          <Wordmark />

          <div className="my-auto max-w-lg py-content-y">
            <h2 className="text-title-lg font-medium text-balance text-text-strong">{headline}</h2>
            {lede ? <p className="mt-content-gap max-w-[46ch] text-content-base text-text-muted">{lede}</p> : null}
            {aside}
          </div>

          <p className="max-w-[34ch] text-chrome-base text-text-faint">
            A quiet place to study, practice, and build a more deliberate life.
          </p>
        </section>
      ) : null}

      {/*
        The safe-area insets are utilities and they set padding directly, so the
        vertical rhythm is a margin on the inner column rather than a `py-*`
        that would race them for the same property.
      */}
      <section className="safe-x safe-t safe-b flex min-h-[100svh] flex-col justify-center px-gutter-page lg:min-h-screen">
        <div className="mx-auto my-content-y w-full max-w-[26rem]">
          {split ? (
            <div className="mb-content-gap lg:hidden">
              <Wordmark />
            </div>
          ) : null}
          {children}
        </div>
      </section>
    </div>
  );
}

function Wordmark() {
  return (
    <Link
      href="/"
      className="focus-ring inline-flex min-h-11 items-center text-content-base font-medium tracking-tight text-text-strong lg:min-h-0"
    >
      Stoicverse
    </Link>
  );
}

/** The heading and the one line under it, identical on all five screens. */
export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <>
      <h1 className="text-title-md font-medium text-text-strong">{title}</h1>
      {children ? <p className="mt-1.5 text-content-sm text-text-muted">{children}</p> : null}
    </>
  );
}

/**
 * The mail glyph the two "check your inbox" screens open with.
 *
 * A 4px square with a hairline, not a 48px lime disc. The accent is reserved
 * for the one action per screen, and on a screen whose only action is "go
 * back" that is not this.
 */
export function MailGlyph() {
  return (
    <span className="grid size-10 place-items-center rounded-md border border-border-hairline bg-surface-panel text-primary">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m2 7 10 6 10-6" />
      </svg>
    </span>
  );
}

/** An address, set to be read character by character rather than skimmed. */
export function AddressChip({ email }: { email: string }) {
  return (
    <span className="mt-content-gap inline-block rounded-md border border-border-hairline bg-surface-panel px-2.5 py-2 font-mono text-mono-sm break-all text-text-strong">
      {email}
    </span>
  );
}
