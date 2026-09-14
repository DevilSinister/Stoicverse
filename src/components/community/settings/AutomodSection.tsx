"use client";

import { useState, useTransition } from "react";
import { Plus, ShieldAlert, Trash2 } from "lucide-react";

import { deleteAutomodRule, toggleAutomodRule } from "@/app/creator/settings/automod-actions";
import { RuleEditor, type RuleDraft } from "@/components/community/settings/automod/RuleEditor";
import {
  AUTOMOD_KIND_LABELS,
  AUTOMOD_KINDS,
  AUTOMOD_LIMITS,
  AUTOMOD_RULE_DEFAULTS,
  describeRule,
  type AutomodKind,
  type AutomodPreset,
} from "@/lib/community-settings/automod";
import type { AutomodAlertRow, AutomodRuleRow } from "@/lib/community-settings/governance";

function draftFor(kind: AutomodKind): RuleDraft {
  return {
    id: null,
    name: AUTOMOD_KIND_LABELS[kind].label,
    kind,
    enabled: true,
    keywords: [],
    matchMode: "word",
    presetKey: null,
    mentionLimit: null,
    allowedDomains: [],
    duplicateCount: null,
    duplicateWindowSeconds: null,
    actionBlock: true,
    alertChannelId: null,
    timeoutSeconds: null,
    ...AUTOMOD_RULE_DEFAULTS[kind],
    exemptions: { roleIds: [], channelIds: [] },
  };
}

/**
 * The AutoMod section: the rule list, the editor, and what the rules have
 * actually caught.
 *
 * Alerts sit next to the rules deliberately. A filter whose output nobody can
 * see is a filter nobody can tell is misconfigured, and the common AutoMod
 * failure is a rule quietly catching ordinary conversation.
 */
export function AutomodSection({
  rules,
  presets,
  alerts,
  roles,
  channels,
  canSave,
  onNotice,
}: {
  rules: AutomodRuleRow[];
  presets: AutomodPreset[];
  alerts: AutomodAlertRow[];
  roles: { id: string; name: string }[];
  channels: { id: string; name: string }[];
  canSave: boolean;
  onNotice: (message: string) => void;
}) {
  const [editing, setEditing] = useState<RuleDraft | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Optimistic, with a snap-back: the switch is the one control an operator
  // flicks while reading down the list, and a round trip per flick reads as lag.
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const atCap = rules.length >= AUTOMOD_LIMITS.rules;

  const toggle = (rule: AutomodRuleRow, next: boolean) => {
    setOptimistic((current) => ({ ...current, [rule.id]: next }));
    startTransition(async () => {
      const result = await toggleAutomodRule(rule.id, next);
      if (result.error) {
        setOptimistic((current) => ({ ...current, [rule.id]: !next }));
        setError(result.error);
      }
    });
  };

  const remove = (rule: AutomodRuleRow) => {
    startTransition(async () => {
      const result = await deleteAutomodRule(rule.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      onNotice(`Deleted "${rule.name}".`);
    });
  };

  if (editing) {
    return (
      <RuleEditor
        rule={editing}
        presets={presets}
        roles={roles}
        channels={channels}
        canSave={canSave}
        onClose={() => setEditing(null)}
        onNotice={onNotice}
      />
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <p className="flex items-start gap-3 rounded-lg border border-dashed border-surgical-steel p-4 text-xs leading-5 text-fog-muted">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          You are exempt from every rule here. AutoMod reads a message as it is posted; it never reads messages that
          are already up.
        </span>
      </p>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-on-surface">
            Rules
            <span className="ml-2 text-xs font-normal text-fog-muted">
              {rules.length} of {AUTOMOD_LIMITS.rules}
            </span>
          </h3>
          <div className="relative">
            <button
              type="button"
              onClick={() => setCreating((open) => !open)}
              disabled={!canSave || atCap}
              aria-expanded={creating}
              className="focus-ring inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Plus size={16} aria-hidden="true" />
              Create rule
            </button>
            {creating ? (
              <ul className="absolute right-0 z-10 mt-2 w-72 space-y-1 rounded-xl border border-surgical-steel bg-surface-container-high p-2 shadow-xl">
                {AUTOMOD_KINDS.map((kind) => (
                  <li key={kind}>
                    <button
                      type="button"
                      onClick={() => {
                        setCreating(false);
                        setEditing(draftFor(kind));
                      }}
                      className="focus-ring block w-full rounded-lg p-2 text-left text-sm hover:bg-surface-container-highest"
                    >
                      <span className="font-semibold text-on-surface">{AUTOMOD_KIND_LABELS[kind].label}</span>
                      <span className="block text-xs text-fog-muted">{AUTOMOD_KIND_LABELS[kind].detail}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        {atCap ? (
          <p className="mt-2 text-xs text-amber-300">
            You have reached the maximum of {AUTOMOD_LIMITS.rules} rules. Delete one to add another.
          </p>
        ) : null}

        {rules.length === 0 ? (
          <p className="mt-4 rounded-lg border border-surgical-steel p-6 text-sm text-fog-muted">
            No rules yet. Nothing is being filtered.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {rules.map((rule) => {
              const enabled = optimistic[rule.id] ?? rule.enabled;
              const exemptCount = rule.exemptions.roleIds.length + rule.exemptions.channelIds.length;
              return (
                <li
                  key={rule.id}
                  className="flex flex-wrap items-start gap-4 rounded-lg border border-surgical-steel bg-surface-container-low p-4"
                >
                  <input
                    type="checkbox"
                    role="switch"
                    checked={enabled}
                    disabled={!canSave}
                    onChange={(event) => toggle(rule, event.target.checked)}
                    aria-label={`Enable ${rule.name}`}
                    className="focus-ring mt-1 size-4"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-on-surface">{rule.name}</span>
                      <span className="rounded-md border border-surgical-steel px-2 py-0.5 text-[11px] text-fog-muted">
                        {AUTOMOD_KIND_LABELS[rule.kind].label}
                      </span>
                      {enabled ? null : <span className="text-[11px] text-fog-muted">Off</span>}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-fog-muted">{describeRule(rule, presets)}</p>
                    {exemptCount > 0 ? (
                      <p className="mt-1 text-xs text-fog-muted">
                        {exemptCount} exemption{exemptCount === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing({ ...rule })}
                      className="focus-ring inline-flex h-9 items-center rounded-lg border border-surgical-steel px-3 text-xs font-semibold text-on-surface"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(rule)}
                      disabled={!canSave}
                      aria-label={`Delete ${rule.name}`}
                      className="focus-ring inline-flex size-9 items-center justify-center rounded-lg border border-surgical-steel text-fog-muted disabled:opacity-50"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {error}
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-on-surface">Recently caught</h3>
        {alerts.length === 0 ? (
          <p className="mt-3 text-sm text-fog-muted">Nothing yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {alerts.map((alert) => (
              <li key={alert.id} className="rounded-lg border border-surgical-steel p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 text-xs text-fog-muted">
                  <span className={alert.blocked ? "text-amber-300" : "text-fog-muted"}>
                    {alert.blocked ? "Blocked" : "Flagged"}
                  </span>
                  <span>{alert.ruleName}</span>
                  <span>{alert.subjectName}</span>
                  {alert.channelName ? <span>{`#${alert.channelName}`}</span> : null}
                  <time dateTime={alert.createdAt}>{new Date(alert.createdAt).toLocaleString()}</time>
                </p>
                <p className="mt-1 break-words text-on-surface-variant">{alert.bodyExcerpt}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
