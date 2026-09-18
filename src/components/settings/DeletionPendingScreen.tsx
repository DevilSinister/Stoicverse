"use client";

import { useActionState } from "react";
import { CalendarClock, LoaderCircle, LogOut, RotateCcw, ShieldAlert } from "lucide-react";

import { cancelAccountDeletion, logoutAction } from "@/app/dashboard/settings/actions";
import { EMPTY_SETTINGS_ACTION_STATE } from "@/app/dashboard/settings/types";
import { Button } from "@/components/ui/button";

/**
 * The screen a member sees for as long as their account is scheduled for
 * deletion — the only thing they can reach, because `requireActiveMembership`
 * redirects here while a request is open.
 *
 * Two decisions are load-bearing and easy to undo by accident.
 *
 * **Cancel is the primary action and log out is not a danger control.** Ending
 * up here is usually a change of mind, and the destructive thing has already
 * been scheduled; the button that undoes it should be the obvious one.
 *
 * **`failed` is a distinct state, not an error to hide.** A deletion that could
 * not complete leaves the data locked and intact, and saying only "scheduled"
 * would be false — but so would offering Cancel, because the request is no
 * longer in a state this screen can withdraw.
 */
export function DeletionPendingScreen({
  name,
  scheduledAt,
  status,
}: {
  name: string;
  /** ISO-8601 from `account_deletion_requests.scheduled_at`. */
  scheduledAt: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(cancelAccountDeletion, EMPTY_SETTINGS_ACTION_STATE);
  const canCancel = status === "pending";

  return (
    <main className="grid min-h-[100svh] place-items-center bg-surface-canvas px-4 py-10 text-text-default">
      <section className="settle w-full max-w-2xl overflow-hidden rounded-lg border border-border-hairline bg-surface-panel">
        <div className="flex items-center gap-3 border-b border-border-hairline bg-surface-raised px-6 py-4 sm:px-8">
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-status-danger/40 bg-status-danger/10 text-status-danger"
          >
            <ShieldAlert size={19} />
          </span>
          <div>
            <p className="text-content-sm font-medium text-text-strong">Stoicverse account</p>
            <p className="font-mono text-mono-xs tracking-widest text-text-faint uppercase">Deletion recovery</p>
          </div>
        </div>

        <div className="px-6 py-8 sm:px-8 sm:py-10">
          <h1 className="text-title-lg font-medium text-text-strong">Your account is scheduled for deletion</h1>
          <p className="mt-4 max-w-[60ch] text-content-base text-text-default">
            {name}, dashboard access is locked while this request is active. Your account will be permanently removed
            after the recovery window unless you cancel.
          </p>

          <div className="mt-7 flex items-start gap-4 border-y border-border-hairline py-5">
            <CalendarClock size={20} className="mt-0.5 shrink-0 text-text-muted" />
            <div>
              <p className="text-content-sm font-medium text-text-strong">Scheduled deletion</p>
              <p className="mt-1 font-mono text-mono-sm text-text-default">
                {new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(
                  new Date(scheduledAt),
                )}
              </p>
            </div>
          </div>

          {status === "failed" && (
            <p
              role="alert"
              className="mt-6 rounded-lg border border-status-danger/40 bg-status-danger/10 p-4 text-content-sm text-status-danger"
            >
              Automatic deletion needs administrator attention. Your data remains locked and intact; contact support for
              recovery or completion.
            </p>
          )}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {canCancel && (
              <form action={action}>
                <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
                  {pending ? <LoaderCircle size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                  Cancel deletion
                </Button>
              </form>
            )}
            <form action={logoutAction}>
              <Button type="submit" size="lg" variant="outline" className="w-full sm:w-auto">
                <LogOut size={16} />
                Log out
              </Button>
            </form>
          </div>

          {state.error && (
            <p role="alert" className="mt-4 text-content-sm text-status-danger">
              {state.error}
            </p>
          )}

          <p className="mt-7 max-w-[68ch] text-content-sm text-text-muted">
            If deletion completes, community discussions are preserved under &ldquo;Deleted member&rdquo; while personal
            profile and learning records are removed.
          </p>
        </div>
      </section>
    </main>
  );
}
