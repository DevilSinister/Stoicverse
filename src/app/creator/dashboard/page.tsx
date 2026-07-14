import { CreatorOverviewView } from "@/components/creator/CreatorOverviewView";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export async function CreatorDashboardPage() {
  const { supabase, user } = await requireInfluencerWorkspace("/creator/dashboard");

  const [profileResult, notificationsResult] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("notifications").select("id, type, title, body, action_url, is_read, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
  ]);

  const results = [profileResult, notificationsResult];
  if (results.some((result) => result.error)) {
    throw new Error("Unable to load creator dashboard data.");
  }

  return <CreatorOverviewView memberName={profileResult.data?.full_name?.trim() || "Creator"} notifications={notificationsResult.data ?? []} />;
}

export default function LegacyCreatorDashboardPage() {
  return <CreatorDashboardPage />;
}
