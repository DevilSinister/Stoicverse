import { renderMasterPage } from "@/app/master/page";

/**
 * The creator's master feed.
 *
 * This was a copy of `renderMasterPage` with two different fallbacks until
 * phase 9. Both copies read `posts.image_url`, so the column could not be
 * dropped in one place and left in the other — which is how a duplicate
 * surface makes a cleanup cost twice what it should.
 */
export default async function CreatorMasterPage() {
  return renderMasterPage({
    nextPath: "/creator/master",
    routeBase: "/creator",
    creatorWorkspace: true,
    defaultPlatformRole: "influencer",
  });
}
