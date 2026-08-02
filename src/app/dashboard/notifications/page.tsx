import { AppShell } from "@/components/layout/AppShell";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { requireActiveMembership } from "@/lib/supabase/access";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { supabase, user } = await requireActiveMembership("/dashboard/notifications");
  const [{ data: profile }, params] = await Promise.all([
    supabase.from("profiles").select("full_name,platform_role").eq("id", user.id).maybeSingle(),
    searchParams,
  ]);
  return <AppShell active="Notifications" title="Notifications" terminalHeader routeBase="/dashboard" memberName={profile?.full_name?.trim() || "Practitioner"} platformRole={profile?.platform_role ?? "member"}><NotificationCenter initialView={params.view} /></AppShell>;
}
