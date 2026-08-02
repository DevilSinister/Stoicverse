import { renderEventsPage } from "@/app/events/EventsDirectoryPage";

export default function DashboardEventsPage() {
  return renderEventsPage({ nextPath: "/dashboard/events", routeBase: "/dashboard" });
}
