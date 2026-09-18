import Link from "next/link";

/**
 * The chrome every signed-out page wears.
 *
 * It replaces `layout/Header.tsx` and `layout/Footer.tsx`, which had zero
 * importers and were broken in the places they were not merely unused: the
 * header pointed at `/philosophers`, which is not a route, and at `#pricing`,
 * which is not an id on any page — the section is `#membership` — while
 * offering `/channels`, members only, to anonymous visitors. Every one of the
 * old footer's four links was `href="#"`, including the "Privacy" that never
 * reached `/privacy`. Both are deleted with this.
 *
 * **Every anchor here is absolute.** A bare `#curriculum` works on the landing
 * page and silently does nothing on `/privacy`, which is exactly the sort of
 * link that survives review because it is not broken everywhere.
 *
 * 56px rather than the 48px of the app chrome, and that is the whole reason:
 * 44px of button plus 6px above and below is 56. The public call to action is
 * the most important control on the site and was drawn at 36px, which is the
 * kind of miss that survives a screenshot and fails a thumb.
 */

/** Sections of the landing page, reachable from any public route. */
const SECTIONS = [
  { href: "/#curriculum", label: "Curriculum" },
  { href: "/#membership", label: "Membership" },
  { href: "/#faq", label: "FAQ" },
];

export function PublicHeader() {
  return (
    <header className="safe-x sticky top-0 z-sticky border-b border-border-hairline bg-surface-canvas">
      <div className="mx-auto flex h-14 max-w-[70rem] items-center justify-between gap-4 px-gutter-page md:px-content-x">
        <Link
          href="/"
          className="focus-ring inline-flex min-h-11 items-center text-content-base font-medium tracking-tight text-text-strong"
        >
          Stoicverse
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-1 md:gap-2">
          <div className="hidden items-center md:flex">
            {SECTIONS.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className="focus-ring inline-flex min-h-11 items-center px-3 text-content-sm text-text-muted transition-colors hover:text-text-strong"
              >
                {section.label}
              </Link>
            ))}
            <span aria-hidden className="mx-3 h-[18px] w-px bg-border-hairline" />
          </div>

          <Link
            href="/login"
            className="focus-ring inline-flex min-h-11 items-center px-3 text-content-sm text-text-muted transition-colors hover:text-text-strong"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="focus-ring inline-flex h-11 items-center justify-center rounded-lg bg-primary px-3.5 text-content-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 active:translate-y-px"
          >
            {/* "Create account" does not fit beside a wordmark at 375px. */}
            <span className="sm:hidden">Join</span>
            <span className="hidden sm:inline">Create account</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-mono text-mono-xs tracking-widest text-text-faint uppercase">{title}</h2>
      <ul className="mt-2 flex flex-col">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="focus-ring inline-flex min-h-11 items-center text-content-sm text-text-muted transition-colors hover:text-text-strong"
      >
        {children}
      </Link>
    </li>
  );
}

export function PublicFooter() {
  return (
    <footer className="safe-x safe-b border-t border-border-hairline bg-surface-sunken">
      <div className="mx-auto max-w-[70rem] px-gutter-page py-section md:px-content-x">
        <div className="grid gap-content-y md:grid-cols-[1.5fr_1fr_1fr_1fr] md:gap-content-x">
          <div>
            <Link
              href="/"
              className="focus-ring inline-flex min-h-11 items-center text-content-base font-medium tracking-tight text-text-strong"
            >
              Stoicverse
            </Link>
            <p className="mt-1 max-w-[34ch] text-content-sm text-text-faint">
              A quiet place to study, practice, and build a more deliberate life.
            </p>
          </div>

          <FooterColumn title="The practice">
            {SECTIONS.map((section) => (
              <FooterLink key={section.href} href={section.href}>
                {section.label}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Account">
            <FooterLink href="/login">Log in</FooterLink>
            <FooterLink href="/signup">Create an account</FooterLink>
            {/* Phase 4a built this route. A footer is where somebody who cannot
                get in goes looking for it. */}
            <FooterLink href="/auth/reset">Reset your password</FooterLink>
          </FooterColumn>

          <FooterColumn title="Legal">
            <FooterLink href="/privacy">Privacy policy</FooterLink>
            <FooterLink href="/terms">Terms of service</FooterLink>
          </FooterColumn>
        </div>

        <div className="mt-content-y flex flex-col gap-2 border-t border-border-hairline pt-content-gap text-content-sm text-text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Stoicverse</p>
          <p>Built for the disciplined mind.</p>
        </div>
      </div>
    </footer>
  );
}
