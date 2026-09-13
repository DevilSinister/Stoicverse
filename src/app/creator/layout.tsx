import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";
import { currentIsMaster, currentProfile, unreadNotificationCount, viewerName } from "@/lib/supabase/viewer";

/**
 * The creator workspace's chrome — rail, header, search, notifications.
 *
 * It lives here rather than inside each page, and that is the whole of the
 * fix. A layout is not re-rendered when you navigate between the routes
 * beneath it: React keeps the subtree mounted and swaps only the segment that
 * changed. So the rail stays on screen through a navigation instead of being
 * unmounted with the outgoing page, redrawn with the incoming one, and — until
 * now — replaced in between by a full-page skeleton with no rail in it at all.
 * The notification subscription the shell holds open stops being torn down and
 * re-established on every click for the same reason.
 *
 * The three reads are request-cached and every page below calls the same
 * guard, so a page pays nothing for asking again. The guard is repeated in the
 * pages deliberately: a layout is not an access boundary in the App Router,
 * because a client navigation can render a page without re-rendering the
 * layout above it.
 *
 * `active` and `title` are the shell's two legacy props. The rail derives the
 * first from the pathname and the header now derives its label from the rail,
 * which is what lets a layout frame a page whose title it cannot know.
 */
export default async function CreatorWorkspaceLayout({ children }: { children: ReactNode }) {
  await requireInfluencerWorkspace("/creator");
  const [profile, isMaster, unreadCount] = await Promise.all([
    currentProfile(),
    currentIsMaster(),
    unreadNotificationCount(),
  ]);

  return (
    <AppShell
      active=""
      title=""
      routeBase="/creator"
      platformRole="influencer"
      isMaster={isMaster}
      memberName={viewerName(profile, "Creator")}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
