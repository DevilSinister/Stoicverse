import { WorkspacePage } from "@/components/workspace/WorkspacePage";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorNotificationsPage() {
  await requireInfluencerWorkspace("/creator/notifications");
  return <WorkspacePage workspace="/creator" active="Notifications" title="Creator notifications" description="Review activity and operational updates for your community." />;
}
