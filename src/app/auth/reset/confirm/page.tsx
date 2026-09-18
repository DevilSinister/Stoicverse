import Link from "next/link";

import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import { SetPasswordForm } from "@/components/auth/SetPasswordForm";
import { currentViewer } from "@/lib/supabase/viewer";

export const metadata = { title: "Set a new password" };

/**
 * The second half of a password reset.
 *
 * Reached from the emailed link through `/auth/callback`, which exchanges the
 * code for a session - so by the time this renders, control of the mailbox has
 * already been proven and there is a viewer to read.
 *
 * Arriving without one is the expired-or-reused case. It is answered here
 * rather than redirected, because a bounce to /login with a generic notice is
 * how somebody with a day-old link ends up believing their account is gone.
 */
export default async function ResetConfirmPage() {
  const viewer = await currentViewer();

  if (!viewer) {
    return (
      <AuthShell>
        <AuthHeading title="That link has expired">
          A reset link works once, and only for an hour. Ask for a new one and it will replace it.
        </AuthHeading>
        <Link
          href="/auth/reset"
          className="focus-ring mt-content-y flex h-11 w-full items-center justify-center rounded-lg bg-primary text-content-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
        >
          Send a new link
        </Link>
        <Link
          href="/login"
          className="focus-ring mt-chrome-gap flex h-11 w-full items-center justify-center rounded-lg border border-border-strong text-content-sm font-medium text-text-default transition-colors hover:bg-surface-raised hover:text-text-strong"
        >
          Back to log in
        </Link>
      </AuthShell>
    );
  }

  return <SetPasswordForm email={viewer.email} />;
}
