"use server";

import { revalidateCommunity } from "@/lib/community-settings/revalidate";
import { parseEmojiName } from "@/lib/community/emojis";
import { isUuid } from "@/lib/security/uuid";
import { createClient } from "@/lib/supabase/server";
import { postgresMessage } from "@/lib/supabase/errors";

/**
 * Creating, renaming and deleting custom emoji.
 *
 * The permission is checked by the RPCs, not here: `manage_emojis` is resolved
 * by the same function that answers it for every other surface, and a second
 * check in TypeScript would be a second answer to drift from.
 *
 * The upload happens in the browser, so the bytes never pass through the
 * server. What arrives here is a path the storage policy has already accepted.
 */

type Result = { error?: string; success?: true };

export async function createEmoji(input: {
  name: string;
  path: string;
  mimeType: string;
  animated: boolean;
  roleIds: string[];
}): Promise<Result & { id?: string }> {
  let name: string;
  try {
    name = parseEmojiName(input.name);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That name cannot be used." };
  }
  if (input.roleIds.some((id) => !isUuid(id))) return { error: "One of those roles is not a role." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_emoji_create", {
    emoji_name: name,
    path: input.path,
    mime: input.mimeType,
    is_animated: input.animated,
    role_ids: input.roleIds,
  });

  if (error) {
    // A duplicate name is the one failure worth naming precisely: it is the
    // only one somebody can fix without being told what went wrong.
    const message = error.code === "23505" ? `There is already an emoji called :${name}:.` : null;
    return { error: message ?? postgresMessage(error, "That emoji could not be added.") };
  }

  revalidateCommunity();
  return { success: true, id: typeof data === "string" ? data : undefined };
}

export async function renameEmoji(id: string, name: string, roleIds: string[]): Promise<Result> {
  if (!isUuid(id)) return { error: "That is not an emoji." };
  let cleaned: string;
  try {
    cleaned = parseEmojiName(name);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That name cannot be used." };
  }
  if (roleIds.some((roleId) => !isUuid(roleId))) return { error: "One of those roles is not a role." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("community_emoji_update", {
    emoji_id: id,
    emoji_name: cleaned,
    role_ids: roleIds,
  });
  if (error) {
    const message = error.code === "23505" ? `There is already an emoji called :${cleaned}:.` : null;
    return { error: message ?? postgresMessage(error, "That emoji could not be saved.") };
  }

  revalidateCommunity();
  return { success: true };
}

/**
 * Delete an emoji, its reactions and its image.
 *
 * The RPC removes the row and the reactions and hands back the storage path;
 * the object is removed afterwards. That order matters: a storage failure then
 * leaves an orphaned file, which costs 256 KB, rather than an emoji whose row
 * is gone and whose reactions are not.
 */
export async function deleteEmoji(id: string): Promise<Result & { reactionsRemoved?: number }> {
  if (!isUuid(id)) return { error: "That is not an emoji." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_emoji_delete", { emoji_id: id });
  if (error) return { error: postgresMessage(error, "That emoji could not be deleted.") };

  const row = ((data ?? []) as { image_path: string; reactions_removed: number }[])[0];
  if (row?.image_path) await supabase.storage.from("community-emojis").remove([row.image_path]);

  revalidateCommunity();
  return { success: true, reactionsRemoved: row?.reactions_removed ?? 0 };
}
