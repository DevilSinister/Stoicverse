import { renderCommunityPage } from "@/app/community/page";

export default async function CreatorPage() {
  return renderCommunityPage({ nextPath: "/creator", routeBase: "/creator", creatorWorkspace: true });
}
