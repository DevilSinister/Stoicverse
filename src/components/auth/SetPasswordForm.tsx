"use client";

import { useActionState, useId, useState } from "react";

import { setPasswordAction } from "@/app/auth/actions";
import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import { ErrorNote, PasswordField, SubmitButton } from "@/components/auth/AuthFields";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/policy";

/**
 * Set the new password on the session the reset link established.
 *
 * One field, not two. A confirm-password box exists to catch a typo in
 * something you cannot see - and the show/hide control beside this one already
 * catches it, without asking anybody to type a password twice on a phone.
 *
 * No current-password field either: there is no current password in hand. What
 * stands in for it is control of the mailbox, which the link already proved.
 */
export function SetPasswordForm({ email }: { email: string | null }) {
  const [state, formAction, pending] = useActionState(setPasswordAction, {});
  const [password, setPassword] = useState("");
  const id = useId();

  return (
    <AuthShell>
      <AuthHeading title="Set a new password">
        {email ? (
          <>
            Signed in as <span className="font-mono text-mono-sm text-text-strong">{email}</span>. Choose something you
            have not used here before.
          </>
        ) : (
          "Choose something you have not used here before."
        )}
      </AuthHeading>

      <form action={formAction}>
        <input type="hidden" name="next" value="/dashboard" />

        <div className="mt-content-y">
          <PasswordField
            id={`${id}-password`}
            name="password"
            label="New password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
            invalid={Boolean(state.error)}
            value={password}
            onChange={setPassword}
          />
        </div>

        {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

        <SubmitButton pending={pending} pendingLabel="Saving…">
          Save and continue
        </SubmitButton>
      </form>

      <p className="mt-content-gap text-chrome-base text-text-faint">
        Saving signs you in and takes you to your dashboard.
      </p>
    </AuthShell>
  );
}
