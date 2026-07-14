import { WorkspacePage } from "@/components/workspace/WorkspacePage";
import { requireActiveMembership } from "@/lib/supabase/access";

export default async function MessagesPage() {
  await requireActiveMembership("/dashboard/messages");
  return <WorkspacePage workspace="/dashboard" active="Messages" title="Messages" description="Your conversations and community replies will appear here." />;
}
