import { renderCommunityPage } from "@/app/community/page";

export default function DashboardCommunityPage() {
  return renderCommunityPage({ nextPath: "/dashboard/community", routeBase: "/dashboard" });
}
