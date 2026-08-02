import { renderCourseDetailPage } from "@/app/courses/[id]/CourseDetailPage";

export default async function DashboardCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return renderCourseDetailPage({ id, routeBase: "/dashboard" });
}
