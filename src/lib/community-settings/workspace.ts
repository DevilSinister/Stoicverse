import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import type { CommunityCategory, CommunityChannel } from "@/components/community/types";
import {
  loadAuditPage,
  loadAutomodAlerts,
  loadAutomodPresets,
  loadAutomodRules,
  type AuditEvent,
  type AutomodAlertRow,
  type AutomodRuleRow,
} from "@/lib/community-settings/governance";
import type { AutomodPreset } from "@/lib/community-settings/automod";
import { isPermissionKey, type PermissionKey } from "@/lib/community-settings/permissions";
import { loadActiveBans, loadReportsQueue, type BanRow, type ReportRow } from "@/lib/community-settings/moderation";
import { loadCommunityRoles, type RolesLoad } from "@/lib/community-settings/roles";
import type { CommunityRole } from "@/lib/community-settings/role-model";
import {
  parseSettingsQuery,
  visibleSections,
  type SettingsQuery,
  type SettingsSection,
} from "@/lib/community-settings/sections";
import { loadCommunityIdentity, type IdentityLoad } from "@/lib/community-settings/server";
import { loadCustomEmojis } from "@/lib/community/messages";
import type { CustomEmoji } from "@/lib/community/emojis";
import { loadChannelOverrides, loadCommunityStructure, type ChannelOverride } from "@/lib/community-settings/structure";

/**
 * One loader for every settings shell: the /creator/settings page, the
 * /channels/settings page and the in-community overlay. It decides which
 * sections the viewer may see, validates `?section=` against that list, and
 * loads only the data that section renders.
 */

export type SettingsViewer = {
  userId: string;
  isInfluencer: boolean;
  /** Serialisable for client components; build a Set where membership checks matter. */
  permissions: PermissionKey[];
  /** Highest role position held. The influencer sits above every role that can exist. */
  highestPosition: number;
};

export type SettingsWorkspaceData = {
  identity?: IdentityLoad;
  structure?: {
    categories: CommunityCategory[];
    channels: CommunityChannel[];
    /** The permission grid needs both: which roles exist, and what overrides each target carries. */
    roles: CommunityRole[];
    overrides: ChannelOverride[];
  };
  roles?: RolesLoad;
  automod?: {
    rules: AutomodRuleRow[];
    presets: AutomodPreset[];
    alerts: AutomodAlertRow[];
    /** Exemptions are chosen from these, so the editor needs them alongside the rules. */
    roles: CommunityRole[];
    channels: CommunityChannel[];
  };
  safety?: {
    identity: IdentityLoad;
    /** Only `rules` channels: the database trigger refuses any other as the rules channel. */
    rulesChannels: { id: string; name: string }[];
    acceptedCount: number;
  };
  emoji?: { emojis: CustomEmoji[]; roles: CommunityRole[] };
  audit?: { events: AuditEvent[]; nextCursor: string | null; degraded: string[] };
  reports?: { rows: ReportRow[]; nextCursor: string | null; status: "open" | "resolved" };
  bans?: BanRow[];
};

export type SettingsWorkspace = {
  viewer: SettingsViewer;
  visible: SettingsSection[];
  query: SettingsQuery;
  data: SettingsWorkspaceData;
  /** What could not be read. Reads degrade; the matching writes are disabled. */
  degraded: string[];
};

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * What this viewer may do, resolved by the database rather than inferred here.
 *
 * `community_my_permissions` is the same function every policy reads, so the
 * rail cannot offer a section whose writes the database will refuse. A failed
 * read degrades to no permissions: showing nothing is recoverable, showing a
 * control that then fails is not.
 */
async function loadViewer(supabase: SupabaseClient, userId: string): Promise<SettingsViewer> {
  const [profileResult, permissionResult, ceilingResult] = await Promise.all([
    supabase.from("profiles").select("platform_role, is_suspended").eq("id", userId).maybeSingle(),
    supabase.rpc("community_my_permissions"),
    supabase.rpc("community_highest_position", { target: userId }),
  ]);

  const profile = profileResult.data;
  const isInfluencer = profile?.platform_role === "influencer" && !profile.is_suspended;

  if (permissionResult.error) {
    console.error("[community-settings]", { code: permissionResult.error.code ?? null });
  }
  const permissions = Array.isArray(permissionResult.data)
    ? (permissionResult.data as unknown[]).filter(isPermissionKey)
    : [];

  return {
    userId,
    isInfluencer,
    permissions,
    highestPosition: typeof ceilingResult.data === "number" ? ceilingResult.data : 0,
  };
}

export async function loadSettingsWorkspace(
  supabase: SupabaseClient,
  userId: string,
  searchParams: SearchParams,
  options: { onForbidden: string },
): Promise<SettingsWorkspace> {
  const viewer = await loadViewer(supabase, userId);
  const visible = visibleSections({ isInfluencer: viewer.isInfluencer, permissions: new Set(viewer.permissions) });
  if (visible.length === 0) redirect(options.onForbidden);

  const query = parseSettingsQuery(searchParams, visible);
  const data: SettingsWorkspaceData = {};
  const degraded: string[] = [];

  switch (query.section) {
    case "overview": {
      data.identity = await loadCommunityIdentity(supabase);
      degraded.push(...data.identity.degraded);
      break;
    }
    case "channels": {
      const [structure, roles, overrides] = await Promise.all([
        loadCommunityStructure(supabase),
        loadCommunityRoles(supabase, userId),
        loadChannelOverrides(supabase),
      ]);
      data.structure = { ...structure, roles: roles.roles, overrides: overrides.overrides };
      degraded.push(...roles.degraded, ...overrides.degraded);
      break;
    }
    case "roles": {
      const roles = await loadCommunityRoles(supabase, userId);
      data.roles = roles;
      degraded.push(...roles.degraded);
      break;
    }
    case "automod": {
      const [rules, presets, alerts, roles, structure] = await Promise.all([
        loadAutomodRules(supabase),
        loadAutomodPresets(supabase),
        loadAutomodAlerts(supabase),
        loadCommunityRoles(supabase, userId),
        loadCommunityStructure(supabase),
      ]);
      data.automod = {
        rules: rules.rules,
        presets: presets.presets,
        alerts: alerts.alerts,
        roles: roles.roles,
        channels: structure.channels,
      };
      degraded.push(...rules.degraded, ...presets.degraded, ...alerts.degraded, ...roles.degraded);
      break;
    }
    case "safety": {
      // The acceptance count is a definer RPC rather than a count on the
      // table: the acceptances policy is own-rows, so a moderator reading it
      // directly would always count one, and be told nobody had accepted.
      const [identity, structure, accepted] = await Promise.all([
        loadCommunityIdentity(supabase),
        loadCommunityStructure(supabase),
        supabase.rpc("community_rules_acceptance_count"),
      ]);
      data.safety = {
        identity,
        rulesChannels: structure.channels
          .filter((channel) => channel.type === "rules")
          .map((channel) => ({ id: channel.id, name: channel.name })),
        acceptedCount: typeof accepted.data === "number" ? accepted.data : 0,
      };
      degraded.push(...identity.degraded);
      if (accepted.error) degraded.push("The rules acceptance count could not be read.");
      break;
    }
    case "emoji": {
      const [emojiLoad, roleLoad] = await Promise.all([
        loadCustomEmojis(supabase),
        loadCommunityRoles(supabase, userId),
      ]);
      data.emoji = { emojis: emojiLoad.emojis, roles: roleLoad.roles };
      degraded.push(...emojiLoad.degraded, ...roleLoad.degraded);
      break;
    }
    case "reports": {
      // `?tab=resolved` is the only other queue; anything else reads as open,
      // because a queue nobody can name is a queue nobody can link to.
      const status = query.tab === "resolved" ? "resolved" : "open";
      const page = await loadReportsQueue(supabase, { status, cursor: query.cursor });
      data.reports = { rows: page.reports, nextCursor: page.nextCursor, status };
      degraded.push(...page.degraded);
      break;
    }
    case "bans": {
      const page = await loadActiveBans(supabase);
      data.bans = page.bans;
      degraded.push(...page.degraded);
      break;
    }
    case "audit": {
      const page = await loadAuditPage(supabase, { cursor: query.cursor });
      data.audit = { events: page.events, nextCursor: page.nextCursor, degraded: page.degraded };
      break;
    }
    default:
      break;
  }

  return { viewer, visible, query, data, degraded };
}
