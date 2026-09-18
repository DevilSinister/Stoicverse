import Link from "next/link";

import { requireCommunityAccess } from "@/lib/supabase/access";

export const dynamic = "force-dynamic";

/**
 * Where a banned member lands.
 *
 * A ban is community-scoped: it does not touch `is_suspended` or the
 * membership, so the courses and events they paid for are still theirs. Saying
 * so here is the difference between "you were removed" and "you lost what you
 * bought".
 */
export default async function BlockedPage() {
  const { supabase } = await requireCommunityAccess("/channels");
  const { data } = await supabase.rpc("community_access_state");
  const state = ((data ?? []) as { state: string; reason: string | null }[])[0];

  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div className="max-w-md">
        <h1 className="text-title-sm font-medium text-text-strong">
          {state?.state === "banned" ? "You are banned from this community" : "You cannot post right now"}
        </h1>
        {state?.reason ? <p className="mt-2 text-content-sm text-text-default">{state.reason}</p> : null}
        <p className="mt-3 text-content-sm text-text-muted">
          Your courses, events and subscription are unaffected. This applies to the community only.
        </p>
        <Link
          href="/dashboard"
          className="focus-ring mt-4 inline-flex rounded-lg border border-border-hairline px-3 py-1.5 text-content-sm text-text-default hover:bg-surface-panel hover:text-text-strong"
        >
          Go to your dashboard
        </Link>
      </div>
    </div>
  );
}
