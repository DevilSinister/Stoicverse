import { renderCommunityWorkspace } from "@/components/community/CommunityWorkspace";

export default async function CreatorChannelsPage({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  return renderCommunityWorkspace({ nextPath: "/creator/channels", workspace: "creator", selectedChannelId: (await searchParams).channel });
}
