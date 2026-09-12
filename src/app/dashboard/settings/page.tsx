import { headers } from "next/headers";

import { AccountSettingsWorkspace, type SettingsSection } from "@/components/settings/AccountSettingsWorkspace";
import { safeNextPath } from "@/lib/security/safe-path";
import { requireActiveMembership, requireInfluencerWorkspace } from "@/lib/supabase/access";

const validSections = new Set<SettingsSection>(["account", "notifications", "sessions", "deletion"]);

type AccountSettingsOptions = {
  searchParams: Promise<{ section?: string; returnTo?: string }>;
  /**
   * The influencer workspace. `requireActiveMembership` redirects an
   * influencer to /creator and `proxy.ts` bounces them off /dashboard/*, so a
   * creator could never open this page — which left them with no route to
   * their own account and, because sign-out lives here, no way to log out at
   * all. `/creator/account` is the same page behind the other guard.
   */
  creatorWorkspace?: boolean;
};

export async function renderAccountSettings({ searchParams, creatorWorkspace = false }: AccountSettingsOptions) {
  const base = creatorWorkspace ? "/creator" : "/dashboard";
  const { supabase, user } = creatorWorkspace
    ? await requireInfluencerWorkspace("/creator/account")
    : await requireActiveMembership("/dashboard/settings");
  const [params, headerList, profileResult, membershipResult, preferenceResult, assignmentResult] = await Promise.all([
    searchParams,
    headers(),
    supabase.from("profiles").select("full_name,avatar_url,platform_role").eq("id", user.id).maybeSingle(),
    supabase.from("memberships").select("status,expires_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("member_notification_preferences").select("event_updates,course_updates,community_mentions,role_achievements").eq("user_id", user.id).maybeSingle(),
    supabase.from("community_role_members").select("role_id").eq("user_id", user.id),
  ]);
  if (profileResult.error || membershipResult.error || preferenceResult.error || assignmentResult.error) throw new Error("Unable to load account settings.");

  const roleIds = (assignmentResult.data ?? []).map((assignment) => assignment.role_id);
  const roleResult = roleIds.length ? await supabase.from("community_roles").select("id,name,color,position").in("id", roleIds).order("position", { ascending: false }) : { data: [], error: null };
  if (roleResult.error) throw new Error("Unable to load community roles.");

  const profile = profileResult.data;
  let avatarUrl: string | null = null;
  if (profile?.avatar_url) {
    const signed = await supabase.storage.from("member-avatars").createSignedUrl(profile.avatar_url, 60 * 60);
    avatarUrl = signed.data?.signedUrl ?? null;
  }

  const requestedSection = params.section as SettingsSection | undefined;
  const initialSection = requestedSection && validSections.has(requestedSection) ? requestedSection : "account";
  const candidateReturn = safeNextPath(params.returnTo, base);
  // Returning to the page you are on is not a way back.
  const settingsPath = creatorWorkspace ? "/creator/account" : "/dashboard/settings";
  const returnTo = candidateReturn.startsWith(settingsPath) ? base : candidateReturn;
  const userAgent = headerList.get("user-agent") || "Current browser";
  const currentDevice = /mobile|android|iphone|ipad/i.test(userAgent) ? "Mobile browser" : /windows/i.test(userAgent) ? "Windows browser" : /macintosh|mac os/i.test(userAgent) ? "Mac browser" : /linux/i.test(userAgent) ? "Linux browser" : "Current browser";
  const preferences = preferenceResult.data;

  return <AccountSettingsWorkspace initialSection={initialSection} returnTo={returnTo} basePath={settingsPath} homePath={base} data={{
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

export default async function SettingsPage({ searchParams }: { searchParams: AccountSettingsOptions["searchParams"] }) {
  return renderAccountSettings({ searchParams });
}
