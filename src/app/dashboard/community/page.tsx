import { permanentRedirect } from "next/navigation";

/**
 * The member community lives at `/channels` since P1.
 *
 * This route rendered the legacy workspace until phase 9. It is kept as a
 * permanent redirect rather than deleted because it is the href in every
 * notification `action_url` written before the rebuild, and in whatever the
 * owner has bookmarked.
 */
export default function DashboardCommunityPage() {
  permanentRedirect("/channels");
}
