import { CreatorOverviewView } from "@/components/creator/CreatorOverviewView";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export async function CreatorDashboardPage() {
  const { supabase, user } = await requireInfluencerWorkspace("/creator/dashboard");

  const [profileResult, notificationsResult, turnoverResult] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("notifications").select("id, type, title, body, action_url, is_read, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    supabase.rpc("creator_turnover_totals"),
  ]);

  const results = [profileResult, notificationsResult, turnoverResult];
  if (results.some((result) => result.error)) {
    throw new Error("Unable to load creator dashboard data.");
  }

  const turnover = turnoverResult.data?.[0];
  return <CreatorOverviewView memberName={profileResult.data?.full_name?.trim() || "Creator"} notifications={notificationsResult.data ?? []} turnoverMetrics={{
    turnoverThisWeek: Number(turnover?.current_week_turnover ?? 0),
    allTimeTurnover: Number(turnover?.all_time_turnover ?? 0),
    updatedAt: turnover?.updated_at ?? null,
  }} />;
}

export default function LegacyCreatorDashboardPage() {
  return <CreatorDashboardPage />;
}
