import { redirect } from "next/navigation";

export default async function VideoPage({
  params,
}: {
  params: Promise<{ id: string; videoId: string }>;
}) {
  const { id, videoId } = await params;
  redirect(`/dashboard/courses/${id}/video/${videoId}`);
}
