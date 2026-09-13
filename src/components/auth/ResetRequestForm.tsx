"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { useSearchParams } from "next/navigation";

import { requestPasswordResetAction } from "@/app/auth/actions";
import { AuthHeading, AuthShell, MailGlyph } from "@/components/auth/AuthShell";
import { ErrorNote, SubmitButton, TextField } from "@/components/auth/AuthFields";

/**
 * Ask for a reset link.
 *
 * Two states, one route. `?sent=1` is the acknowledgement, and it is the same
 * acknowledgement whether or not the address matched an account - the action
 * redirects here on every path, including the rate-limited one. A form that
 * says "no account with that email" answers, to anybody who asks, whether a
 * given person is a member here.
 *
 * That is also why the sent state names no address: there is nothing to name,
 * because this screen was never told whether there was one.
 */
export function ResetRequestForm() {
  const searchParams = useSearchParams();
  const sent = searchParams.get("sent") === "1";
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, {});
  const id = useId();

  if (sent) {
    return (
      <AuthShell>
        <MailGlyph />
        <div className="mt-content-gap">
          <AuthHeading title="Check your inbox" />
        </div>
        <p className="mt-3 text-content-base text-text-default">
          If an account uses that address, a reset link is on its way to it.
        </p>
        <p className="mt-content-gap text-content-sm text-text-muted">
          The link works once and expires after an hour. Asking again replaces the previous one.
        </p>
        <Link
          href="/login"
          className="focus-ring mt-content-y flex h-11 w-full items-center justify-center rounded-lg border border-border-strong text-content-sm font-medium text-text-default transition-colors hover:bg-surface-raised hover:text-text-strong"
        >
          Back to log in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthHeading title="Reset your password">
        Enter the address on your account and we will send a link to set a new password.
      </AuthHeading>

      <form action={formAction}>
        <div className="mt-content-y">
          <TextField
            id={`${id}-email`}
            name="email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            invalid={Boolean(state.error)}
          />
        </div>

        {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

        <SubmitButton pending={pending} pendingLabel="Sending…">
          Send the link
        </SubmitButton>
      </form>

      <Link
        href="/login"
        className="focus-ring mt-chrome-gap flex h-11 w-full items-center justify-center rounded-lg border border-border-strong text-content-sm font-medium text-text-default transition-colors hover:bg-surface-raised hover:text-text-strong"
      >
        Back to log in
      </Link>
    </AuthShell>
  );
}
