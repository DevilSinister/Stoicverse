"use server";

import { parseIdentity, parseModeration } from "@/lib/community-settings/model";
import { parseRoleInput } from "@/lib/community-settings/role-model";
import { isUuid } from "@/lib/security/uuid";
import { revalidateCommunity } from "@/lib/community-settings/revalidate";
import { requireCommunityPermission, requireInfluencer } from "@/lib/supabase/access";
import { postgresMessage } from "@/lib/supabase/errors";

type Result = { error?: string; success?: true };

const value = (data: FormData, key: string) => (typeof data.get(key) === "string" ? String(data.get(key)).trim() : "");

/**
 * Save the community's identity.
 *
 * Reads of these settings degrade to defaults; this write does not. If the
 * table is missing the creator is told which migration is outstanding, because
 * silently accepting the form would lose what they typed.
 */
export async function saveCommunityIdentity(data: FormData): Promise<Result> {
  const { supabase } = await requireInfluencer();

  let identity;
  try {
    identity = parseIdentity({
      name: value(data, "name"),
      tagline: value(data, "tagline"),
      logoPath: value(data, "logoPath"),
      accentColor: value(data, "accentColor"),
      welcomeMessage: value(data, "welcomeMessage"),
      rules: value(data, "rules"),
      showWelcome: data.get("showWelcome") !== null,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Those settings could not be saved." };
  }

  // The name lives in platform_settings, which is super-admin-only at row
  // level. This function is the influencer's column-granular way in.
  const rename = await supabase.rpc("set_community_name", { new_name: identity.name });
  if (rename.error) {
    return { error: postgresMessage(rename.error, "The community name could not be saved.") };
  }

  const { error } = await supabase
    .from("community_settings")
    .update({
      tagline: identity.tagline || null,
      logo_path: identity.logoPath,
      accent_color: identity.accentColor,
      welcome_message: identity.welcomeMessage || null,
      rules: identity.rules || null,
      show_welcome: identity.showWelcome,
    })
    .eq("id", true);

  if (error) {
    return {
      error: postgresMessage(
        error,
        "Branding could not be saved. If this persists, migration 20260911000000 may not be applied yet.",
      ),
    };
  }

  revalidateCommunity();
  return { success: true };
}


/**
 * Create or edit one role.
 *
 * Everything this validates the database validates again, and the database is
 * the boundary: `community_role_save` re-checks the actor's permission, the
 * hierarchy, and that no grant is made which the actor does not itself hold.
 * Parsing here only buys a legible message instead of a 23514 or a P0001 about
 * a column name.
 */
export async function saveRole(data: FormData): Promise<Result & { roleId?: string }> {
  const { supabase } = await requireCommunityPermission("manage_roles");

  const roleId = value(data, "roleId");
  if (roleId && !isUuid(roleId)) return { error: "That role could not be found." };

  let role;
  try {
    role = parseRoleInput({
      name: value(data, "name"),
      color: value(data, "color"),
      hoist: data.get("hoist") !== null,
      mentionable: data.get("mentionable") !== null,
      iconEmoji: value(data, "iconEmoji"),
      iconPath: value(data, "iconPath"),
      permissions: data.getAll("permissions").map(String),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That role could not be saved." };
  }

  const { data: saved, error } = await supabase.rpc("community_role_save", {
    role_id: roleId || null,
    role_name: role.name,
    role_color: role.color,
    role_hoist: role.hoist,
    role_mentionable: role.mentionable,
    role_icon_emoji: role.iconEmoji,
    role_icon_path: role.iconPath,
    role_permissions: role.permissions,
  });

  if (error) {
    return {
      error: postgresMessage(
        error,
        "That role could not be saved. If this persists, migration 20260912010000 may not be applied yet.",
      ),
    };
  }

  revalidateCommunity();
  return { success: true, roleId: typeof saved === "string" ? saved : undefined };
}

export async function deleteRole(roleId: string): Promise<Result> {
  const { supabase } = await requireCommunityPermission("manage_roles");
  if (!isUuid(roleId)) return { error: "That role could not be found." };

  const { error } = await supabase.rpc("community_role_delete", { role_id: roleId });
  if (error) return { error: postgresMessage(error, "That role could not be deleted.") };

  revalidateCommunity();
  return { success: true };
}

/**
 * Commit a whole reorder in one call.
 *
 * `ordered` is every role except @everyone, lowest position first. One action
 * and one UPDATE, because Next dispatches Server Actions sequentially per
 * client: a call per row would serialise into N round trips, and the unique
 * constraint on position would reject every intermediate state.
 */
export async function reorderRoles(ordered: string[]): Promise<Result> {
  const { supabase } = await requireCommunityPermission("manage_roles");

  if (!Array.isArray(ordered) || ordered.length === 0 || ordered.length > 200) {
    return { error: "That reorder could not be applied." };
  }
  if (ordered.some((id) => !isUuid(id)) || new Set(ordered).size !== ordered.length) {
    return { error: "That reorder could not be applied." };
  }

  const { error } = await supabase.rpc("community_roles_reorder", { ordered });
  if (error) return { error: postgresMessage(error, "The new order could not be saved.") };

  revalidateCommunity();
  return { success: true };
}

/**
 * Add and remove people from one role in a single action.
 *
 * Same reason as the reorder: one action taking arrays, not one action per
 * member. Removals run first so swapping the whole membership of a capped role
 * cannot trip over its own additions.
 */
export async function setRoleMembers(
  roleId: string,
  changes: { add?: string[]; remove?: string[] },
): Promise<Result> {
  const { supabase } = await requireCommunityPermission("manage_roles");

  const add = [...new Set(changes.add ?? [])];
  const remove = [...new Set(changes.remove ?? [])];
  if (!isUuid(roleId) || [...add, ...remove].some((id) => !isUuid(id))) {
    return { error: "That member or role could not be found." };
  }
  if (add.length + remove.length === 0) return { success: true };
  if (add.length + remove.length > 50) return { error: "Change at most 50 members at a time." };

  for (const memberId of remove) {
    const { error } = await supabase.rpc("community_role_unassign", { role_id: roleId, member_id: memberId });
    if (error) return { error: postgresMessage(error, "That member could not be removed from the role.") };
  }
  for (const memberId of add) {
    const { error } = await supabase.rpc("community_role_assign", { role_id: roleId, member_id: memberId });
    if (error) return { error: postgresMessage(error, "That member could not be given the role.") };
  }

  revalidateCommunity();
  return { success: true };
}

/** Save the edit window and whether a deletion needs a reason. */
export async function saveCommunityModeration(data: FormData): Promise<Result> {
  const { supabase } = await requireInfluencer();

  let moderation;
  try {
    moderation = parseModeration({
      editWindowMinutes: value(data, "editWindowMinutes"),
      deleteRequiresReason: data.get("deleteRequiresReason") !== null,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Those settings could not be saved." };
  }

  const { error } = await supabase
    .from("community_settings")
    .update({
      edit_window_minutes: moderation.editWindowMinutes,
      delete_requires_reason: moderation.deleteRequiresReason,
    })
    .eq("id", true);

  if (error) {
    return {
      error: postgresMessage(
        error,
        "Moderation settings could not be saved. If this persists, migration 20260911030000 may not be applied yet.",
      ),
    };
  }

  revalidateCommunity();
  return { success: true };
}

