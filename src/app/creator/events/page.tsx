import { renderEventsPage } from "@/app/events/page";

export default async function CreatorEventsPage() {
  return renderEventsPage({ nextPath: "/creator/events", routeBase: "/creator", creatorWorkspace: true });
}
