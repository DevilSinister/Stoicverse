import { renderCoursesPage } from "@/app/courses/page";

export default function DashboardCoursesPage() {
  return renderCoursesPage({ nextPath: "/dashboard/courses", routeBase: "/dashboard" });
}
