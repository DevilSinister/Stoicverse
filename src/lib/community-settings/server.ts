import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_COMMUNITY_IDENTITY,
  DEFAULT_COMMUNITY_SAFETY,
  type CommunityIdentity,
  type CommunitySafety,
} from "@/lib/community-settings/model";

export type IdentityLoad = {
  identity: CommunityIdentity;
  safety: CommunitySafety;
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
        "tagline,logo_path,accent_color,welcome_message,rules,show_welcome,edit_window_minutes,delete_requires_reason,verification_level,verification_minutes,join_rate_limit,join_rate_window_minutes,lockdown_minutes,rules_channel_id,raid_lockdown_until,rules_version,rules_updated_at",
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

  const safety: CommunitySafety = {
    verificationLevel: row?.verification_level ?? DEFAULT_COMMUNITY_SAFETY.verificationLevel,
    verificationMinutes: row?.verification_minutes ?? DEFAULT_COMMUNITY_SAFETY.verificationMinutes,
    joinRateLimit: row?.join_rate_limit ?? DEFAULT_COMMUNITY_SAFETY.joinRateLimit,
    joinRateWindowMinutes: row?.join_rate_window_minutes ?? DEFAULT_COMMUNITY_SAFETY.joinRateWindowMinutes,
    lockdownMinutes: row?.lockdown_minutes ?? DEFAULT_COMMUNITY_SAFETY.lockdownMinutes,
    rulesChannelId: row?.rules_channel_id ?? null,
    editWindowMinutes: row?.edit_window_minutes ?? DEFAULT_COMMUNITY_SAFETY.editWindowMinutes,
    deleteRequiresReason: row?.delete_requires_reason ?? DEFAULT_COMMUNITY_SAFETY.deleteRequiresReason,
    raidLockdownUntil: row?.raid_lockdown_until ?? null,
    rulesVersion: row?.rules_version ?? DEFAULT_COMMUNITY_SAFETY.rulesVersion,
    rulesUpdatedAt: row?.rules_updated_at ?? null,
  };

  return { identity, safety, logoUrl, degraded };
}
