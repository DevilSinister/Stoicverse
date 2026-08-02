import { renderCommunityWorkspace } from "@/components/community/CommunityWorkspace";

export default async function CreatorCommunityPage({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  return renderCommunityWorkspace({ nextPath: "/creator/community", workspace: "creator", selectedChannelId: (await searchParams).channel });
}

