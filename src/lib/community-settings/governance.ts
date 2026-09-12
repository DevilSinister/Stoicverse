import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AutomodExemptions, AutomodPreset, AutomodRule } from "@/lib/community-settings/automod";

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

export type AutomodRuleRow = AutomodRule & { id: string; exemptions: AutomodExemptions };

export type AutomodAlertRow = {
  id: string;
  ruleName: string;
  subjectName: string;
  channelName: string | null;
  blocked: boolean;
  bodyExcerpt: string;
  /** ISO 8601. Formatted in the client, which knows the viewer's locale. */
  createdAt: string;
};

export const AUTOMOD_ALERT_PAGE_SIZE = 20;

/**
 * Every rule with its exemptions attached.
 *
 * Two queries rather than one embedded select: `community_automod_exemptions`
 * is read through its own policy, and an embed would make a policy failure on
 * the child look like an empty rule list rather than a read that was refused.
 */
export async function loadAutomodRules(
  supabase: SupabaseClient,
): Promise<{ rules: AutomodRuleRow[]; degraded: string[] }> {
  const [ruleResult, exemptionResult] = await Promise.all([
    supabase
      .from("community_automod_rules")
      .select(
        "id,name,kind,enabled,keywords,match_mode,preset_key,mention_limit,allowed_domains,duplicate_count,duplicate_window_seconds,action_block,alert_channel_id,timeout_seconds",
      )
      .order("created_at"),
    supabase.from("community_automod_exemptions").select("rule_id,role_id,channel_id"),
  ]);

  if (ruleResult.error) {
    console.error("[community-settings]", { code: ruleResult.error.code ?? null });
    return { rules: [], degraded: ["The AutoMod rules could not be read. They need migration 20260912040000."] };
  }

  const degraded: string[] = [];
  const exemptions = new Map<string, AutomodExemptions>();
  if (exemptionResult.error) {
    console.error("[community-settings]", { code: exemptionResult.error.code ?? null });
    degraded.push("Rule exemptions could not be read, so every rule is shown as applying to everyone.");
  } else {
    for (const row of exemptionResult.data ?? []) {
      const entry = exemptions.get(row.rule_id) ?? { roleIds: [], channelIds: [] };
      if (row.role_id) entry.roleIds.push(row.role_id);
      if (row.channel_id) entry.channelIds.push(row.channel_id);
      exemptions.set(row.rule_id, entry);
    }
  }

  const rules = (ruleResult.data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    kind: row.kind as AutomodRule["kind"],
    enabled: row.enabled as boolean,
    keywords: (row.keywords as string[] | null) ?? [],
    matchMode: (row.match_mode as AutomodRule["matchMode"]) ?? "word",
    presetKey: (row.preset_key as string | null) ?? null,
    mentionLimit: (row.mention_limit as number | null) ?? null,
    allowedDomains: (row.allowed_domains as string[] | null) ?? [],
    duplicateCount: (row.duplicate_count as number | null) ?? null,
    duplicateWindowSeconds: (row.duplicate_window_seconds as number | null) ?? null,
    actionBlock: row.action_block as boolean,
    alertChannelId: (row.alert_channel_id as string | null) ?? null,
    timeoutSeconds: (row.timeout_seconds as number | null) ?? null,
    exemptions: exemptions.get(row.id as string) ?? { roleIds: [], channelIds: [] },
  }));

  return { rules, degraded };
}

/** The curated lists. `phrases` is counted rather than returned: the page shows a count. */
export async function loadAutomodPresets(
  supabase: SupabaseClient,
): Promise<{ presets: AutomodPreset[]; degraded: string[] }> {
  const { data, error } = await supabase
    .from("community_automod_presets")
    .select("key,label,description,phrases")
    .order("label");

  if (error) {
    console.error("[community-settings]", { code: error.code ?? null });
    return { presets: [], degraded: ["The preset lists could not be read."] };
  }

  return {
    presets: (data ?? []).map((row) => ({
      key: row.key as string,
      label: row.label as string,
      description: row.description as string,
      phraseCount: ((row.phrases as string[] | null) ?? []).length,
    })),
    degraded: [],
  };
}

/**
 * The most recent matches, so "is this rule doing anything" has an answer.
 *
 * Names are looked up in separate queries rather than through an embed, the
 * same way the audit page does it: an embedded select types the child as an
 * array and, more importantly, a policy refusal on the child reads as a null
 * name rather than as a read that was denied.
 */
export async function loadAutomodAlerts(
  supabase: SupabaseClient,
): Promise<{ alerts: AutomodAlertRow[]; degraded: string[] }> {
  const { data, error } = await supabase
    .from("community_automod_alerts")
    .select("id,rule_name,subject_id,channel_id,blocked,body_excerpt,created_at")
    .order("created_at", { ascending: false })
    .limit(AUTOMOD_ALERT_PAGE_SIZE);

  if (error) {
    console.error("[community-settings]", { code: error.code ?? null });
    return { alerts: [], degraded: ["Recent AutoMod activity could not be read."] };
  }

  const rows = data ?? [];
  const subjectIds = [...new Set(rows.map((row) => row.subject_id).filter((id): id is string => Boolean(id)))];
  const channelIds = [...new Set(rows.map((row) => row.channel_id).filter((id): id is string => Boolean(id)))];

  const [profileResult, channelResult] = await Promise.all([
    subjectIds.length
      ? supabase.from("profiles").select("id,full_name").in("id", subjectIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[], error: null }),
    channelIds.length
      ? supabase.from("channels").select("id,name").in("id", channelIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ]);

  const names = new Map((profileResult.data ?? []).map((row) => [row.id, row.full_name]));
  const channels = new Map((channelResult.data ?? []).map((row) => [row.id, row.name]));

  return {
    alerts: rows.map((row) => ({
      id: row.id as string,
      ruleName: row.rule_name as string,
      subjectName: names.get(row.subject_id as string)?.trim() || "A member",
      channelName: channels.get(row.channel_id as string) ?? null,
      blocked: row.blocked as boolean,
      bodyExcerpt: row.body_excerpt as string,
      createdAt: row.created_at as string,
    })),
    degraded: [],
  };
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
