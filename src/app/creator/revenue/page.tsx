import { WorkspacePage } from "@/components/workspace/WorkspacePage";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorRevenuePage() {
  await requireInfluencerWorkspace("/creator/revenue");
  return <WorkspacePage workspace="/creator" active="Revenue" title="Revenue" description="Monitor community revenue, recent sales, and membership performance." />;
}
