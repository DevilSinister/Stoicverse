"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Check, CircleAlert, LoaderCircle, Lock, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MembershipPlan, Product } from "@/lib/checkout/plans";

/**
 * Checkout hands off to Stripe Checkout: /api/checkout creates a session and
 * returns its URL. Card details are entered on Stripe's page, never here.
 *
 * The version before this one rendered card number, expiry, CVC and billing
 * address inputs that were never read or transmitted — the user typed a PAN
 * into this origin and then typed it again on Stripe. That is removed
 * deliberately: it misrepresented what the button does, and cardholder data
 * must not touch a page that is not PCI-scoped.
 *
 * **Every amount on this screen is read from the price that will be charged.**
 * They used to be strings in this file. A figure typed into a component is a
 * claim nothing checks, and the subscription screen this phase deleted is what
 * that ends as: it advertised an annual plan at $100 that no price id existed
 * for. When Stripe cannot be read the figure is absent rather than guessed, and
 * the note under the button already says the amount is confirmed before paying.
 *
 * **A plan is only offered when it has a price.** `plans` carries what is
 * configured, so an unbuilt term is invisible here instead of being a control
 * that fails at the last step.
 */

export type PlanOffer = {
  /** Null for mentorship, which is a single purchase with no term. */
  plan: MembershipPlan | null;
  /** Said beside the amount, so a figure is never bare. */
  cadence: string;
  /** Formatted by the server from Stripe; null when the lookup failed. */
  amount: string | null;
};

const COPY: Record<Product, { heading: string; name: string; blurb: string; includes: { icon: "check" | "chat" | "calendar"; title: string; detail: string }[] }> = {
  membership: {
    heading: "Activate your membership",
    name: "Community Membership",
    blurb: "The complete operating surface for disciplined study, feedback, and community reflection.",
    includes: [
      { icon: "check", title: "Full curriculum access", detail: "All four stages of Stoic practice, with video lessons and progress tracking." },
      { icon: "chat", title: "Community channels", detail: "Study daily with other practitioners inside curated spaces." },
      { icon: "calendar", title: "Live monthly workshops", detail: "Gated video sessions, reflection rooms, and live lectures." },
    ],
  },
  mentorship: {
    heading: "Secure your mentorship",
    name: "Private Mentorship",
    blurb: "Dedicated one-to-one review and private reflection slots with a Master Stoic.",
    includes: [
      { icon: "check", title: "1-on-1 private log review", detail: "Direct feedback on your daily journals from an experienced mentor." },
      { icon: "calendar", title: "Bi-weekly private calls", detail: "Two 60-minute video reflection calls per month to calibrate your practice." },
      { icon: "check", title: "Custom curriculum plan", detail: "A tailored reading and exercise path targeting your specific hurdles." },
    ],
  },
};

const PLAN_LABEL: Record<MembershipPlan, string> = { monthly: "Monthly", annual: "Annual" };

function IncludeIcon({ kind }: { kind: "check" | "chat" | "calendar" }) {
  // `text-primary`, not `text-accent`. shadcn's --accent is a hover fill and the
  // token layer points it at --surface-raised, so `text-accent` paints this icon
  // dark grey on a dark panel — invisible, and it looks like a missing icon
  // rather than a wrong colour. The brand accent is --primary.
  const className = "mt-0.5 size-[17px] shrink-0 text-primary";
  if (kind === "chat") return <MessageSquare className={className} />;
  if (kind === "calendar") return <CalendarDays className={className} />;
  return <Check className={className} />;
}

export function CheckoutScreen({
  product = "membership",
  plans,
  initialPlan = null,
  email,
  cancelled = false,
}: {
  product?: Product;
  plans: PlanOffer[];
  initialPlan?: MembershipPlan | null;
  email?: string;
  cancelled?: boolean;
}) {
  const copy = COPY[product];
  const [selected, setSelected] = useState<MembershipPlan | null>(initialPlan);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const offer = plans.find((entry) => entry.plan === selected) ?? plans[0] ?? null;
  // Nothing configured means no price id in the environment. Saying so beats a
  // button that reaches a 503 the reader cannot act on.
  const unavailable = plans.length === 0;

  const startCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(offer?.plan ? { product, plan: offer.plan } : { product }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Unable to start secure checkout.");
      window.location.assign(payload.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to start secure checkout.");
      setLoading(false);
    }
  };

  const includes = (
    <ul className="space-y-5">
      {copy.includes.map((item) => (
        <li key={item.title} className="flex gap-3">
          <IncludeIcon kind={item.icon} />
          {/* Labels, not headings: this list appears in both the rail and the
              mobile block, and heading-level items there would float without a
              parent on desktop. */}
          <div>
            <p className="text-content-sm font-medium text-text-strong">{item.title}</p>
            <p className="mt-1 text-content-sm text-text-muted">{item.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="min-h-[100svh] bg-surface-canvas text-text-default lg:grid lg:min-h-screen lg:grid-cols-[1fr_34rem]">
      {/* Context rail */}
      <section className="relative hidden overflow-hidden border-r border-border-hairline bg-surface-sunken p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_75%_60%_at_20%_0%,#000,transparent_75%)]"
          style={{
            backgroundImage:
              "linear-gradient(var(--border-hairline) 1px, transparent 1px), linear-gradient(90deg, var(--border-hairline) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        <Link href="/" className="focus-ring relative z-raised inline-flex text-title-sm font-medium tracking-[-0.02em] text-text-strong">
          Stoicverse
        </Link>

        {/* Deliberately a <p>, not a heading: the page's h1 lives in the summary
            column so phones — which never render this rail — still have one. */}
        <div className="relative z-raised my-auto max-w-lg py-10">
          <p className="text-balance text-[clamp(1.75rem,2.4vw,2.5rem)] leading-[1.1] font-medium tracking-[-0.025em] text-text-strong">
            Everything the practice needs, in one place.
          </p>
          <p className="mt-4 max-w-[54ch] text-content-base text-text-default">{copy.blurb}</p>
          <div className="mt-10">{includes}</div>
        </div>

        <p className="relative z-raised max-w-xs text-content-sm text-text-muted">
          A quiet place to study, practice, and build a more deliberate life.
        </p>
      </section>

      {/* Order summary */}
      <section
        className="flex flex-col justify-center bg-surface-canvas px-4 py-8 sm:px-8 sm:py-10 md:px-12"
        style={{
          paddingTop: "max(2rem, env(safe-area-inset-top))",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <div className="mx-auto w-full max-w-md">
          <div className="mb-7 lg:hidden">
            <Link
              href="/"
              className="focus-ring -my-2 inline-flex min-h-11 items-center text-title-sm font-medium tracking-[-0.02em] text-text-strong"
            >
              Stoicverse
            </Link>
          </div>

          <div className="settle rounded-lg border border-border-hairline bg-surface-panel p-6 sm:p-8 md:p-10">
            <h1 className="text-title-md font-medium text-text-strong">{copy.heading}</h1>
            <p className="mt-2 text-content-sm text-text-muted">Review your order, then continue to payment.</p>

            {cancelled && (
              <p
                role="status"
                className="mt-6 rounded-lg border border-border-hairline bg-surface-raised p-4 text-content-sm text-text-default"
              >
                Payment was cancelled and you have not been charged. You can start again whenever you are ready.
              </p>
            )}

            {/* The term choice. One plan renders no chooser — a radio group with
                a single option is a control that cannot be operated. */}
            {plans.length > 1 && (
              <fieldset className="mt-7">
                <legend className="font-mono text-mono-xs tracking-widest text-text-faint uppercase">Billing term</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {plans.map((entry) => {
                    const active = entry.plan === offer?.plan;
                    return (
                      <label
                        key={entry.plan ?? "single"}
                        className={`flex min-h-11 cursor-pointer items-baseline justify-between gap-3 rounded-lg border p-3 transition-colors focus-within:border-primary ${
                          active ? "border-primary bg-surface-raised" : "border-border-hairline hover:border-border-strong"
                        }`}
                      >
                        <span className="flex items-baseline gap-2">
                          <input
                            type="radio"
                            name="plan"
                            value={entry.plan ?? ""}
                            checked={active}
                            onChange={() => setSelected(entry.plan)}
                            className="sr-only"
                          />
                          <span className={`text-content-sm font-medium ${active ? "text-text-strong" : "text-text-default"}`}>
                            {entry.plan ? PLAN_LABEL[entry.plan] : copy.name}
                          </span>
                        </span>
                        {entry.amount && (
                          <span className="font-mono text-mono-sm tabular-nums text-text-strong">{entry.amount}</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="mt-7 flex items-baseline justify-between gap-4 border-b border-border-hairline pb-5">
              <span className="text-content-base text-text-default">{copy.name}</span>
              {offer?.amount ? (
                <span className="font-mono text-title-sm tabular-nums text-text-strong">{offer.amount}</span>
              ) : (
                <span className="text-content-sm text-text-muted">Confirmed at payment</span>
              )}
            </div>

            <dl className="mt-5 space-y-3 text-content-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-text-muted">Due today</dt>
                <dd className="font-mono tabular-nums text-text-strong">{offer?.amount ?? "—"}</dd>
              </div>
              {offer && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-text-muted">Access</dt>
                  <dd className="text-text-default">{offer.cadence}</dd>
                </div>
              )}
              {email && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="shrink-0 text-text-muted">Account</dt>
                  <dd className="truncate text-text-default" title={email}>
                    {email}
                  </dd>
                </div>
              )}
            </dl>

            {(error || unavailable) && (
              <div
                ref={errorRef}
                role="alert"
                tabIndex={-1}
                className="focus-ring mt-6 flex gap-3 rounded-lg border border-status-danger/40 bg-status-danger/10 p-4"
              >
                <CircleAlert size={17} className="mt-0.5 shrink-0 text-status-danger" />
                <p className="text-content-sm text-status-danger">
                  {error ?? "Payment is not available right now. Nothing has been charged — please try again later."}
                </p>
              </div>
            )}

            <Button size="lg" onClick={startCheckout} disabled={loading || unavailable} className="mt-7 w-full">
              {loading ? (
                <>
                  <LoaderCircle size={16} className="animate-spin" />
                  Opening secure checkout…
                </>
              ) : (
                <>
                  Continue to secure payment
                  <ArrowRight size={16} />
                </>
              )}
            </Button>

            {/* Says plainly why this page has no card fields. */}
            <p className="mt-5 flex gap-2.5 text-content-sm text-text-muted">
              <Lock size={14} className="mt-0.5 shrink-0" />
              <span>
                You enter your card on Stripe&rsquo;s secure payment page. Stoicverse never sees or stores your card
                details. The final amount and billing terms are confirmed there before you pay.
              </span>
            </p>
          </div>

          {/* Phones never see the rail, so the same detail follows the summary. */}
          <div className="mt-8 lg:hidden">
            <h2 className="text-content-sm font-medium text-text-strong">What this unlocks</h2>
            <div className="mt-5">{includes}</div>
          </div>

          <div className="mt-6 flex justify-center">
            <Link
              href="/"
              className="focus-ring inline-flex min-h-11 items-center rounded-lg px-4 text-content-sm text-text-muted transition-colors hover:text-text-strong"
            >
              Back to Stoicverse
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
