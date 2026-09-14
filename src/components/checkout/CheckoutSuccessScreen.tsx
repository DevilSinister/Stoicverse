"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";

import { confirmAccess } from "@/app/checkout/success/actions";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/checkout/plans";

/**
 * Where Stripe returns to after a successful payment.
 *
 * It used to return to `/dashboard?checkout=success`. Two things were wrong with
 * that, and the second one is a defect a paying customer feels.
 *
 * **Nothing read the parameter.** A payment was acknowledged by the product
 * with silence.
 *
 * **`/dashboard` is behind `requireActiveMembership`, and the membership is
 * granted by a webhook.** Stripe redirects the browser the moment the card
 * clears; the webhook is a separate request that can arrive after it. When it
 * did, the guard found no membership and sent the person who had just paid to
 * `/checkout` — the buy page — with no explanation.
 *
 * So this route is signed-in-only and deliberately *not* behind the membership
 * guard: it is the one page that has to be reachable in the seconds between
 * paying and being let in. It waits, says it is waiting, and moves on only once
 * the grant is actually visible. If the wait runs out it says that too, rather
 * than forwarding into the guard and reproducing the original bounce.
 */

const POLL_MS = 2000;
const ATTEMPTS = 15; // ~30 seconds, then the screen stops guessing and says so.

const DESTINATION: Record<Product, { href: string; label: string }> = {
  membership: { href: "/dashboard", label: "Go to your dashboard" },
  mentorship: { href: "/mentorship", label: "Go to your mentorship" },
};

export function CheckoutSuccessScreen({
  product,
  granted,
  name,
}: {
  product: Product;
  /** Whether the webhook had already landed by first render. */
  granted: boolean;
  name: string;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(granted);
  const [exhausted, setExhausted] = useState(false);
  const destination = DESTINATION[product];

  useEffect(() => {
    if (ready) return;
    let attempts = 0;
    let cancelled = false;

    const timer = setInterval(async () => {
      attempts += 1;
      const confirmed = await confirmAccess(product);
      if (cancelled) return;
      if (confirmed) {
        setReady(true);
        clearInterval(timer);
        return;
      }
      if (attempts >= ATTEMPTS) {
        setExhausted(true);
        clearInterval(timer);
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [product, ready]);

  useEffect(() => {
    // The guards read the session server-side, so the destination has to be
    // re-fetched rather than navigated to from a stale client cache.
    if (ready) router.refresh();
  }, [ready, router]);

  return (
    <main className="grid min-h-[100svh] place-items-center bg-surface-canvas px-4 py-10 text-text-default">
      <section className="settle w-full max-w-xl rounded-lg border border-border-hairline bg-surface-panel p-6 sm:p-10">
        <span
          aria-hidden
          className={`grid size-10 place-items-center rounded-lg border ${
            // `text-primary`, not `text-accent`: the token layer points shadcn's
            // --accent at --surface-raised, so the confirmed tick renders dark
            // grey on a dark panel. --accent-soft *is* the brand accent at 12%.
            ready ? "border-primary/40 bg-accent-soft text-primary" : "border-border-hairline bg-surface-raised text-text-muted"
          }`}
        >
          {ready ? <Check size={19} /> : <LoaderCircle size={19} className="animate-spin" />}
        </span>

        <h1 className="mt-6 text-title-lg font-medium text-text-strong">
          {ready ? "Payment confirmed" : "Payment received"}
        </h1>

        <p className="mt-4 max-w-[60ch] text-content-base text-text-default">
          {ready
            ? `Thank you, ${name}. ${
                product === "mentorship"
                  ? "Your mentorship is active and your mentor will be in touch to arrange the first call."
                  : "Your membership is active. The curriculum, the community and the events are open to you."
              }`
            : `Thank you, ${name}. Your card has been charged and we are activating your access now — this usually takes a few seconds.`}
        </p>

        {!ready && !exhausted && (
          <p role="status" className="mt-6 flex items-center gap-2.5 text-content-sm text-text-muted">
            <LoaderCircle size={15} className="animate-spin" />
            Waiting for confirmation from our payment provider…
          </p>
        )}

        {exhausted && (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-status-warn/40 bg-status-warn/10 p-4 text-content-sm text-status-warn"
          >
            Your payment went through, but activation is taking longer than usual. Nothing is lost and you will not be
            charged again. Reload this page in a minute, or contact support with your payment receipt if it persists.
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 border-t border-border-hairline pt-6 sm:flex-row sm:items-center">
          <Button size="lg" disabled={!ready} onClick={() => router.push(destination.href)}>
            {destination.label}
            <ArrowRight size={16} />
          </Button>
          <Link
            href="/"
            className="focus-ring inline-flex min-h-11 items-center rounded-lg px-4 text-content-sm text-text-muted transition-colors hover:text-text-strong"
          >
            Back to Stoicverse
          </Link>
        </div>

        <p className="mt-6 text-content-sm text-text-muted">
          A receipt is on its way to the address on your account. Membership is a one-time payment for the term you
          chose; it does not renew on its own.
        </p>
      </section>
    </main>
  );
}
