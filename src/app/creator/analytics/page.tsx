import { WorkspacePage } from "@/components/workspace/WorkspacePage";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorAnalyticsPage() {
  await requireInfluencerWorkspace("/creator/analytics");
  return <WorkspacePage workspace="/creator" active="Analytics" title="Community analytics" description="Track community growth, course performance, event engagement, and recent activity." />;
}
