import { renderMasterPage } from "@/app/master/page";

export default async function CreatorMasterPage() {
  return renderMasterPage({ nextPath: "/creator/master", routeBase: "/creator", creatorWorkspace: true, deniedRedirectPath: "/creator/dashboard" });
}
