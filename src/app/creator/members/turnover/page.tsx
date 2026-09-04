import { TurnoverWorkspace } from "@/components/creator/members/TurnoverWorkspace";
import { queryMemberDirectory } from "@/lib/member-operations/server";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorMemberTurnoverPage() {
  const { supabase, user } = await requireInfluencerWorkspace("/creator/members/turnover");
  const [profileResult, initialPage] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    queryMemberDirectory(supabase, {}),
  ]);
  if (profileResult.error) throw new Error("Unable to load the turnover workspace.");
  return <TurnoverWorkspace memberName={profileResult.data?.full_name?.trim() || "Creator"} initialPage={initialPage} />;
}

