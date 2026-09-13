import { AppShell } from "@/components/layout/AppShell";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { requireActiveMembership, requireInfluencerWorkspace } from "@/lib/supabase/access";
import { profileRow } from "@/lib/supabase/viewer";

/**
 * One notification centre behind two guards.
 *
 * The creator's copy of this screen was a `WorkspacePage` title card with no
 * list, on the reasoning that both roles could read the member one - but
 * `proxy.ts` bounces an influencer off every `/dashboard` route, so the rail's
 * Notifications entry sent a creator to `/creator` and their notifications were
 * unreachable from anywhere in the product.
 *
 * Nothing had to be built to fix it. `/api/dashboard/notifications` filters on
 * `user_id` and asks only for a signed-in user, so it always served both roles;
 * what was missing was a page to render it on. Same renderer behind the other
 * guard, the way `/creator/account` already reuses `/dashboard/settings`.
 */
export async function renderNotifications({
  searchParams,
  creatorWorkspace = false,
}: {
  searchParams: Promise<{ view?: string }>;
  creatorWorkspace?: boolean;
}) {
  const routeBase = creatorWorkspace ? "/creator" : "/dashboard";
  await (creatorWorkspace
    ? requireInfluencerWorkspace("/creator/notifications")
    : requireActiveMembership("/dashboard/notifications"));

  const [{ data: profile }, params] = await Promise.all([profileRow(), searchParams]);

  return (
    <AppShell
      active="Notifications"
      title="Notifications"
      terminalHeader
      routeBase={routeBase}
      memberName={profile?.full_name?.trim() || "Practitioner"}
      platformRole={profile?.platform_role ?? "member"}
    >
      <NotificationCenter initialView={params.view} basePath={`${routeBase}/notifications`} />
    </AppShell>
  );
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  return renderNotifications({ searchParams });
}
