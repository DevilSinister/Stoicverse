"use server";

import {
  parseBlockedPhrase,
  parseComposer,
  parseIdentity,
  parseModeration,
  PERMISSION_KEYS,
  type PermissionConfig,
} from "@/lib/community-settings/model";
import { isUuid } from "@/lib/security/uuid";
import { revalidateCommunity } from "@/lib/community-settings/revalidate";
import { requireInfluencer } from "@/lib/supabase/access";
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
 * Save the composer and reaction rules.
 *
 * Each of these is a real predicate: the emoji set is read by the reactions
 * policy, and the length, link and attachment rules by a `BEFORE INSERT OR
 * UPDATE` trigger. Nothing saved here is advisory.
 */
export async function saveCommunityComposer(data: FormData): Promise<Result> {
  const { supabase } = await requireInfluencer();

  let composer;
  try {
    composer = parseComposer({
      reactionEmojis: data.getAll("reactionEmojis").map(String),
      maxBodyLength: value(data, "maxBodyLength"),
      allowLinks: data.get("allowLinks") !== null,
      allowAttachments: data.get("allowAttachments") !== null,
      maxAttachmentBytes: value(data, "maxAttachmentBytes"),
      allowedAttachmentTypes: data.getAll("allowedAttachmentTypes").map(String),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Those settings could not be saved." };
  }

  const { error } = await supabase
    .from("community_settings")
    .update({
      reaction_emojis: composer.reactionEmojis,
      max_body_length: composer.maxBodyLength,
      allow_links: composer.allowLinks,
      allow_attachments: composer.allowAttachments,
      max_attachment_bytes: composer.maxAttachmentBytes,
      allowed_attachment_types: composer.allowedAttachmentTypes,
    })
    .eq("id", true);

  if (error) {
    return {
      error: postgresMessage(
        error,
        "Composer rules could not be saved. If this persists, migration 20260911010000 may not be applied yet.",
      ),
    };
  }

  revalidateCommunity();
  return { success: true };
}

/**
 * Save one role's permission grants.
 *
 * Only the seven known keys are written, and only as booleans. The database
 * CHECK enforces the same thing — this makes the failure legible instead of a
 * raw 23514, and keeps a typo from becoming a grant that silently never applies.
 */
export async function saveRolePermissions(data: FormData): Promise<Result> {
  const { supabase } = await requireInfluencer();

  const roleId = value(data, "roleId");
  if (!isUuid(roleId)) return { error: "That role could not be found." };

  const granted = new Set(data.getAll("permissions").map(String));
  const permissions: PermissionConfig = {};
  for (const key of PERMISSION_KEYS) permissions[key] = granted.has(key);

  const { error } = await supabase
    .from("cosmetic_roles")
    .update({ permission_config: permissions })
    .eq("id", roleId);

  if (error) {
    return {
      error: postgresMessage(
        error,
        "Those permissions could not be saved. If this persists, migration 20260911020000 may not be applied yet.",
      ),
    };
  }

  revalidateCommunity();
  return { success: true };
}

/** Save slow mode, the edit window, delete reasons, and how blocked words match. */
export async function saveCommunityModeration(data: FormData): Promise<Result> {
  const { supabase } = await requireInfluencer();

  let moderation;
  try {
    moderation = parseModeration({
      slowModeSeconds: value(data, "slowModeSeconds"),
      editWindowMinutes: value(data, "editWindowMinutes"),
      deleteRequiresReason: data.get("deleteRequiresReason") !== null,
      blockedWordMode: value(data, "blockedWordMode"),
      blockedWordMatch: value(data, "blockedWordMatch"),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Those settings could not be saved." };
  }

  const { error } = await supabase
    .from("community_settings")
    .update({
      slow_mode_seconds: moderation.slowModeSeconds,
      edit_window_minutes: moderation.editWindowMinutes,
      delete_requires_reason: moderation.deleteRequiresReason,
      blocked_word_mode: moderation.blockedWordMode,
      blocked_word_match: moderation.blockedWordMatch,
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

/**
 * Add phrases to the blocked list.
 *
 * Accepts a bulk paste. Literal phrases only, never a pattern: a user-supplied
 * regex evaluated on every insert is a denial-of-service aimed at your own
 * database.
 */
export async function addBlockedWords(data: FormData): Promise<Result> {
  const { supabase } = await requireInfluencer();

  const raw = value(data, "phrases");
  const candidates = [...new Set(raw.split(/[\n,]/).map((entry) => entry.trim()).filter(Boolean))];
  if (!candidates.length) return { error: "Enter at least one phrase." };

  let phrases: string[];
  try {
    phrases = candidates.map(parseBlockedPhrase);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Those phrases could not be saved." };
  }

  // The unique index is on lower(btrim(phrase)); ignoring duplicates keeps a
  // bulk paste from failing wholesale because one entry was already listed.
  const { error } = await supabase
    .from("community_blocked_words")
    .upsert(phrases.map((phrase) => ({ phrase })), { onConflict: "phrase", ignoreDuplicates: true });

  if (error) return { error: postgresMessage(error, "Those phrases could not be saved.") };

  revalidateCommunity();
  return { success: true };
}

export async function removeBlockedWord(id: string): Promise<Result> {
  const { supabase } = await requireInfluencer();
  if (!isUuid(id)) return { error: "That phrase could not be found." };

  const { error } = await supabase.from("community_blocked_words").delete().eq("id", id);
  if (error) return { error: postgresMessage(error, "That phrase could not be removed.") };

  revalidateCommunity();
  return { success: true };
}
