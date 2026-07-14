import { renderEventsPage } from "@/app/events/page";

export default function DashboardEventsPage() {
  return renderEventsPage({ nextPath: "/dashboard/events", routeBase: "/dashboard" });
}
