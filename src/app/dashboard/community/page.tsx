import { renderCommunityWorkspace } from "@/components/community/CommunityWorkspace";

export default async function DashboardCommunityPage({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  return renderCommunityWorkspace({ nextPath: "/dashboard/community", workspace: "member", selectedChannelId: (await searchParams).channel });
}
