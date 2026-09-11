import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_COMMUNITY_COMPOSER,
  DEFAULT_COMMUNITY_IDENTITY,
  type CommunityComposer,
  type CommunityIdentity,
} from "@/lib/community-settings/model";

export type IdentityLoad = {
  identity: CommunityIdentity;
  composer: CommunityComposer;
  logoUrl: string | null;
  /** Human-readable notes about what could not be read. Empty when everything loaded. */
  degraded: string[];
};

/**
 * Read community identity, degrading rather than throwing.
 *
 * A deliberate divergence from `renderCommunityWorkspace`, which throws on any
 * failed query. Here the settings page is the only place the creator can fix
 * their branding, so taking it down because one read failed is the worse trade.
 * Writes still hard-fail — see the identity action.
 */
export async function loadCommunityIdentity(supabase: SupabaseClient): Promise<IdentityLoad> {
  const degraded: string[] = [];

  const [settingsResult, platformResult] = await Promise.all([
    supabase
      .from("community_settings")
      // One string literal, deliberately: supabase-js parses the projection at
      // the type level, and a concatenated expression degrades every column to
      // GenericStringError.
      .select(
        "tagline,logo_path,accent_color,welcome_message,rules,show_welcome,reaction_emojis,max_body_length,allow_links,allow_attachments,max_attachment_bytes,allowed_attachment_types",
      )
      .maybeSingle(),
    supabase.from("platform_settings").select("community_name").maybeSingle(),
  ]);

  if (settingsResult.error) {
    console.error("[community-settings]", { code: settingsResult.error.code ?? null });
    degraded.push(
      "Branding, welcome and rules could not be read. Saving is disabled until migration 20260911000000 is applied.",
    );
  }
  if (platformResult.error) {
    console.error("[community-settings]", { code: platformResult.error.code ?? null });
    degraded.push("The community name could not be read.");
  }

  const row = settingsResult.data;
  const identity: CommunityIdentity = {
    name: platformResult.data?.community_name?.trim() || DEFAULT_COMMUNITY_IDENTITY.name,
    tagline: row?.tagline ?? DEFAULT_COMMUNITY_IDENTITY.tagline,
    logoPath: row?.logo_path ?? null,
    accentColor: row?.accent_color ?? DEFAULT_COMMUNITY_IDENTITY.accentColor,
    welcomeMessage: row?.welcome_message ?? DEFAULT_COMMUNITY_IDENTITY.welcomeMessage,
    rules: row?.rules ?? DEFAULT_COMMUNITY_IDENTITY.rules,
    showWelcome: row?.show_welcome ?? DEFAULT_COMMUNITY_IDENTITY.showWelcome,
  };

  // The bucket is public, so this is string construction rather than a request.
  // A private bucket would mean a signed-URL round trip on every page render.
  const logoUrl = identity.logoPath
    ? supabase.storage.from("community-branding").getPublicUrl(identity.logoPath).data.publicUrl
    : null;

  const composer: CommunityComposer = {
    reactionEmojis: row?.reaction_emojis ?? DEFAULT_COMMUNITY_COMPOSER.reactionEmojis,
    maxBodyLength: row?.max_body_length ?? DEFAULT_COMMUNITY_COMPOSER.maxBodyLength,
    allowLinks: row?.allow_links ?? DEFAULT_COMMUNITY_COMPOSER.allowLinks,
    allowAttachments: row?.allow_attachments ?? DEFAULT_COMMUNITY_COMPOSER.allowAttachments,
    maxAttachmentBytes: row?.max_attachment_bytes ?? DEFAULT_COMMUNITY_COMPOSER.maxAttachmentBytes,
    allowedAttachmentTypes: row?.allowed_attachment_types ?? DEFAULT_COMMUNITY_COMPOSER.allowedAttachmentTypes,
  };

  return { identity, composer, logoUrl, degraded };
}
