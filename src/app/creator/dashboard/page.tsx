import { renderDashboardPage } from "@/app/dashboard/page";

export default async function CreatorDashboardPage() {
  return renderDashboardPage({ nextPath: "/creator/dashboard", routeBase: "/creator", creatorWorkspace: true });
}
