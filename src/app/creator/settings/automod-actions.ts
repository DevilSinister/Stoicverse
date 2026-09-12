"use server";

import { parseAutomodRule } from "@/lib/community-settings/automod";
import { revalidateCommunity } from "@/lib/community-settings/revalidate";
import { isUuid } from "@/lib/security/uuid";
import { requireCommunityPermission } from "@/lib/supabase/access";
import { postgresMessage } from "@/lib/supabase/errors";

type Result = { error?: string; success?: true };

/**
 * AutoMod writes.
 *
 * Every one of these goes through an RPC rather than a table write: the rule
 * tables carry no DML policy at all, so a direct `.update()` would be refused
 * by the database rather than merely discouraged here. The permission check
 * below is the earlier, better error — `community_has('manage_community')`
 * inside each RPC is the enforcement.
 */

/** Create or update one rule. The whole rule travels as jsonb, parsed into columns in SQL. */
export async function saveAutomodRule(input: Record<string, unknown>): Promise<Result & { id?: string }> {
  const { supabase } = await requireCommunityPermission("manage_community");

  let rule;
  try {
    rule = parseAutomodRule(input);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That rule could not be saved." };
  }

  const { data, error } = await supabase.rpc("community_automod_rule_save", { rule });
  if (error) return { error: postgresMessage(error, "That rule could not be saved.") };

  revalidateCommunity();
  return { success: true, id: data as string };
}

export async function deleteAutomodRule(id: string): Promise<Result> {
  const { supabase } = await requireCommunityPermission("manage_community");
  if (!isUuid(id)) return { error: "That rule could not be found." };

  const { error } = await supabase.rpc("community_automod_rule_delete", { rule_id: id });
  if (error) return { error: postgresMessage(error, "That rule could not be removed.") };

  revalidateCommunity();
  return { success: true };
}

export async function toggleAutomodRule(id: string, enabled: boolean): Promise<Result> {
  const { supabase } = await requireCommunityPermission("manage_community");
  if (!isUuid(id)) return { error: "That rule could not be found." };

  const { error } = await supabase.rpc("community_automod_rule_toggle", { rule_id: id, enabled });
  if (error) return { error: postgresMessage(error, "That rule could not be switched.") };

  revalidateCommunity();
  return { success: true };
}

/**
 * The whole exemption set in one call.
 *
 * Next 16 dispatches server actions sequentially per client, so a
 * checkbox-at-a-time version would queue behind itself while the operator was
 * still clicking. The RPC replaces the set rather than diffing it.
 */
export async function setAutomodExemptions(
  id: string,
  roleIds: string[],
  channelIds: string[],
): Promise<Result> {
  const { supabase } = await requireCommunityPermission("manage_community");
  if (!isUuid(id)) return { error: "That rule could not be found." };
  if (![...roleIds, ...channelIds].every(isUuid)) return { error: "That exemption could not be saved." };

  const { error } = await supabase.rpc("community_automod_exemption_set", {
    rule_id: id,
    role_ids: roleIds,
    channel_ids: channelIds,
  });
  if (error) return { error: postgresMessage(error, "Those exemptions could not be saved.") };

  revalidateCommunity();
  return { success: true };
}

/**
 * "Would this sentence be caught?"
 *
 * Answered by the database rather than by the client mirror, so the box the
 * operator trusts is the same code path that runs on save. The mirror in
 * `automod.ts` still backs the live preview while they type; this is the
 * confirmation.
 */
export async function testAutomodBody(body: string): Promise<Result & { ruleName?: string; wouldBlock?: boolean }> {
  const { supabase } = await requireCommunityPermission("manage_community");

  const { data, error } = await supabase.rpc("community_automod_test", { body });
  if (error) return { error: postgresMessage(error, "That sentence could not be tested.") };

  const hit = (data as { rule_name: string; would_block: boolean }[] | null)?.[0];
  if (!hit) return { success: true };
  return { success: true, ruleName: hit.rule_name, wouldBlock: hit.would_block };
}
