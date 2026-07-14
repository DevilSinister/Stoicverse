import { renderVideoPage } from "@/app/courses/[id]/video/[videoId]/VideoPage";

export default async function DashboardVideoPage({
  params,
}: {
  params: Promise<{ id: string; videoId: string }>;
}) {
  const { id, videoId } = await params;
  return renderVideoPage({ id, videoId, routeBase: "/dashboard" });
}
