import { renderAccountSettings } from "@/app/dashboard/settings/page";

/**
 * The creator's own account — profile, notifications, sessions, sign out.
 *
 * Until the rail there was no such route, and the omission was not cosmetic:
 * `buildAppNav`'s creator list carried no account entry, the one gear it did
 * carry opened *community* settings, and `proxy.ts` bounces an influencer off
 * `/dashboard/settings`. The only `logoutAction` in the product lives on that
 * page, so the creator could not sign out of their own product from inside it.
 *
 * The same renderer behind the other guard, rather than a second copy — a
 * duplicated page is what phase 9 spent its time deleting.
 */
export default async function CreatorAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; returnTo?: string }>;
}) {
  return renderAccountSettings({ searchParams, creatorWorkspace: true });
}
