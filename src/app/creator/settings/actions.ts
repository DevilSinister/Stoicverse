"use server";

import { parseComposer, parseIdentity } from "@/lib/community-settings/model";
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
