import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CaseKind, ReportReason, ReportStatus } from "@/lib/community-settings/model";

export const MODERATION_PAGE_SIZE = 25;

export type ReportRow = {
  id: string;
  postId: string;
  channelId: string;
  channelName: string;
  postBody: string;
  postAuthorId: string | null;
  postAuthorName: string;
  reporterName: string;
  reasonKind: ReportReason;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
};

export type CaseRow = {
  id: string;
  caseNumber: number;
  kind: CaseKind;
  reason: string | null;
  durationSeconds: number | null;
  expiresAt: string | null;
  revokedAt: string | null;
  source: "manual" | "automod";
  actorName: string;
  createdAt: string;
};

export type BanRow = {
  caseId: string;
  caseNumber: number;
  memberId: string;
  memberName: string;
  reason: string | null;
  actorName: string;
  createdAt: string;
};

/**
 * One page of the reports queue, newest first.
 *
 * Keyset on `created_at`, not OFFSET: the table only grows, and a moderator
 * working through a backlog would have an offset walk re-read everything they
 * had already dealt with.
 */
export async function loadReportsQueue(
  supabase: SupabaseClient,
  options: { status?: ReportStatus; cursor?: string } = {},
): Promise<{ reports: ReportRow[]; nextCursor: string | null; degraded: string[] }> {
  const { data, error } = await supabase.rpc("community_reports_queue", {
    queue_status: options.status ?? "open",
    before: options.cursor ?? null,
    page_size: MODERATION_PAGE_SIZE + 1,
  });

  if (error) {
    console.error("[community-settings]", { code: error.code ?? null });
    return {
      reports: [],
      nextCursor: null,
      degraded: ["The reports queue could not be read. It needs migration 20260912030000."],
    };
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  // One row over the page size answers "is there another page" without a
  // second count query.
  const hasMore = rows.length > MODERATION_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, MODERATION_PAGE_SIZE) : rows;
  const last = page[page.length - 1];

  return {
    reports: page.map((row) => ({
      id: String(row.id),
      postId: String(row.post_id),
      channelId: String(row.channel_id),
      channelName: String(row.channel_name ?? ""),
      postBody: String(row.post_body ?? ""),
      postAuthorId: row.post_author_id ? String(row.post_author_id) : null,
      postAuthorName: String(row.post_author_name ?? "Deleted member"),
      reporterName: String(row.reporter_name ?? "Deleted member"),
      reasonKind: row.reason_kind as ReportReason,
      details: row.details ? String(row.details) : null,
      status: row.status as ReportStatus,
      createdAt: String(row.created_at),
    })),
    nextCursor: hasMore && last ? String(last.created_at) : null,
    degraded: [],
  };
}

/** One member's case history, newest first. */
export async function loadMemberCases(
  supabase: SupabaseClient,
  memberId: string,
  cursor?: string,
): Promise<{ cases: CaseRow[]; nextCursor: string | null; degraded: string[] }> {
  const { data, error } = await supabase.rpc("community_member_cases", {
    target: memberId,
    before: cursor ?? null,
    page_size: MODERATION_PAGE_SIZE + 1,
  });

  if (error) {
    console.error("[community-settings]", { code: error.code ?? null });
    return { cases: [], nextCursor: null, degraded: ["That member's case history could not be read."] };
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const hasMore = rows.length > MODERATION_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, MODERATION_PAGE_SIZE) : rows;
  const last = page[page.length - 1];

  return {
    cases: page.map((row) => ({
      id: String(row.id),
      caseNumber: Number(row.case_number),
      kind: row.kind as CaseKind,
      reason: row.reason ? String(row.reason) : null,
      durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
      expiresAt: row.expires_at ? String(row.expires_at) : null,
      revokedAt: row.revoked_at ? String(row.revoked_at) : null,
      source: row.source === "automod" ? "automod" : "manual",
      actorName: String(row.actor_name ?? "AutoMod"),
      createdAt: String(row.created_at),
    })),
    nextCursor: hasMore && last ? String(last.created_at) : null,
    degraded: [],
  };
}

/**
 * Every ban currently in force.
 *
 * Read from the table rather than through an RPC: the `community_mod_cases`
 * read policy already limits this to someone holding `moderate_members` or
 * `ban_members`, so a second gate would only be a second thing to keep in step.
 */
export async function loadActiveBans(supabase: SupabaseClient): Promise<{ bans: BanRow[]; degraded: string[] }> {
  const { data, error } = await supabase
    .from("community_mod_cases")
    .select("id,case_number,subject_id,reason,created_at,actor_id")
    .eq("kind", "ban")
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[community-settings]", { code: error.code ?? null });
    return { bans: [], degraded: ["The ban list could not be read. It needs migration 20260912030000."] };
  }

  const rows = data ?? [];
  const ids = [
    ...new Set(rows.flatMap((row) => [row.subject_id, row.actor_id]).filter((id): id is string => Boolean(id))),
  ];
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id,full_name").in("id", ids)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameById = new Map((profiles ?? []).map((row) => [row.id, row.full_name]));

  return {
    bans: rows.map((row) => ({
      caseId: row.id,
      caseNumber: row.case_number,
      memberId: row.subject_id,
      memberName: nameById.get(row.subject_id)?.trim() || "Deleted member",
      reason: row.reason,
      actorName: row.actor_id ? nameById.get(row.actor_id)?.trim() || "Unknown moderator" : "AutoMod",
      createdAt: row.created_at,
    })),
    degraded: [],
  };
}
