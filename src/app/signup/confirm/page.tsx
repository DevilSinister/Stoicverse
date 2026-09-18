import Link from "next/link";

import { takePendingEmail } from "@/app/auth/actions";
import { SIGNUP_ACK } from "@/lib/auth/policy";
import { AddressChip, AuthHeading, AuthShell, MailGlyph } from "@/components/auth/AuthShell";

export const metadata = { title: "Check your inbox" };

/**
 * Where signup lands.
 *
 * This used to be a panel that replaced the form in place, so it had no URL: a
 * reload lost it, the back button returned a cleared form, and nothing could
 * link anyone here. It is the same screen with an address of its own now.
 *
 * The address is read from an httpOnly cookie the signup action set, not from a
 * query parameter - `?email=` would write somebody's address into their history
 * and into every log between here and them. Arriving without one is a normal
 * state (a reload after fifteen minutes, or a direct visit), and the screen
 * says the useful half without it.
 */
export default async function SignupConfirmPage() {
  const email = await takePendingEmail();

  return (
    <AuthShell>
      <MailGlyph />
      <div className="mt-content-gap">
        <AuthHeading title="Check your inbox" />
      </div>

      {email ? (
        <>
          <p className="mt-3 text-content-base text-text-default">We sent a confirmation link to</p>
          <AddressChip email={email} />
          <p className="mt-content-gap text-content-sm text-text-muted">
            Open it to verify your account, then log in.
          </p>
        </>
      ) : (
        // SIGNUP_ACK already ends with "open it to verify your account, then
        // log in", so the sentence above is the named-address branch's only.
        <p className="mt-3 text-content-base text-text-default">{SIGNUP_ACK}</p>
      )}

      <p className="mt-3 text-content-sm text-text-muted">
        The link can take a minute to arrive — check your spam folder before asking for another.
      </p>

      <Link
        href="/login"
        className="focus-ring mt-content-y flex h-11 w-full items-center justify-center rounded-lg border border-border-strong text-content-sm font-medium text-text-default transition-colors hover:bg-surface-raised hover:text-text-strong"
      >
        Go to log in
      </Link>
    </AuthShell>
  );
}
