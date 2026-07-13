import { renderCommunityPage } from "@/app/community/page";

export default async function CreatorCommunityPage() {
  return renderCommunityPage({ nextPath: "/creator/community", routeBase: "/creator", creatorWorkspace: true });
}
