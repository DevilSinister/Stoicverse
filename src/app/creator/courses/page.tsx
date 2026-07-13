import { renderCoursesPage } from "@/app/courses/page";

export default async function CreatorCoursesPage() {
  return renderCoursesPage({ nextPath: "/creator/courses", routeBase: "/creator", creatorWorkspace: true });
}
