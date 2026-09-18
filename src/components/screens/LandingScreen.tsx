import Link from "next/link";

import { PublicFooter, PublicHeader } from "@/components/layout/PublicChrome";

/**
 * Public marketing surface. Deliberately a server component with no client
 * bundle: it must not ship application screens, route tables, or API call
 * shapes to anonymous visitors.
 *
 * Phase 4 kept the structure — hero, the four stages, curriculum, membership,
 * FAQ — and took the marketing skin off it. What went: a radial-masked grid
 * field behind the hero and a second behind the curriculum, pill buttons,
 * emerald glow shadows under every call to action, and `font-bold` on every
 * heading. Monolith bans the first three outright and sets headings at 500.
 *
 * What replaces the grid field is the structure itself. The four stages were a
 * wrapped line of muted text under the hero; they are a ruled row now, which is
 * the page's spine stated once at the top and expanded further down.
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

/** The one accent-filled control per section, at content density. */
const PRIMARY =
  "focus-ring group inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-content-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 active:translate-y-px";

const SECONDARY =
  "focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border-strong px-5 text-content-sm text-text-default transition-colors hover:bg-surface-raised hover:text-text-strong";

const BAND = "mx-auto max-w-[70rem] px-gutter-page py-section md:px-content-x";

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden className={className}>
      <path
        d="M2.5 8h11m0 0L9 3.5M13.5 8 9 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden className="mt-1 shrink-0 text-primary">
      <path
        d="M3 8.5 6.2 11.7 13 4.9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
      className="shrink-0 text-text-faint transition-transform duration-200 group-open:rotate-45"
    >
      <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** The section heading pair, identical in all three bands below the hero. */
function BandHeading({ title, lede }: { title: string; lede: string }) {
  return (
    <div className="flex flex-col justify-between gap-content-gap md:flex-row md:items-end">
      <h2 className="max-w-[20ch] text-title-lg font-medium text-balance text-text-strong">{title}</h2>
      <p className="max-w-[34ch] text-content-base text-text-muted">{lede}</p>
    </div>
  );
}

export function LandingScreen() {
  return (
    <div className="min-h-[100svh] bg-surface-canvas text-text-default">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-menu focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-content-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <PublicHeader />

      <main id="main">
        {/* Hero */}
        <section className="safe-x border-b border-border-hairline">
          <div className={BAND}>
            <h1 className="max-w-[19ch] text-display font-medium text-balance text-text-strong">
              Master the discipline of perception in a noisy world.
            </h1>

            <p className="mt-content-gap max-w-[56ch] text-content-lg text-text-muted">
              A paid community learning platform where study, gated video lessons, live events, and mentorship move
              through one precise operating surface.
            </p>

            <div className="mt-content-y flex flex-col gap-chrome-gap sm:flex-row sm:items-center">
              <Link href="/signup" className={PRIMARY}>
                Join the Discipline
                <ArrowIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <Link href="#curriculum" className={SECONDARY}>
                See the path
              </Link>
              <p className="text-content-sm text-text-faint sm:ml-2">$10 / month. Cancel before your next renewal.</p>
            </div>

            {/*
              The spine of the page, stated once. This was a wrapped line of
              muted text; as a ruled row it says the same four words and also
              shows that they are a sequence.
            */}
            <ol className="mt-section grid border-t border-border-hairline sm:grid-cols-2 lg:grid-cols-4">
              {STAGES.map((stage) => (
                <li
                  key={stage.index}
                  className="border-b border-border-hairline py-content-gap sm:border-b-0 sm:px-content-gap sm:first:pl-0 lg:border-r lg:last:border-r-0"
                >
                  <span className="font-mono text-mono-xs tracking-wider text-primary">{stage.index}</span>
                  <span className="mt-1.5 block text-content-sm font-medium text-text-strong">{stage.phase}</span>
                  <span className="mt-0.5 block text-content-sm text-text-faint">{stage.note}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Curriculum */}
        <section id="curriculum" className="safe-x scroll-mt-14 border-b border-border-hairline bg-surface-sunken">
          <div className={BAND}>
            <BandHeading
              title="A practice that gets more useful under pressure."
              lede="Four stages. One operating principle: see clearly, choose deliberately, and review honestly."
            />

            <ol className="mt-content-y border-t border-border-hairline">
              {STAGES.map((stage) => (
                <li
                  key={stage.index}
                  className="grid gap-x-content-x gap-y-3 border-b border-border-hairline py-content-y md:grid-cols-[6rem_minmax(0,16rem)_minmax(0,1fr)]"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-mono-sm tracking-wider text-primary">{stage.index}</span>
                    <span className="text-content-sm text-text-muted md:hidden">{stage.phase}</span>
                  </div>

                  <div>
                    <p className="hidden text-content-sm text-text-muted md:block">{stage.phase}</p>
                    <h3 className="text-title-sm font-medium text-text-strong md:mt-1.5">{stage.title}</h3>
                  </div>

                  <div className="md:col-start-3">
                    <p className="max-w-[62ch] text-content-base text-text-muted">{stage.body}</p>
                    <p className="mt-2 max-w-[62ch] text-content-sm text-text-faint">{stage.note}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Membership */}
        <section id="membership" className="safe-x scroll-mt-14 border-b border-border-hairline">
          <div className={BAND}>
            <BandHeading
              title="Start with a simple commitment."
              lede="Everything you need to build the practice is included, while deeper mentorship is prepared."
            />

            <div className="mt-content-y grid overflow-hidden rounded-md border border-border-hairline bg-surface-panel lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
              <div className="p-content-y">
                <h3 className="text-title-sm font-medium text-text-strong">Community Membership</h3>
                <p className="mt-2.5 max-w-[58ch] text-content-base text-text-muted">
                  Monthly access to the Stoicverse community, the complete opening curriculum, live events, and your
                  progression path.
                </p>
                <ul className="mt-content-y grid gap-3 sm:grid-cols-2">
                  {INCLUDED.map((item) => (
                    <li key={item} className="flex gap-2.5 text-content-sm text-text-default">
                      <CheckIcon />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col justify-center gap-content-gap border-t border-border-hairline bg-surface-sunken p-content-y lg:border-t-0 lg:border-l">
                <div>
                  <p className="flex items-baseline gap-2">
                    <span className="text-title-lg font-medium tabular-nums text-text-strong">$10</span>
                    <span className="text-content-sm text-text-faint">/ month</span>
                  </p>
                  <p className="mt-2.5 text-content-sm text-text-faint">
                    Cancel before your next billing date and keep access through the end of the current period.
                  </p>
                </div>
                <div>
                  <Link href="/signup" className={`${PRIMARY} w-full`}>
                    Create your account
                    <ArrowIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                  <p className="mt-3 text-center text-content-sm text-text-faint">
                    Already a member?{" "}
                    <Link href="/login" className="focus-ring font-medium text-primary hover:underline">
                      Log in
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="safe-x scroll-mt-14 bg-surface-sunken">
          <div className={`${BAND} grid gap-content-y lg:grid-cols-[0.7fr_1.3fr] lg:gap-content-x`}>
            <h2 className="max-w-[12ch] text-title-lg font-medium text-balance text-text-strong">
              Questions before you begin.
            </h2>

            <div>
              <div className="border-t border-border-hairline">
                {FAQS.map(({ question, answer }) => (
                  <details key={question} name="faq" className="group border-b border-border-hairline">
                    <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-3 text-content-base font-medium text-text-strong [&::-webkit-details-marker]:hidden">
                      <span>{question}</span>
                      <PlusIcon />
                    </summary>
                    <p className="max-w-[68ch] pr-8 pb-content-gap text-content-sm text-text-muted">{answer}</p>
                  </details>
                ))}
              </div>

              <p className="mt-content-y text-content-sm text-text-faint">
                Still deciding?{" "}
                <Link
                  href="/signup"
                  className="focus-ring inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                >
                  Join the Discipline
                  <ArrowIcon className="size-3.5" />
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
