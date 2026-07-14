import { WorkspacePage } from "@/components/workspace/WorkspacePage";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorSettingsPage() {
  await requireInfluencerWorkspace("/creator/settings");
  return <WorkspacePage workspace="/creator" active="Settings" title="Community settings" description="Configure your community and creator account settings." />;
}
