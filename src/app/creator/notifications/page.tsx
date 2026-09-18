import { renderNotifications } from "@/app/dashboard/notifications/page";

/**
 * The creator's notifications.
 *
 * Was a `WorkspacePage` title card with no list, while the rail pointed every
 * role at `/dashboard/notifications` — which `proxy.ts` refuses an influencer,
 * so this screen was both empty and the only one they could reach. The same
 * renderer behind the influencer guard, as `/creator/account` does.
 */
export default async function CreatorNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  return renderNotifications({ searchParams, creatorWorkspace: true });
}
