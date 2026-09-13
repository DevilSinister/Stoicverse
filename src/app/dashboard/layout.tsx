import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { requireActiveMembership } from "@/lib/supabase/access";
import { currentIsMaster, currentProfile, unreadNotificationCount, viewerName } from "@/lib/supabase/viewer";

/**
 * The member workspace's chrome. The creator layout's twin — see it for why
 * the shell belongs to the layout rather than to each page.
 *
 * `requireActiveMembership` is the same guard every page below already runs,
 * so an influencer arriving here is still sent to /creator and somebody
 * without a membership to /checkout. Running it in the layout as well means
 * that decision is made before the chrome paints rather than after.
 */
export default async function MemberWorkspaceLayout({ children }: { children: ReactNode }) {
  await requireActiveMembership("/dashboard");
  const [profile, isMaster, unreadCount] = await Promise.all([
    currentProfile(),
    currentIsMaster(),
    unreadNotificationCount(),
  ]);

  return (
    <AppShell
      active=""
      title=""
      routeBase="/dashboard"
      platformRole={profile?.platformRole ?? "member"}
      isMaster={isMaster}
      memberName={viewerName(profile)}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
