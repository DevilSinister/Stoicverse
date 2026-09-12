"use server";

import { revalidateCommunity } from "@/lib/community-settings/revalidate";
import { isUuid } from "@/lib/security/uuid";
import { postgresMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

/**
 * Restricting a member to less than the whole community, and gifting one
 * access to it.
 *
 * Every check that matters is in the RPC rather than here:
 * `community_restrict_member` re-asks `ban_members`, refuses the owner and
 * refuses self-targeting, and `community_gift_membership` refuses anybody who
 * is not the owner. These wrappers validate shapes so a typo becomes a
 * sentence rather than a Postgres error, and then get out of the way.
 */

type Result = { success?: true; error?: string };

const SCOPES = ["channel", "category"] as const;
export type RestrictionScope = (typeof SCOPES)[number];

export async function restrictMember(
  memberId: string,
  scope: RestrictionScope,
  scopeId: string,
  reason: string,
  keys?: string[],
): Promise<Result> {
  if (!isUuid(memberId) || !isUuid(scopeId)) return { error: "That member or channel could not be found." };
  if (!SCOPES.includes(scope)) return { error: "A restriction is scoped to a channel or a category." };
  const clean = reason.trim();
  if (clean.length < 3 || clean.length > 500) {
    return { error: "A reason must be between 3 and 500 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("community_restrict_member", {
    target: memberId,
    scope_kind: scope,
    scope_id: scopeId,
    reason: clean,
    // Denying `view_channel` removes the channel entirely. Anything narrower
    // is a mute rather than a removal, so the caller says which it meant.
    keys: keys && keys.length > 0 ? keys : ["view_channel"],
  });
  if (error) return { error: postgresMessage(error, "That restriction could not be applied.") };

  revalidateCommunity();
  return { success: true };
}

export async function unrestrictMember(
  memberId: string,
  scope: RestrictionScope,
  scopeId: string,
  reason?: string,
): Promise<Result> {
  if (!isUuid(memberId) || !isUuid(scopeId)) return { error: "That member or channel could not be found." };
  if (!SCOPES.includes(scope)) return { error: "A restriction is scoped to a channel or a category." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("community_unrestrict_member", {
    target: memberId,
    scope_kind: scope,
    scope_id: scopeId,
    reason: reason?.trim() || null,
  });
  if (error) return { error: postgresMessage(error, "That restriction could not be lifted.") };

  revalidateCommunity();
  return { success: true };
}

export async function giftMembership(
  memberId: string,
  days: number,
  note?: string,
): Promise<Result & { expiresAt?: string }> {
  if (!isUuid(memberId)) return { error: "That member could not be found." };
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    return { error: "A gift runs between 1 and 3650 days." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_gift_membership", {
    target: memberId,
    days,
    note: note?.trim() || null,
  });
  if (error) return { error: postgresMessage(error, "That membership could not be gifted.") };

  // Deliberately no `revalidateCommunity()`. A gift changes the *recipient's*
  // access, not the giver's, so there is nothing on this page to refresh — and
  // the router update it triggers tore down the detail panel that had just
  // asked for the gift, taking the confirmation with it.
  return { success: true, expiresAt: typeof data === "string" ? data : undefined };
}
