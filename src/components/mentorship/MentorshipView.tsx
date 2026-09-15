import Link from "next/link";
import { BookOpen, Calendar, Check, ChevronRight, ExternalLink, MessageCircle, MessageSquare, Video } from "lucide-react";

import { AppShell, type Notification } from "@/components/layout/AppShell";
import { buttonVariants } from "@/components/ui/button";

/**
 * Mentorship — the offer, and the workspace once it is bought. Monolith, phase 9.
 *
 * **The mentor's initial was invisible.** The avatar tile was
 * `bg-primary-container … text-primary-container`: the accent painted on
 * itself, so the letter was the same colour as the tile under it. It reads as
 * an empty square, which is why it survived — same family as the `text-accent`
 * icon in phase 5 and the `hover:text-accent-contrast` labels in 6, 7 and 8.
 *
 * **The price was a string in this file.** "$1,000.00" beside "2 Months" and
 * "60 days of full access", none of it read from anything: `plans.ts` gives
 * mentorship `termMonths: null`, so the term was an invention and the amount
 * was a claim nothing checked. The figure now comes from the price that will
 * be charged, through `priceFor`, and is absent rather than guessed when
 * Stripe cannot be read — the same rule the checkout screen already follows.
 *
 * **Both call-to-action links were hand-rolled buttons.** They are `<Link>`
 * with `buttonVariants()` now: a real link, styled as a button, which is the
 * shape phase 8 settled on after the Base UI `render` detour.
 *
 * Also gone: two `emerald-glow` shadows, four stock `emerald-*` colours where
 * the system has `--status-ok`, and the `animate-pulse` on the badge icon.
 */

type MentorshipViewProps = {
  isMaster: boolean;
  memberName: string;
  platformRole: string;
  currentTier: number;
  notifications: Notification[];
  hasMentorship: boolean;
  bookingUrl: string | null;
  mentorName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  /** Formatted by the server from Stripe; null when the lookup failed or is unconfigured. */
  price?: string | null;
  /** Said beside the amount, so a figure is never bare. From `plans.ts`. */
  cadence?: string;
  routeBase?: string;
};

const BENEFITS = [
  {
    icon: BookOpen,
    title: "1-on-1 daily log review",
    detail:
      "Your assigned mentor reads and annotates your daily journal reflections, giving you direct feedback on how you apply Stoic logic.",
  },
  {
    icon: Video,
    title: "Bi-weekly private calls",
    detail:
      "Two private 60-minute video reflection calls per month to calibrate your practice, test your progress, and align direction.",
  },
  {
    icon: MessageSquare,
    title: "Custom study roadmap",
    detail:
      "An individualised exercise plan mapped to your personal hurdles, providing readings and meditations focused on your objectives.",
  },
];

const day = (value: string) => new Date(value).toLocaleDateString();

export default function MentorshipView({
  isMaster,
  memberName,
  platformRole,
  currentTier,
  notifications,
  hasMentorship,
  bookingUrl,
  mentorName = "Marcus Aurelius",
  startsAt,
  endsAt,
  price = null,
  cadence = "one-time",
  routeBase = "",
}: MentorshipViewProps) {
  return (
    <AppShell
      active="Mentorship"
      title="Stoic Mentorship"
      isMaster={isMaster}
      memberName={memberName}
      platformRole={platformRole}
      currentTier={currentTier}
      notifications={notifications}
      routeBase={routeBase}
    >
      <main className="mx-auto w-full max-w-[1080px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        {hasMentorship ? (
          <ActiveMentorship
            bookingUrl={bookingUrl}
            mentorName={mentorName}
            startsAt={startsAt}
            endsAt={endsAt}
          />
        ) : (
          <MentorshipOffer price={price} cadence={cadence} />
        )}
      </main>
    </AppShell>
  );
}

function ActiveMentorship({
  bookingUrl,
  mentorName,
  startsAt,
  endsAt,
}: {
  bookingUrl: string | null;
  mentorName: string | null;
  startsAt: string | null;
  endsAt: string | null;
}) {
  const name = mentorName || "Marcus Aurelius";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-lg border border-status-ok/40 bg-status-ok/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="terminal-label text-status-ok">Active mentorship</p>
          <h1 className="mt-2 text-title-md font-medium text-text-strong">Your guidance slot is provisioned.</h1>
        </div>
        <dl className="font-mono text-mono-sm text-text-muted tabular-nums">
          {startsAt && (
            <div className="flex gap-2">
              <dt>Started</dt>
              <dd className="text-text-default">{day(startsAt)}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt>Ends</dt>
            <dd className="text-text-default">{endsAt ? day(endsAt) : "To be scheduled"}</dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-4 md:grid-cols-12">
        <section className="space-y-5 rounded-lg border border-border-hairline bg-surface-panel p-5 md:col-span-7">
          <h2 className="border-b border-border-hairline pb-3 text-title-sm font-medium text-text-strong">
            Your assigned mentor
          </h2>
          <div className="flex items-start gap-4">
            {/* `text-primary-foreground`, not `text-primary-container`: the tile
                is the accent, so the letter on it has to be the accent's own
                contrast colour or it is the same colour as its background. */}
            <div className="grid size-12 shrink-0 place-items-center rounded-md bg-primary text-title-sm font-medium text-primary-foreground">
              {name[0]}
            </div>
            <div>
              <h3 className="text-title-sm font-medium text-text-strong">{name}</h3>
              <p className="mt-1 text-content-sm text-text-default">
                Your guide will personally review your daily journal reflection logs, provide corrections, and hold
                reflection slots.
              </p>
            </div>
          </div>

          <div className="space-y-3 border-t border-border-hairline pt-4">
            <h3 className="terminal-label text-text-faint">Mentorship guidelines</h3>
            <ul className="space-y-2 text-content-sm text-text-default">
              <li className="flex items-start gap-2">
                <span aria-hidden className="text-primary">
                  •
                </span>
                <span>
                  Log reflections in the <code className="font-mono text-mono-sm">#morning-reflections</code> channel;
                  select private feedback options.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden className="text-primary">
                  •
                </span>
                <span>Your mentor reviews submissions within 24 hours Monday through Friday.</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-5 rounded-lg border border-border-hairline bg-surface-panel p-5 md:col-span-5">
          <h2 className="border-b border-border-hairline pb-3 text-title-sm font-medium text-text-strong">
            Booking calendar
          </h2>
          <p className="text-content-sm text-text-default">
            You have private 60-minute reflection slots available every two weeks. Use the calendar link below to
            schedule your video call.
          </p>
          {bookingUrl ? (
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ className: "w-full" })}
            >
              <Calendar size={15} />
              Book private session
              <ExternalLink size={13} />
            </a>
          ) : (
            <p className="flex min-h-11 w-full items-center justify-center rounded-md border border-border-hairline px-4 text-content-sm text-text-muted">
              Booking link pending
            </p>
          )}
        </section>
      </div>

      <section className="space-y-4 rounded-lg border border-border-hairline bg-surface-panel p-5">
        <h2 className="text-title-sm font-medium text-text-strong">Private guidance logs</h2>
        <div className="rounded-md border border-dashed border-border-hairline bg-surface-sunken py-10 text-center">
          <MessageCircle size={32} className="mx-auto text-text-faint" />
          <p className="mt-3 text-content-base text-text-strong">No active reviews yet</p>
          <p className="mt-1 text-content-sm text-text-muted">
            Submit your first reflection log to start receiving private guidance.
          </p>
        </div>
      </section>
    </div>
  );
}

function MentorshipOffer({ price, cadence }: { price: string | null; cadence: string }) {
  return (
    <div className="space-y-10">
      <header className="mx-auto max-w-2xl text-center">
        <p className="terminal-label text-text-faint">Now open for enrollment</p>
        <h1 className="mt-3 text-title-lg font-medium text-text-strong md:text-display">Stoic mentorship.</h1>
        <p className="mt-3 text-content-lg text-text-default">
          Direct, personal alignment on your practice. Work one-to-one with a Master Stoic to refine your judgment,
          discipline, and emotional control.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3" aria-label="What mentorship includes">
        {BENEFITS.map(({ icon: Icon, title, detail }) => (
          <article key={title} className="space-y-3 rounded-lg border border-border-hairline bg-surface-panel p-5">
            <div className="grid size-10 place-items-center rounded-md border border-border-hairline bg-surface-sunken text-primary">
              <Icon size={19} />
            </div>
            <h2 className="text-title-sm font-medium text-text-strong">{title}</h2>
            <p className="text-content-sm text-text-default">{detail}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-xl space-y-5 rounded-lg border border-border-hairline border-t-2 border-t-primary bg-surface-panel p-6 text-center">
        <div>
          <h2 className="text-title-md font-medium text-text-strong">Private guidance cohort</h2>
          <p className="mt-2 text-content-sm text-text-muted">One-to-one mentorship with a Master Stoic.</p>
        </div>

        {/* The amount is whatever Stripe will charge, or nothing at all. A
            missing figure is not a broken screen: the button still works and
            Stripe's own page states the amount before anyone pays. */}
        {price && (
          <p className="font-mono text-title-lg text-text-strong tabular-nums">
            {price}
            <span className="ml-2 align-middle text-content-sm text-text-muted">{cadence}</span>
          </p>
        )}

        <Link href="/checkout?product=mentorship" className={buttonVariants({ className: "w-full" })}>
          Enroll in mentorship
          <ChevronRight size={15} />
        </Link>

        <p className="flex items-center justify-center gap-2 text-content-sm text-text-muted">
          <Check size={13} className="text-primary" />
          Limited capacity — five active slots per cohort
        </p>
      </section>
    </div>
  );
}
