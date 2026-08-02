import { CreatorMemberRoles, type CosmeticRole, type RoleMember } from "@/components/creator/CreatorMemberRoles";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorMembersPage() {
  const { supabase, user } = await requireInfluencerWorkspace("/creator/members");
  const now = new Date().toISOString();
  const [profileResult, membershipResult, rolesResult, assignmentsResult] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("memberships").select("user_id,expires_at,profiles!memberships_user_id_fkey(id,full_name,platform_role)").eq("status", "active").or(`expires_at.is.null,expires_at.gt.${now}`),
    supabase.from("cosmetic_roles").select("id,name,color,priority").order("priority", { ascending: false }).order("name"),
    supabase.from("cosmetic_role_assignments").select("role_id,user_id"),
  ]);
  if (profileResult.error || membershipResult.error || rolesResult.error || assignmentsResult.error) throw new Error("Unable to load member roles.");

  const assignments = assignmentsResult.data ?? [];
  const members: RoleMember[] = (membershipResult.data ?? []).flatMap((membership) => {
    const profile = Array.isArray(membership.profiles) ? membership.profiles[0] : membership.profiles;
    if (!profile) return [];
    return [{ id: profile.id, name: profile.full_name?.trim() || "Member", platformRole: profile.platform_role, roleIds: assignments.filter((assignment) => assignment.user_id === profile.id).map((assignment) => assignment.role_id) }];
  });
  return <CreatorMemberRoles memberName={profileResult.data?.full_name?.trim() || "Creator"} roles={(rolesResult.data ?? []) as CosmeticRole[]} members={members} />;
}
