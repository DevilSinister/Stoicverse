"use server";

import { revalidatePath } from "next/cache";

import type { MemberActionResult, PlatformMemberRole, TurnoverChange } from "@/lib/member-operations/types";
import { isUuid } from "@/lib/security/uuid";
import { requireInfluencer } from "@/lib/supabase/access";
import { postgresMessage } from "@/lib/supabase/errors";

const MAX_TURNOVER = 999_999_999_999.99;
const HEX_PATTERN = /^#[0-9a-f]{6}$/i;
const value = (data: FormData, key: string) => typeof data.get(key) === "string" ? String(data.get(key)).trim() : "";

function currentIsoWeekStart() {
  const now = new Date();
  const utcDay = now.getUTCDay() || 7;
  now.setUTCDate(now.getUTCDate() - utcDay + 1);
  return now.toISOString().slice(0, 10);
}

function refreshMemberOperations() {
  for (const path of ["/creator/members", "/creator/members/turnover", "/creator/dashboard", "/creator", "/dashboard", "/creator/channels", "/channels"]) revalidatePath(path);
}

// The legacy member-workspace role controls, kept working on top of the phase 2
// RPCs. `cosmetic_roles` is a read-only compat view now, so a direct insert or
// update from here would be refused by the database regardless of what this
// action believed. Position is no longer a field on the form: it is set when the
// role is created and changed only by a reorder in the Roles settings section.
export async function saveCosmeticRole(data: FormData): Promise<MemberActionResult> {
  const id = value(data, "id");
  const name = value(data, "name");
  const roleColor = value(data, "color");
  if ((id && !isUuid(id)) || name.length < 2 || name.length > 32 || !HEX_PATTERN.test(roleColor)) {
    return { error: "Enter a 2–32 character name and a valid colour." };
  }

  const { supabase } = await requireInfluencer();
  const { error } = await supabase.rpc("community_role_save", {
    role_id: id || null,
    role_name: name,
    role_color: roleColor.toUpperCase(),
    role_hoist: false,
    role_mentionable: false,
    role_icon_emoji: null,
    role_icon_path: null,
    role_permissions: [],
  });
  if (error) return { error: postgresMessage(error, "The role could not be saved.", "members") };
  refreshMemberOperations();
  return { success: true, message: id ? "Role updated." : "Role created." };
}

export async function deleteCosmeticRole(roleId: string): Promise<MemberActionResult> {
  if (!isUuid(roleId)) return { error: "Invalid role." };
  const { supabase } = await requireInfluencer();
  const { error } = await supabase.rpc("community_role_delete", { role_id: roleId });
  if (error) return { error: postgresMessage(error, "The role could not be deleted.", "members") };
  refreshMemberOperations();
  return { success: true, message: "Role deleted and removed from assigned members." };
}

export async function setCosmeticRoleAssignment(roleId: string, memberId: string, assigned: boolean): Promise<MemberActionResult> {
  if (!isUuid(roleId) || !isUuid(memberId)) return { error: "Invalid member or role." };
  const { supabase } = await requireInfluencer();
  const { error } = await supabase.rpc(assigned ? "community_role_assign" : "community_role_unassign", {
    role_id: roleId,
    member_id: memberId,
  });
  if (error) return { error: postgresMessage(error, "The member’s role could not be changed.", "members") };
  refreshMemberOperations();
  return { success: true, message: assigned ? "Role assigned." : "Role removed." };
}

export async function setMemberPlatformRole(memberId: string, desiredRole: PlatformMemberRole): Promise<MemberActionResult> {
  if (!isUuid(memberId) || !["member", "moderator"].includes(desiredRole)) return { error: "Invalid role change." };
  const { supabase } = await requireInfluencer();
  const { error } = await supabase.rpc("set_member_platform_role", { target_user_id: memberId, desired_role: desiredRole });
  if (error) return { error: "The platform role could not be changed." };
  refreshMemberOperations();
  return { success: true, message: desiredRole === "moderator" ? "Member promoted to moderator." : "Moderator returned to member access." };
}

export async function giftMemberSubscription(memberId: string, durationMonths: 1 | 3 | 6 | 12): Promise<MemberActionResult> {
  if (!isUuid(memberId) || ![1, 3, 6, 12].includes(durationMonths)) return { error: "Choose a valid gift duration." };
  const { supabase } = await requireInfluencer();
  const { error } = await supabase.rpc("gift_member_subscription", { target_user_id: memberId, gift_duration_months: durationMonths });
  if (error) {
    if (error.message.includes("Lifetime")) return { error: "Lifetime memberships cannot be extended." };
    if (error.message.includes("Reinstate")) return { error: "Reinstate this member before gifting access." };
    return { error: "The subscription gift could not be applied." };
  }
  refreshMemberOperations();
  return { success: true, message: `${durationMonths}-month subscription gift applied.` };
}

export async function moderateMember(memberId: string, action: "suspend" | "reinstate", reason: string): Promise<MemberActionResult> {
  const cleanReason = reason.trim();
  if (!isUuid(memberId) || !["suspend", "reinstate"].includes(action) || cleanReason.length < 3 || cleanReason.length > 500) return { error: "Enter a reason between 3 and 500 characters." };
  const { supabase } = await requireInfluencer();
  const { error } = await supabase.rpc("record_member_moderation", { target_user_id: memberId, moderation_action: action, moderation_reason: cleanReason });
  if (error) return { error: "The member’s access state could not be changed." };
  refreshMemberOperations();
  return { success: true, message: action === "suspend" ? "Member suspended." : "Member reinstated." };
}

export async function saveWeeklyTurnover(changes: TurnoverChange[]): Promise<MemberActionResult> {
  if (!Array.isArray(changes) || changes.length < 1 || changes.length > 50) return { error: "Save between 1 and 50 changed rows at once." };
  const uniqueIds = new Set<string>();
  for (const change of changes) {
    const cents = Math.round(change.amountUsd * 100);
    if (!isUuid(change.userId) || uniqueIds.has(change.userId) || !Number.isFinite(change.amountUsd) || change.amountUsd < 0 || change.amountUsd > MAX_TURNOVER || Math.abs(cents / 100 - change.amountUsd) > Number.EPSILON) return { error: "Every turnover value must be a unique member and a valid non-negative USD amount." };
    uniqueIds.add(change.userId);
  }

  const { supabase, user } = await requireInfluencer();
  const { error } = await supabase.from("member_weekly_turnover").upsert(
    changes.map((change) => ({ user_id: change.userId, week_start: currentIsoWeekStart(), amount_usd: change.amountUsd, updated_by: user.id })),
    { onConflict: "user_id,week_start" },
  );
  if (error) return { error: "Turnover changes could not be saved." };
  refreshMemberOperations();
  return { success: true, message: `${changes.length} turnover ${changes.length === 1 ? "entry" : "entries"} saved.` };
}
