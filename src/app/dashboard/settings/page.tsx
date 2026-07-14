import { WorkspacePage } from "@/components/workspace/WorkspacePage";
import { requireActiveMembership } from "@/lib/supabase/access";

export default async function SettingsPage() {
  await requireActiveMembership("/dashboard/settings");
  return <WorkspacePage workspace="/dashboard" active="Settings" title="Account settings" description="Manage your profile, password, and member account preferences." />;
}
