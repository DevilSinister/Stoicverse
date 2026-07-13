import { renderLessonPage } from "@/app/courses/lesson/[id]/page";

export default async function CreatorLessonPage({ params }: { params: Promise<{ id: string }> }) {
  return renderLessonPage({ params, nextPathBase: "/creator/courses/lesson", routeBase: "/creator", creatorWorkspace: true });
}
