import { WorkspacePage } from "@/components/workspace/WorkspacePage";
import { requireActiveMembership } from "@/lib/supabase/access";

export default async function NotificationsPage() {
  await requireActiveMembership("/dashboard/notifications");
  return <WorkspacePage workspace="/dashboard" active="Notifications" title="Notifications" description="Review your course, event, and community updates in one place." />;
}
