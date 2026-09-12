import { MemberRegistry } from "@/components/creator/members/MemberRegistry";
import { queryMemberDirectory } from "@/lib/member-operations/server";
import type { CosmeticRole } from "@/lib/member-operations/types";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorMembersPage() {
  const { supabase, user } = await requireInfluencerWorkspace("/creator/members");
  const [profileResult, rolesResult, initialPage] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    // `community_roles` directly since phase 9 dropped the `cosmetic_roles`
    // compat view, which was this same select with `position` aliased to
    // `priority`. The alias stays here because `search_creator_members`
    // returns the key under the old name too, and one page should not carry
    // two spellings of one field.
    supabase.from("community_roles").select("id,name,color,priority:position").order("position", { ascending: false }).order("name"),
    queryMemberDirectory(supabase, {}),
  ]);
  if (profileResult.error || rolesResult.error) throw new Error("Unable to load the member registry.");

  return <MemberRegistry memberName={profileResult.data?.full_name?.trim() || "Creator"} initialPage={initialPage} initialRoles={(rolesResult.data ?? []) as CosmeticRole[]} />;
}
