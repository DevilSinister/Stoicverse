"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { acceptRules } from "@/app/community/actions";
import { useCommunity } from "@/components/channels/CommunityProvider";
import { useToast } from "@/components/ui/toast";

/**
 * What stands where the composer would be when the rules have not been
 * accepted.
 *
 * The other soft gates are sentences, because waiting and a lockdown are not
 * things anybody can act on. This one is the exception: the member is one
 * press away from posting, so the press is here rather than somewhere they
 * have to be told how to find.
 *
 * The version is not passed to the server. `community_accept_rules` reads the
 * current one itself, so a page left open while the rules were republished
 * cannot accept the version it happens to remember.
 */
export function RulesGateNotice() {
  const { channels } = useCommunity();
  const notify = useToast();
  const [pending, start] = useTransition();

  const rulesChannel = channels.find((channel) => channel.type === "rules");

  const accept = () =>
    start(async () => {
      const result = await acceptRules();
      if (result.error) {
        notify(result.error);
        return;
      }
      notify("Thank you. You can post again.", "success");
    });

  return (
    <div className="border-t border-surgical-steel px-4 py-4 text-center">
      <p role="status" className="text-sm text-fog-muted">
        Read and accept the community rules before posting.
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {rulesChannel ? (
          <Link
            href={`/channels/${rulesChannel.id}`}
            className="focus-ring rounded-lg border border-surgical-steel px-3 py-1.5 text-xs text-on-surface-variant hover:text-on-surface"
          >
            {`Read them in #${rulesChannel.name}`}
          </Link>
        ) : null}
        <button
          type="button"
          onClick={accept}
          disabled={pending}
          className="focus-ring inline-flex items-center gap-2 rounded-lg bg-primary-container px-3 py-1.5 text-xs font-semibold text-monolith-surface disabled:opacity-50"
        >
          {pending ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : null}
          I accept the rules
        </button>
      </div>
    </div>
  );
}
