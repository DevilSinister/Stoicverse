import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import type { CommunityCategory, CommunityChannel } from "@/components/community/types";
import {
  loadAuditPage,
  loadBlockedWords,
  loadCommunityRoles,
  type AuditEvent,
  type RoleWithPermissions,
} from "@/lib/community-settings/governance";
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/community-settings/permissions";
import {
  parseSettingsQuery,
  visibleSections,
  type SettingsQuery,
  type SettingsSection,
} from "@/lib/community-settings/sections";
import { loadCommunityIdentity, type IdentityLoad } from "@/lib/community-settings/server";
import { loadCommunityStructure } from "@/lib/community-settings/structure";

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
};

export type SettingsWorkspaceData = {
  identity?: IdentityLoad;
  structure?: { categories: CommunityCategory[]; channels: CommunityChannel[] };
  roles?: RoleWithPermissions[];
  blockedPhrases?: { id: string; phrase: string }[];
  audit?: { events: AuditEvent[]; nextCursor: string | null; degraded: string[] };
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
 * Until the role resolver ships, only the influencer holds settings
 * permissions. Moderators keep their in-channel baseline and see no settings.
 */
async function loadViewer(supabase: SupabaseClient, userId: string): Promise<SettingsViewer> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("platform_role, is_suspended")
    .eq("id", userId)
    .maybeSingle();
  const isInfluencer = profile?.platform_role === "influencer" && !profile.is_suspended;
  return {
    userId,
    isInfluencer,
    permissions: isInfluencer ? [...PERMISSION_KEYS] : [],
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
      data.structure = await loadCommunityStructure(supabase);
      break;
    }
    case "roles": {
      const roles = await loadCommunityRoles(supabase);
      data.roles = roles.roles;
      degraded.push(...roles.degraded);
      break;
    }
    case "safety": {
      const [identity, blocked] = await Promise.all([loadCommunityIdentity(supabase), loadBlockedWords(supabase)]);
      data.identity = identity;
      data.blockedPhrases = blocked.phrases;
      degraded.push(...identity.degraded, ...blocked.degraded);
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
