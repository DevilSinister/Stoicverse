import { TurnoverWorkspace } from "@/components/creator/members/TurnoverWorkspace";
import { queryMemberDirectory } from "@/lib/member-operations/server";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";
import { profileRow } from "@/lib/supabase/viewer";

export default async function CreatorMemberTurnoverPage() {
  const { supabase } = await requireInfluencerWorkspace("/creator/members/turnover");
  const [profileResult, initialPage] = await Promise.all([
    profileRow(),
    queryMemberDirectory(supabase, {}),
  ]);
  if (profileResult.error) throw new Error("Unable to load the turnover workspace.");
  return <TurnoverWorkspace memberName={profileResult.data?.full_name?.trim() || "Creator"} initialPage={initialPage} />;
}

