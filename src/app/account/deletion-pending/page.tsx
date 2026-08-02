import { redirect } from "next/navigation";

import { DeletionPendingScreen } from "@/components/settings/DeletionPendingScreen";
import { createClient } from "@/lib/supabase/server";

export default async function DeletionPendingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/deletion-pending");
  const [requestResult, profileResult] = await Promise.all([
    supabase.from("account_deletion_requests").select("status,scheduled_at").eq("user_id", user.id).in("status", ["pending", "processing", "failed"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  if (requestResult.error || profileResult.error) throw new Error("Unable to load the deletion request.");
  if (!requestResult.data) redirect("/dashboard");
  return <DeletionPendingScreen name={profileResult.data?.full_name?.trim() || "Member"} scheduledAt={requestResult.data.scheduled_at} status={requestResult.data.status}/>;
}
