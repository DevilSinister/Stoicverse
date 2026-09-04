import { MemberRegistry } from "@/components/creator/members/MemberRegistry";
import { queryMemberDirectory } from "@/lib/member-operations/server";
import type { CosmeticRole } from "@/lib/member-operations/types";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorMembersPage() {
  const { supabase, user } = await requireInfluencerWorkspace("/creator/members");
  const [profileResult, rolesResult, initialPage] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("cosmetic_roles").select("id,name,color,priority").order("priority", { ascending: false }).order("name"),
    queryMemberDirectory(supabase, {}),
  ]);
  if (profileResult.error || rolesResult.error) throw new Error("Unable to load the member registry.");

  return <MemberRegistry memberName={profileResult.data?.full_name?.trim() || "Creator"} initialPage={initialPage} initialRoles={(rolesResult.data ?? []) as CosmeticRole[]} />;
}
