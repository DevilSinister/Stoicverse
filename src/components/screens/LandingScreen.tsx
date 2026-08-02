import Link from "next/link";

/**
 * Public marketing surface. Deliberately a server component with no client
 * bundle: it must not ship application screens, route tables, or API call
 * shapes to anonymous visitors.
 */

const STAGES = [
  {
    index: "01",
    phase: "Perception",
    title: "The Objective View",
    body: "Strip events of value judgments and identify what is under your control.",
    note: "Start by separating the event from the story you tell about it.",
  },
  {
    index: "02",
    phase: "Action",
    title: "Directed Will",
    body: "Act with reserve clauses, feedback loops, and personal constraints.",
    note: "Turn clear perception into deliberate, repeatable movement.",
  },
  {
    index: "03",
    phase: "Will",
    title: "Amor Fati",
    body: "Convert friction into material for deliberate practice and stronger judgment.",
    note: "Use what happens as training instead of treating it as an interruption.",
  },
  {
    index: "04",
    phase: "Synthesis",
    title: "The Inner Citadel",
    body: "Build a stable operating system for pressure and responsibility.",
    note: "Bring perception, action, and acceptance into one durable practice.",
  },
];

const INCLUDED = [
  "The Stoicverse community and its channels",
  "The complete opening curriculum",
  "Live events and monthly workshops",
  "Your progression path through the platform",
];

const FAQS = [
  {
    question: "What does membership unlock?",
    answer:
      "Membership gives you access to the Stoicverse community, the opening curriculum, live events, and your progression path through the platform.",
  },
  {
    question: "Is this a course or a community?",
    answer:
      "It is both. The curriculum gives your study a sequence, while the community and events give you places to test the ideas in conversation and practice.",
  },
  {
    question: "Can I cancel my membership?",
    answer:
      "Yes. You can cancel before your next billing date and keep access through the end of your current billing period.",
  },
  {
    question: "Is private mentorship available now?",
    answer:
      "Not at this stage. We are keeping the initial membership focused while the mentorship program is being prepared.",
  },
];

/** Shared focus treatment defined in globals.css, used across the app. */
const FOCUS = "focus-ring";

const gridField = (size: number): React.CSSProperties => ({
  backgroundImage:
    "linear-gradient(var(--color-surgical-steel) 1px, transparent 1px), linear-gradient(90deg, var(--color-surgical-steel) 1px, transparent 1px)",
  backgroundSize: `${size}px ${size}px`,
});

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden className={className}>
      <path d="M2.5 8h11m0 0L9 3.5M13.5 8 9 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden className="mt-1 shrink-0 text-primary-container">
      <path d="M3 8.5 6.2 11.7 13 4.9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      aria-hidden
      className="shrink-0 text-fog-muted transition duration-200 group-open:rotate-45 group-open:text-primary-container group-hover:text-primary-container"
    >
      <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function LandingScreen() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary-container focus:px-5 focus:py-3 focus:text-sm focus:font-medium focus:text-on-primary-fixed"
      >
        Skip to content
      </a>

      <header className="fixed inset-x-0 top-0 z-40 border-b border-surgical-steel bg-surface/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8 lg:px-12">
          <Link
            href="/"
            className={`inline-flex min-h-11 items-center text-lg font-bold tracking-[-0.02em] text-white ${FOCUS}`}
          >
            Stoicverse
          </Link>

          <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2 md:gap-6">
            <div className="hidden items-center gap-6 md:flex">
              <a href="#curriculum" className={`inline-flex min-h-11 items-center text-sm text-on-surface-variant transition hover:text-primary-container ${FOCUS}`}>
                Curriculum
              </a>
              <a href="#membership" className={`inline-flex min-h-11 items-center text-sm text-on-surface-variant transition hover:text-primary-container ${FOCUS}`}>
                Membership
              </a>
              <a href="#faq" className={`inline-flex min-h-11 items-center text-sm text-on-surface-variant transition hover:text-primary-container ${FOCUS}`}>
                FAQ
              </a>
              <span aria-hidden className="h-5 w-px bg-surgical-steel" />
            </div>

            <Link
              href="/login"
              className={`inline-flex min-h-11 items-center px-2 text-sm text-on-surface-variant transition hover:text-primary-container sm:px-3 ${FOCUS}`}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary-container px-4 text-sm font-semibold text-on-primary-fixed shadow-[0_8px_24px_-14px_rgba(16,185,129,0.95)] transition duration-150 hover:brightness-110 active:translate-y-px sm:px-5 ${FOCUS}`}
            >
              <span className="sm:hidden">Join</span>
              <span className="hidden sm:inline">Begin Journey</span>
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="pt-16">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-surgical-steel">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_80%_65%_at_15%_0%,#000,transparent_78%)]"
            style={gridField(88)}
          />
          <div className="relative mx-auto flex min-h-[min(44rem,calc(100svh-4rem))] max-w-7xl flex-col justify-center px-4 py-24 md:px-8 md:py-28 lg:px-12">
            <div className="settle max-w-4xl" style={{ "--settle-duration": "620ms" } as React.CSSProperties}>
              <h1 className="text-balance text-[clamp(2.4rem,6.4vw,4.75rem)] font-bold leading-[1.02] tracking-[-0.035em] text-white">
                Master the discipline of perception in a noisy world.
              </h1>
            </div>

            <p
              className="settle mt-8 max-w-[54ch] text-lg leading-relaxed text-on-surface-variant md:text-xl"
              style={{ "--settle-duration": "760ms" } as React.CSSProperties}
            >
              A paid community learning platform where study, gated video lessons, live events, and
              mentorship move through one precise operating surface.
            </p>

            <div
              className="settle mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
              style={{ "--settle-duration": "900ms" } as React.CSSProperties}
            >
              <Link
                href="/signup"
                className={`group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary-container px-7 text-[15px] font-semibold text-on-primary-fixed shadow-[0_10px_30px_-14px_rgba(16,185,129,0.95)] transition duration-150 hover:brightness-110 active:translate-y-px ${FOCUS}`}
              >
                Join the Discipline
                <ArrowIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#curriculum"
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-surgical-steel px-7 text-[15px] text-on-surface transition duration-150 hover:border-primary-container/60 hover:bg-surface-container-high/60 ${FOCUS}`}
              >
                See the path
              </a>
              <p className="text-sm text-fog-muted sm:ml-2">$10 / month. Cancel before your next renewal.</p>
            </div>

            {/* The four stages, stated as a rule rather than a row of boxes. */}
            <div
              className="settle mt-16 border-t border-surgical-steel pt-5 md:mt-24"
              style={{ "--settle-duration": "1040ms" } as React.CSSProperties}
            >
              <ol className="flex flex-wrap items-baseline gap-x-8 gap-y-3 text-sm text-fog-muted">
                {STAGES.map((stage) => (
                  <li key={stage.phase} className="flex items-baseline gap-2">
                    <span className="tabular-nums text-primary-container">{stage.index}</span>
                    <span className="text-on-surface">{stage.phase}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Curriculum */}
        <section id="curriculum" className="border-b border-surgical-steel bg-surface-container-low/40">
          <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28 lg:px-12">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <h2 className="max-w-2xl text-balance text-[clamp(1.75rem,3.2vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.025em] text-white">
                A practice that gets more useful under pressure.
              </h2>
              <p className="max-w-sm text-on-surface-variant">
                Four stages. One operating principle: see clearly, choose deliberately, and review
                honestly.
              </p>
            </div>

            <ol className="relative mt-14">
              <span
                aria-hidden
                className="draw-down absolute left-[3px] top-0 hidden h-full w-px origin-top bg-surgical-steel md:block"
              />
              {STAGES.map((stage) => (
                <li
                  key={stage.index}
                  className="group relative grid gap-x-10 gap-y-4 border-t border-surgical-steel py-9 transition-colors duration-200 last:border-b hover:bg-surface-container-high/30 md:grid-cols-[7rem_minmax(0,1fr)] md:py-11 lg:grid-cols-[7rem_minmax(0,17rem)_minmax(0,1fr)]"
                >
                  <div className="flex items-center gap-4 md:items-start md:pt-1">
                    <span
                      aria-hidden
                      className="relative z-10 hidden size-[7px] shrink-0 rounded-full bg-surgical-steel transition-colors duration-200 group-hover:bg-primary-container md:block"
                    />
                    <span className="tabular-nums text-sm font-semibold tracking-[0.06em] text-primary-container">
                      {stage.index}
                    </span>
                    <span className="text-sm text-fog-muted md:hidden">{stage.phase}</span>
                  </div>

                  <div>
                    <p className="hidden text-sm text-fog-muted md:block">{stage.phase}</p>
                    <h3 className="text-xl font-bold tracking-[-0.015em] text-white md:mt-2">
                      {stage.title}
                    </h3>
                  </div>

                  <div className="md:col-start-2 lg:col-start-3">
                    <p className="max-w-[62ch] leading-relaxed text-on-surface-variant">{stage.body}</p>
                    <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-fog-muted">{stage.note}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Membership */}
        <section id="membership" className="border-b border-surgical-steel">
          <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28 lg:px-12">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <h2 className="max-w-xl text-balance text-[clamp(1.75rem,3.2vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.025em] text-white">
                Start with a simple commitment.
              </h2>
              <p className="max-w-sm text-on-surface-variant">
                Everything you need to build the practice is included. We are keeping the first step
                focused while deeper mentorship is prepared.
              </p>
            </div>

            <div className="mt-12 grid overflow-hidden rounded-2xl border border-surgical-steel bg-monolith-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)]">
              <div className="p-7 md:p-10">
                <h3 className="text-lg font-bold text-white">Community Membership</h3>
                <p className="mt-3 max-w-[58ch] leading-relaxed text-on-surface-variant">
                  Monthly access to the Stoicverse community, the complete opening curriculum, live
                  events, and your progression path.
                </p>
                <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                  {INCLUDED.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-relaxed text-on-surface">
                      <CheckIcon />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col justify-center gap-6 border-t border-surgical-steel bg-surface-container-low p-7 md:p-10 lg:border-l lg:border-t-0">
                <div>
                  <p className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold tracking-[-0.03em] tabular-nums text-white">$10</span>
                    <span className="text-sm text-fog-muted">/ month</span>
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-fog-muted">
                    Cancel before your next billing date and keep access through the end of the
                    current period.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <Link
                    href="/signup"
                    className={`group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-container px-6 text-[15px] font-semibold text-on-primary-fixed shadow-[0_10px_30px_-14px_rgba(16,185,129,0.95)] transition duration-150 hover:brightness-110 active:translate-y-px ${FOCUS}`}
                  >
                    Create your account
                    <ArrowIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                  <p className="text-center text-sm text-fog-muted">
                    Already a member?{" "}
                    <Link href="/login" className={`font-medium text-primary-container hover:underline ${FOCUS}`}>
                      Log in
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-surface-container-low/40">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 md:px-8 md:py-28 lg:grid-cols-[0.7fr_1.3fr] lg:px-12">
            <h2 className="max-w-sm text-balance text-[clamp(1.75rem,3.2vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.025em] text-white">
              Questions before you begin.
            </h2>

            <div>
              <div className="border-t border-surgical-steel">
                {FAQS.map(({ question, answer }) => (
                  <details key={question} name="faq" className="group border-b border-surgical-steel">
                    <summary
                      className={`flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 text-base font-semibold text-white transition hover:text-primary-container [&::-webkit-details-marker]:hidden ${FOCUS}`}
                    >
                      <span>{question}</span>
                      <PlusIcon />
                    </summary>
                    <p className="max-w-[68ch] pb-6 pr-8 text-sm leading-relaxed text-on-surface-variant">
                      {answer}
                    </p>
                  </details>
                ))}
              </div>

              <p className="mt-8 text-sm text-fog-muted">
                Still deciding?{" "}
                <Link
                  href="/signup"
                  className={`inline-flex items-center gap-1.5 font-medium text-primary-container hover:underline ${FOCUS}`}
                >
                  Join the Discipline
                  <ArrowIcon className="size-3.5" />
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-surgical-steel bg-surface-container-low">
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-8 lg:px-12">
          <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr] md:gap-16">
            <div>
              <Link href="/" className={`inline-flex min-h-11 items-center text-lg font-bold tracking-[-0.02em] text-white ${FOCUS}`}>
                Stoicverse
              </Link>
              <p className="mt-1 max-w-xs text-sm leading-6 text-fog-muted">
                A quiet place to study, practice, and build a more deliberate life.
              </p>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-fog-muted">Explore</h2>
              <ul className="mt-2 flex flex-col text-sm text-on-surface-variant">
                <li>
                  <a href="#curriculum" className={`inline-flex min-h-11 items-center transition hover:text-primary-container ${FOCUS}`}>Curriculum</a>
                </li>
                <li>
                  <a href="#membership" className={`inline-flex min-h-11 items-center transition hover:text-primary-container ${FOCUS}`}>Membership</a>
                </li>
                <li>
                  <a href="#faq" className={`inline-flex min-h-11 items-center transition hover:text-primary-container ${FOCUS}`}>FAQ</a>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-fog-muted">Account</h2>
              <ul className="mt-2 flex flex-col text-sm text-on-surface-variant">
                <li>
                  <Link href="/login" className={`inline-flex min-h-11 items-center transition hover:text-primary-container ${FOCUS}`}>Log in</Link>
                </li>
                <li>
                  <Link href="/signup" className={`inline-flex min-h-11 items-center transition hover:text-primary-container ${FOCUS}`}>Create account</Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-4 border-t border-surgical-steel pt-6 text-sm text-fog-muted sm:flex-row sm:items-center sm:justify-between">
            <p>Copyright 2026 Stoicverse</p>
            <div className="flex gap-6">
              <Link href="/privacy" className={`inline-flex min-h-11 items-center transition hover:text-primary-container ${FOCUS}`}>Privacy Policy</Link>
              <Link href="/terms" className={`inline-flex min-h-11 items-center transition hover:text-primary-container ${FOCUS}`}>Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
