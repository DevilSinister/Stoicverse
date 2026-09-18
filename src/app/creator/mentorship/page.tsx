import { renderMentorshipPage } from "@/app/mentorship/page";

/**
 * The creator's own mentorship page.
 *
 * It used to be a second copy of the member page's four queries, its mentor-name
 * unwrapping and its whole prop list — which is how it came to be the only one
 * of the two that could not show a price. `renderMentorshipPage` already takes
 * the workspace guard as an option, so there is one implementation now.
 */
export default function CreatorMentorshipPage() {
  return renderMentorshipPage({
    nextPath: "/creator/mentorship",
    routeBase: "/creator",
    creatorWorkspace: true,
  });
}
