import "server-only";

import { decodeMemberCursor, encodeMemberCursor } from "@/lib/member-operations/cursor";
import type { CosmeticRole, MemberDirectoryPage, MemberDirectoryRow, MemberFilters, MembershipStatus, PlatformMemberRole } from "@/lib/member-operations/types";
import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;
type DatabaseError = { code?: string; message?: string; details?: string | null; hint?: string | null };
type RawMember = {
  id: string;
  full_name: string | null;
  normalized_name: string;
  platform_role: PlatformMemberRole;
  is_suspended: boolean;
  created_at: string;
  membership_status: MembershipStatus;
  joined_at: string | null;
  expires_at: string | null;
  current_tier: number | string;
  is_master: boolean;
  cosmetic_roles: CosmeticRole[] | null;
  current_week_turnover: number | string;
  all_time_turnover: number | string;
};

export class MemberDirectoryError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

function memberDirectoryDatabaseError(error: DatabaseError) {
  // Do not silently turn a missing RPC/table/grant into an empty member list.
  // The client only receives a safe remediation message; the full PostgREST
  // diagnostic stays in the server log for local development and monitoring.
  console.error("[member-directory] search_creator_members failed", {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  if (error.code === "PGRST202" || error.code === "42883" || /search_creator_members/i.test(error.message ?? "")) {
    return new MemberDirectoryError("The member operations database migration has not been applied. Apply 20260814084330_creator_member_operations.sql, then refresh this page.", 503);
  }
  if (error.code === "42501") {
    return new MemberDirectoryError("The database is missing the required member-directory grant. Apply the member operations migration, then refresh this page.", 503);
  }
  return new MemberDirectoryError("Member directory unavailable. Check the server log for the database diagnostic.", 503);
}

export async function authorizeInfluencerApi() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new MemberDirectoryError("Unauthorized", 401);
  const { data: profile, error } = await supabase.from("profiles").select("platform_role,is_suspended").eq("id", user.id).maybeSingle();
  if (error || !profile || profile.is_suspended || profile.platform_role !== "influencer") throw new MemberDirectoryError("Influencer access is required", 403);
  return { supabase, user };
}

export function mapDirectoryRow(row: RawMember): MemberDirectoryRow {
  return {
    id: row.id,
    fullName: row.full_name?.trim() || "Unnamed member",
    platformRole: row.platform_role,
    isSuspended: row.is_suspended,
    accountCreatedAt: row.created_at,
    membershipStatus: row.membership_status,
    joinedAt: row.joined_at,
    expiresAt: row.expires_at,
    currentTier: Number(row.current_tier),
    isMaster: row.is_master,
    cosmeticRoles: Array.isArray(row.cosmetic_roles) ? row.cosmetic_roles : [],
    currentWeekTurnover: Number(row.current_week_turnover ?? 0),
    allTimeTurnover: Number(row.all_time_turnover ?? 0),
  };
}

export async function queryMemberDirectory(supabase: ServerClient, filters: MemberFilters): Promise<MemberDirectoryPage> {
  const cursor = decodeMemberCursor(filters.cursor ?? null);
  if (filters.cursor && !cursor) throw new MemberDirectoryError("Invalid cursor", 400);
  const { data, error } = await supabase.rpc("search_creator_members", {
    search_text: filters.q?.trim() || null,
    status_filter: filters.status || null,
    tier_filter: filters.tier || null,
    platform_role_filter: filters.platformRole || null,
    cosmetic_role_filter: filters.cosmeticRoleId || null,
    after_name: cursor?.normalizedName ?? null,
    after_id: cursor?.id ?? null,
    page_size: 51,
  });
  if (error) throw memberDirectoryDatabaseError(error);
  const rows = (data ?? []) as RawMember[];
  const visibleRows = rows.slice(0, 50);
  const visible = visibleRows.map(mapDirectoryRow);
  const last = visibleRows.at(-1);
  return {
    members: visible,
    nextCursor: rows.length > 50 && last ? encodeMemberCursor({ normalizedName: last.normalized_name, id: last.id }) : null,
  };
}
