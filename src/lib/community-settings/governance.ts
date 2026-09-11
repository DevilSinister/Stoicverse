import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parsePermissionConfig, type PermissionConfig } from "@/lib/community-settings/model";

export type RoleWithPermissions = {
  id: string;
  name: string;
  color: string | null;
  priority: number;
  permissions: PermissionConfig;
  /** Shown beside every role, so no grant is made blind. */
  memberCount: number;
};

export type AuditEvent = {
  id: string;
  action: string;
  reason: string | null;
  previousBody: string | null;
  /** ISO 8601. Formatted in the client, which knows the viewer's locale. */
  createdAt: string;
  actorName: string;
  channelName: string | null;
};

export const AUDIT_PAGE_SIZE = 25;

/**
 * Roles with their grants and how many people hold each.
 *
 * "Effective for N members" is not decoration: a permission grid with no
 * headcount invites granting `delete_others` to a role that turns out to have
 * forty people in it.
 */
export async function loadCommunityRoles(
  supabase: SupabaseClient,
): Promise<{ roles: RoleWithPermissions[]; degraded: string[] }> {
  const [roleResult, assignmentResult] = await Promise.all([
    supabase
      .from("cosmetic_roles")
      .select("id,name,color,priority,permission_config")
      .order("priority", { ascending: false }),
    supabase.from("cosmetic_role_assignments").select("role_id"),
  ]);

  if (roleResult.error) {
    console.error("[community-settings]", { code: roleResult.error.code ?? null });
    return { roles: [], degraded: ["Roles could not be read."] };
  }

  const counts = new Map<string, number>();
  if (assignmentResult.error) {
    console.error("[community-settings]", { code: assignmentResult.error.code ?? null });
  } else {
    for (const row of assignmentResult.data ?? []) {
      counts.set(row.role_id, (counts.get(row.role_id) ?? 0) + 1);
    }
  }

  return {
    roles: (roleResult.data ?? []).map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      priority: role.priority,
      permissions: parsePermissionConfig(role.permission_config),
      memberCount: counts.get(role.id) ?? 0,
    })),
    // A failed headcount must not hide the roles themselves, but it must be
    // said out loud rather than rendered as "0 members".
    degraded: assignmentResult.error ? ["Member counts per role could not be read."] : [],
  };
}

export async function loadBlockedWords(
  supabase: SupabaseClient,
): Promise<{ phrases: { id: string; phrase: string }[]; degraded: string[] }> {
  const { data, error } = await supabase.from("community_blocked_words").select("id,phrase").order("phrase");

  if (error) {
    console.error("[community-settings]", { code: error.code ?? null });
    return { phrases: [], degraded: ["The blocked word list could not be read."] };
  }
  return { phrases: data ?? [], degraded: [] };
}

/**
 * One page of the moderation audit trail, newest first.
 *
 * Keyset pagination on `created_at`, not OFFSET: the table only grows, and an
 * offset walk re-reads everything it has already skipped.
 */
export async function loadAuditPage(
  supabase: SupabaseClient,
  options: { cursor?: string; action?: string } = {},
): Promise<{ events: AuditEvent[]; nextCursor: string | null; degraded: string[] }> {
  let query = supabase
    .from("community_moderation_events")
    .select("id,action,reason,previous_body,created_at,actor_id,channel_id")
    .order("created_at", { ascending: false })
    .limit(AUDIT_PAGE_SIZE + 1);

  if (options.action) query = query.eq("action", options.action);
  if (options.cursor) query = query.lt("created_at", options.cursor);

  const { data, error } = await query;
  if (error) {
    console.error("[community-settings]", { code: error.code ?? null });
    return { events: [], nextCursor: null, degraded: ["The audit log could not be read."] };
  }

  const rows = data ?? [];
  // One row over the page size tells us whether another page exists without a
  // second count query.
  const hasMore = rows.length > AUDIT_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, AUDIT_PAGE_SIZE) : rows;

  const actorIds = [...new Set(page.map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];
  const channelIds = [...new Set(page.map((row) => row.channel_id).filter((id): id is string => Boolean(id)))];

  const [profileResult, channelResult] = await Promise.all([
    actorIds.length
      ? supabase.from("profiles").select("id,full_name").in("id", actorIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[], error: null }),
    channelIds.length
      ? supabase.from("channels").select("id,name").in("id", channelIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ]);

  const nameById = new Map((profileResult.data ?? []).map((row) => [row.id, row.full_name]));
  const channelById = new Map((channelResult.data ?? []).map((row) => [row.id, row.name]));

  return {
    events: page.map((row) => ({
      id: row.id,
      action: row.action,
      reason: row.reason,
      previousBody: row.previous_body,
      createdAt: row.created_at,
      actorName: nameById.get(row.actor_id)?.trim() || "Unknown member",
      channelName: row.channel_id ? channelById.get(row.channel_id) ?? null : null,
    })),
    nextCursor: hasMore ? page[page.length - 1]?.created_at ?? null : null,
    degraded: [],
  };
}
