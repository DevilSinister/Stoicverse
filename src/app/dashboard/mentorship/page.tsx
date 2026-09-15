import { renderMentorshipPage } from "@/app/mentorship/page";

/**
 * Mentorship inside the member workspace.
 *
 * The dashboard's "Explore mentorship" call to action has always linked to
 * `withRouteBase(routeBase, "/mentorship")`, which on `/dashboard` resolves to
 * `/dashboard/mentorship` — a route that did not exist. The most prominent
 * panel on the member's home screen answered with a 404, and phase 7 recoloured
 * its button without anyone pressing it.
 *
 * Routing it here rather than pointing the link at the root `/mentorship` keeps
 * the reader inside the workspace they are in, which is what `routeBase` is for
 * everywhere else in the product.
 */
export default function DashboardMentorshipPage() {
  return renderMentorshipPage({ nextPath: "/dashboard/mentorship", routeBase: "/dashboard" });
}
