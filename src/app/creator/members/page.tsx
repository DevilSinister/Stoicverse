import { WorkspacePage } from "@/components/workspace/WorkspacePage";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorMembersPage() {
  await requireInfluencerWorkspace("/creator/members");
  return <WorkspacePage workspace="/creator" active="Members" title="Member management" description="Review and manage the members of your community from this creator-only workspace." />;
}
