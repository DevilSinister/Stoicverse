"use server";

import { parseModerationReason, parseTimeoutDuration, SANCTION_LIMITS } from "@/lib/community-settings/model";
import { revalidateCommunity } from "@/lib/community-settings/revalidate";
import { isUuid } from "@/lib/security/uuid";
import { requireCommunityPermission } from "@/lib/supabase/access";
import { postgresMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; success?: true; caseId?: string; removed?: number };

/**
 * Every sanction in one module, each one a permission check followed by an RPC.
 *
 * The permission check is not the boundary — `private.assert_can_sanction`
 * re-checks the grant, the hierarchy and that the target is not the owner
 * inside every RPC. This exists so a moderator without the grant reads a
 * sentence instead of a policy error, and so nothing is written first.
 */

export async function warnMember(memberId: string, reason: string): Promise<Result> {
  if (!isUuid(memberId)) return { error: "That member could not be found." };
  let clean: string | null;
  try {
    clean = parseModerationReason(reason);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That warning could not be issued." };
  }

  const { supabase } = await requireCommunityPermission("moderate_members");
  const { data, error } = await supabase.rpc("community_warn_member", { target: memberId, reason: clean });
  if (error) return { error: postgresMessage(error, "That warning could not be issued.") };

  revalidateCommunity();
  return { success: true, caseId: typeof data === "string" ? data : undefined };
}

export async function timeoutMember(memberId: string, durationSeconds: number, reason: string): Promise<Result> {
  if (!isUuid(memberId)) return { error: "That member could not be found." };
  let clean: string | null;
  let duration: number;
  try {
    clean = parseModerationReason(reason);
    duration = parseTimeoutDuration(durationSeconds);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That timeout could not be applied." };
  }

  const { supabase } = await requireCommunityPermission("moderate_members");
  const { data, error } = await supabase.rpc("community_timeout_member", {
    target: memberId,
    duration_seconds: duration,
    reason: clean,
  });
  if (error) return { error: postgresMessage(error, "That timeout could not be applied.") };

  revalidateCommunity();
  return { success: true, caseId: typeof data === "string" ? data : undefined };
}

export async function untimeoutMember(memberId: string, reason?: string): Promise<Result> {
  if (!isUuid(memberId)) return { error: "That member could not be found." };
  let clean: string | null;
  try {
    clean = parseModerationReason(reason, { required: false });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That timeout could not be lifted." };
  }

  const { supabase } = await requireCommunityPermission("moderate_members");
  const { error } = await supabase.rpc("community_untimeout_member", { target: memberId, reason: clean });
  if (error) return { error: postgresMessage(error, "That timeout could not be lifted.") };

  revalidateCommunity();
  return { success: true };
}

/**
 * A ban is community-scoped. It leaves `profiles.is_suspended` and the member's
 * subscription untouched — ending someone's paid access is a separate,
 * deliberate act in the member workspace.
 */
export async function banMember(memberId: string, reason: string): Promise<Result> {
  if (!isUuid(memberId)) return { error: "That member could not be found." };
  let clean: string | null;
  try {
    clean = parseModerationReason(reason);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That member could not be banned." };
  }

  const { supabase } = await requireCommunityPermission("ban_members");
  const { data, error } = await supabase.rpc("community_ban_member", { target: memberId, reason: clean });
  if (error) return { error: postgresMessage(error, "That member could not be banned.") };

  revalidateCommunity();
  return { success: true, caseId: typeof data === "string" ? data : undefined };
}

export async function unbanMember(memberId: string, reason?: string): Promise<Result> {
  if (!isUuid(memberId)) return { error: "That member could not be found." };
  let clean: string | null;
  try {
    clean = parseModerationReason(reason, { required: false });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That ban could not be lifted." };
  }

  const { supabase } = await requireCommunityPermission("ban_members");
  const { error } = await supabase.rpc("community_unban_member", { target: memberId, reason: clean });
  if (error) return { error: postgresMessage(error, "That ban could not be lifted.") };

  revalidateCommunity();
  return { success: true };
}

/**
 * One action taking an array, because Next dispatches Server Actions
 * sequentially per client and a call per message would serialise into N round
 * trips with the moderator watching a half-cleared channel.
 */
export async function bulkDeleteMessages(postIds: string[], reason?: string): Promise<Result> {
  if (!Array.isArray(postIds) || postIds.length === 0) return { error: "Select at least one message." };
  if (postIds.length > SANCTION_LIMITS.bulkDelete.max) {
    return { error: `Delete at most ${SANCTION_LIMITS.bulkDelete.max} messages at a time.` };
  }
  if (postIds.some((id) => !isUuid(id))) return { error: "One of those messages could not be found." };

  let clean: string | null;
  try {
    clean = parseModerationReason(reason, { required: false });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Those messages could not be deleted." };
  }

  const { supabase } = await requireCommunityPermission("manage_messages");
  const { data, error } = await supabase.rpc("community_bulk_delete_messages", {
    post_ids: [...new Set(postIds)],
    reason: clean,
  });
  if (error) return { error: postgresMessage(error, "Those messages could not be deleted.") };

  revalidateCommunity();
  return { success: true, removed: typeof data === "number" ? data : undefined };
}

/**
 * Reporting needs no permission beyond being able to see the message, so this
 * one does not call `requireCommunityPermission`. The RPC checks `view_channel`
 * on the message's own channel, which is also what stops a report from becoming
 * a way to learn that a message exists.
 */
export async function reportMessage(postId: string, reasonKind: string, details?: string): Promise<Result> {
  if (!isUuid(postId)) return { error: "That message could not be found." };
  const clean = typeof details === "string" ? details.trim() : "";
  if (clean.length > SANCTION_LIMITS.details.max) {
    return { error: `Extra detail must be ${SANCTION_LIMITS.details.max} characters or fewer.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to report a message." };

  const { data, error } = await supabase.rpc("community_report_message", {
    post_id: postId,
    reason_kind: reasonKind,
    details: clean || null,
  });
  if (error) return { error: postgresMessage(error, "That report could not be sent.") };

  return { success: true, caseId: typeof data === "string" ? data : undefined };
}

export async function resolveReport(
  reportId: string,
  status: "resolved" | "dismissed",
  note?: string,
  caseId?: string,
): Promise<Result> {
  if (!isUuid(reportId)) return { error: "That report could not be found." };
  if (!["resolved", "dismissed"].includes(status)) return { error: "A report is either resolved or dismissed." };
  if (caseId && !isUuid(caseId)) return { error: "That case could not be found." };

  const clean = typeof note === "string" ? note.trim() : "";
  if (clean.length > SANCTION_LIMITS.details.max) {
    return { error: `A resolution note must be ${SANCTION_LIMITS.details.max} characters or fewer.` };
  }

  const { supabase } = await requireCommunityPermission("moderate_members");
  const { error } = await supabase.rpc("community_report_resolve", {
    report_id: reportId,
    next_status: status,
    note: clean || null,
    case_id: caseId ?? null,
  });
  if (error) return { error: postgresMessage(error, "That report could not be resolved.") };

  revalidateCommunity();
  return { success: true };
}
