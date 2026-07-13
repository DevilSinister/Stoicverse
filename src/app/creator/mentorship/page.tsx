import { renderMentorshipPage } from "@/app/mentorship/page";

export default async function CreatorMentorshipPage() {
  return renderMentorshipPage({ nextPath: "/creator/mentorship", routeBase: "/creator", creatorWorkspace: true });
}
