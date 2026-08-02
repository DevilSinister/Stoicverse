import { headers } from "next/headers";

import { AccountSettingsWorkspace, type SettingsSection } from "@/components/settings/AccountSettingsWorkspace";
import { safeNextPath } from "@/lib/security/safe-path";
import { requireActiveMembership } from "@/lib/supabase/access";

const validSections = new Set<SettingsSection>(["account", "notifications", "sessions", "deletion"]);

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ section?: string; returnTo?: string }> }) {
  const { supabase, user } = await requireActiveMembership("/dashboard/settings");
  const [params, headerList, profileResult, membershipResult, preferenceResult, assignmentResult] = await Promise.all([
    searchParams,
    headers(),
    supabase.from("profiles").select("full_name,avatar_url,platform_role").eq("id", user.id).maybeSingle(),
    supabase.from("memberships").select("status,expires_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("member_notification_preferences").select("event_updates,course_updates,community_mentions,role_achievements").eq("user_id", user.id).maybeSingle(),
    supabase.from("cosmetic_role_assignments").select("role_id").eq("user_id", user.id),
  ]);
  if (profileResult.error || membershipResult.error || preferenceResult.error || assignmentResult.error) throw new Error("Unable to load account settings.");

  const roleIds = (assignmentResult.data ?? []).map((assignment) => assignment.role_id);
  const roleResult = roleIds.length ? await supabase.from("cosmetic_roles").select("id,name,color,priority").in("id", roleIds).order("priority", { ascending: false }) : { data: [], error: null };
  if (roleResult.error) throw new Error("Unable to load cosmetic roles.");

  const profile = profileResult.data;
  let avatarUrl: string | null = null;
  if (profile?.avatar_url) {
    const signed = await supabase.storage.from("member-avatars").createSignedUrl(profile.avatar_url, 60 * 60);
    avatarUrl = signed.data?.signedUrl ?? null;
  }

  const requestedSection = params.section as SettingsSection | undefined;
  const initialSection = requestedSection && validSections.has(requestedSection) ? requestedSection : "account";
  const candidateReturn = safeNextPath(params.returnTo, "/dashboard");
  const returnTo = candidateReturn.startsWith("/dashboard/settings") ? "/dashboard" : candidateReturn;
  const userAgent = headerList.get("user-agent") || "Current browser";
  const currentDevice = /mobile|android|iphone|ipad/i.test(userAgent) ? "Mobile browser" : /windows/i.test(userAgent) ? "Windows browser" : /macintosh|mac os/i.test(userAgent) ? "Mac browser" : /linux/i.test(userAgent) ? "Linux browser" : "Current browser";
  const preferences = preferenceResult.data;

  return <AccountSettingsWorkspace initialSection={initialSection} returnTo={returnTo} data={{
    fullName: profile?.full_name?.trim() || "Practitioner",
    email: user.email || "No email available",
    avatarUrl,
    platformRole: profile?.platform_role ?? "member",
    membershipStatus: membershipResult.data?.status === "active" ? "Active member" : "Member account",
    membershipExpiresAt: membershipResult.data?.expires_at ?? null,
    cosmeticRoles: (roleResult.data ?? []).map((role) => ({ id: role.id, name: role.name, color: role.color })),
    preferences: {
      eventUpdates: preferences?.event_updates ?? true,
      courseUpdates: preferences?.course_updates ?? true,
      communityMentions: preferences?.community_mentions ?? true,
      roleAchievements: preferences?.role_achievements ?? true,
    },
    currentDevice,
    canDelete: profile?.platform_role === "member",
  }}/>;
}
