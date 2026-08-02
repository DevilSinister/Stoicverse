"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Check, CircleAlert, LoaderCircle, Lock, MessageSquare } from "lucide-react";

/**
 * Checkout hands off to Stripe Checkout: /api/checkout creates a session and
 * returns its URL. Card details are entered on Stripe's page, never here.
 *
 * The previous version rendered card number, expiry, CVC and billing address
 * inputs that were never read or transmitted — the user typed a PAN into this
 * origin and then typed it again on Stripe. That is removed deliberately: it
 * misrepresented what the button does, and cardholder data must not touch a
 * page that is not PCI-scoped.
 */

type Product = "membership" | "mentorship";

const OFFERS: Record<Product, { name: string; amount: string; blurb: string; includes: { icon: "check" | "chat" | "calendar"; title: string; detail: string }[] }> = {
  membership: {
    name: "Community Membership",
    amount: "$10",
    blurb: "The complete operating surface for disciplined study, feedback, and community reflection.",
    includes: [
      { icon: "check", title: "Full curriculum access", detail: "All four stages of Stoic practice, with video lessons and progress tracking." },
      { icon: "chat", title: "Community channels", detail: "Study daily with other practitioners inside curated spaces." },
      { icon: "calendar", title: "Live monthly workshops", detail: "Gated video sessions, reflection rooms, and live lectures." },
    ],
  },
  mentorship: {
    name: "Private Mentorship",
    amount: "$1,000",
    blurb: "Dedicated one-to-one review and private reflection slots with a Master Stoic.",
    includes: [
      { icon: "check", title: "1-on-1 private log review", detail: "Direct feedback on your daily journals from an experienced mentor." },
      { icon: "calendar", title: "Bi-weekly private calls", detail: "Two 60-minute video reflection calls per month to calibrate your practice." },
      { icon: "check", title: "Custom curriculum plan", detail: "A tailored reading and exercise path targeting your specific hurdles." },
    ],
  },
};

function IncludeIcon({ kind }: { kind: "check" | "chat" | "calendar" }) {
  const className = "mt-0.5 size-[17px] shrink-0 text-primary-container";
  if (kind === "chat") return <MessageSquare className={className} />;
  if (kind === "calendar") return <CalendarDays className={className} />;
  return <Check className={className} />;
}

export function CheckoutScreen({
  product = "membership",
  email,
  cancelled = false,
}: {
  product?: Product;
  email?: string;
  cancelled?: boolean;
}) {
  const offer = OFFERS[product];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const startCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product }),
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
      {offer.includes.map((item) => (
        <li key={item.title} className="flex gap-3">
          <IncludeIcon kind={item.icon} />
          {/* Labels, not headings: this list appears in both the rail and the
              mobile block, and heading-level items there would float without a
              parent on desktop. */}
          <div>
            <p className="text-sm font-semibold text-white">{item.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{item.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="min-h-[100svh] bg-surface text-on-surface lg:grid lg:min-h-screen lg:grid-cols-[1fr_34rem]">
      {/* Context rail */}
      <section className="relative hidden overflow-hidden border-r border-surgical-steel bg-surface-container-low p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_75%_60%_at_20%_0%,#000,transparent_75%)]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-surgical-steel) 1px, transparent 1px), linear-gradient(90deg, var(--color-surgical-steel) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        <Link href="/" className="focus-ring relative z-10 inline-flex text-lg font-bold tracking-[-0.02em] text-white">
          Stoicverse
        </Link>

        {/* Deliberately a <p>, not a heading: the page's h1 lives in the summary
            column so phones — which never render this rail — still have one. */}
        <div className="relative z-10 my-auto max-w-lg py-10">
          <p className="text-balance text-[clamp(1.75rem,2.4vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.025em] text-white">
            Everything the practice needs, in one place.
          </p>
          <p className="mt-4 max-w-[54ch] leading-relaxed text-on-surface-variant">{offer.blurb}</p>
          <div className="mt-10">{includes}</div>
        </div>

        <p className="relative z-10 max-w-xs text-sm leading-relaxed text-fog-muted">
          A quiet place to study, practice, and build a more deliberate life.
        </p>
      </section>

      {/* Order summary */}
      <section
        className="flex flex-col justify-center bg-surface px-4 py-8 sm:px-8 sm:py-10 md:px-12"
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
              className="focus-ring -my-2 inline-flex min-h-11 items-center text-lg font-bold tracking-[-0.02em] text-white"
            >
              Stoicverse
            </Link>
          </div>

          <div className="settle rounded-2xl border border-surgical-steel bg-monolith-surface p-6 sm:p-8 md:p-10">
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-white">
              {product === "mentorship" ? "Secure your mentorship" : "Activate your membership"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              Review your order, then continue to payment.
            </p>

            {cancelled && (
              <p
                role="status"
                className="mt-6 rounded-lg border border-surgical-steel bg-surface-container-high/60 p-4 text-sm leading-relaxed text-on-surface-variant"
              >
                Payment was cancelled and you have not been charged. You can start again whenever you are ready.
              </p>
            )}

            <div className="mt-7 flex items-baseline justify-between gap-4 border-b border-surgical-steel pb-5">
              <span className="font-medium text-on-surface">{offer.name}</span>
              <span className="text-2xl font-bold tabular-nums tracking-[-0.02em] text-white">{offer.amount}</span>
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-fog-muted">Due today</dt>
                <dd className="font-semibold tabular-nums text-white">{offer.amount}</dd>
              </div>
              {email && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="shrink-0 text-fog-muted">Account</dt>
                  <dd className="truncate text-on-surface-variant" title={email}>
                    {email}
                  </dd>
                </div>
              )}
            </dl>

            {error && (
              <div
                ref={errorRef}
                role="alert"
                tabIndex={-1}
                className="focus-ring mt-6 flex gap-3 rounded-lg border border-error/40 bg-error/10 p-4"
              >
                <CircleAlert size={17} className="mt-0.5 shrink-0 text-error" />
                <p className="text-sm leading-relaxed text-error">{error}</p>
              </div>
            )}

            <button
              type="button"
              onClick={startCheckout}
              disabled={loading}
              className="focus-ring emerald-glow mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-container px-6 text-[15px] font-semibold text-on-primary-fixed transition duration-150 hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
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
            </button>

            {/* Says plainly why this page has no card fields. */}
            <p className="mt-5 flex gap-2.5 text-xs leading-relaxed text-fog-muted">
              <Lock size={14} className="mt-0.5 shrink-0" />
              <span>
                You enter your card on Stripe&rsquo;s secure payment page. Stoicverse never sees or stores your card
                details. The final amount and billing terms are confirmed there before you pay.
              </span>
            </p>
          </div>

          {/* Phones never see the rail, so the same detail follows the summary. */}
          <div className="mt-8 lg:hidden">
            <h2 className="text-sm font-semibold text-white">What this unlocks</h2>
            <div className="mt-5">{includes}</div>
          </div>

          <div className="mt-6 flex justify-center">
            <Link
              href="/"
              className="focus-ring inline-flex min-h-11 items-center rounded-full px-4 text-sm text-fog-muted transition hover:text-primary-container"
            >
              Back to Stoicverse
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
