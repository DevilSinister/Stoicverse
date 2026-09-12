import { permanentRedirect } from "next/navigation";

/**
 * The creator read the same conversation as everybody else through a separate
 * copy of the workspace until phase 9. `/channels` serves both — the
 * permissions resolver already decides what a creator may do there — so this
 * route is a permanent redirect rather than a second surface to maintain.
 */
export default function CreatorCommunityPage() {
  permanentRedirect("/channels");
}
