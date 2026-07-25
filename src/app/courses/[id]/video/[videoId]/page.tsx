import { renderVideoPage } from "./VideoPage";

export default async function VideoPage({
  params,
}: {
  params: Promise<{ id: string; videoId: string }>;
}) {
  const { id, videoId } = await params;
  return renderVideoPage({ id, videoId });
}
