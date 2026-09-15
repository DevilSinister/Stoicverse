"use client";

import { useState, useTransition } from "react";
import { Plus, ShieldAlert, Trash2 } from "lucide-react";

import { deleteAutomodRule, toggleAutomodRule } from "@/app/creator/settings/automod-actions";
import { RuleEditor, type RuleDraft } from "@/components/community/settings/automod/RuleEditor";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
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
import type { Notify } from "@/components/ui/toast";

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
 *
 * Monolith, phase 12b. Three things beyond the palette.
 *
 * **The kind menu was a hand-rolled popover with no way out.** An `absolute
 * z-10` list under an `aria-expanded` button: no Escape, no outside-press, no
 * focus move into it and none back out. Opening it and changing your mind meant
 * finding the same button again. It is `ui/popover` now, which portals and
 * brings all four with it.
 *
 * **Its hover fill did not exist.** The items were
 * `hover:bg-surface-container-highest` and the scale stops at `-high`, so
 * Tailwind emitted nothing at all and the menu had no hover state - the silent
 * failure `00 - Shared/Cross-Project Lessons.md` lesson 47 is about, on a menu
 * that was itself hard enough to dismiss that nobody stayed in it long.
 *
 * **`text-amber-300` and `text-red-300` were stock Tailwind.** On the two
 * labels whose whole job is to say how serious something is: "Blocked" beside
 * "Flagged", and the at-capacity warning. They are `status-warn` and
 * `status-danger`, and the rule errors are toasts rather than a line under the
 * list that never cleared.
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
  onNotice: Notify;
}) {
  const [editing, setEditing] = useState<RuleDraft | null>(null);
  const [creating, setCreating] = useState(false);
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
        onNotice(result.error, "error");
      }
    });
  };

  const remove = (rule: AutomodRuleRow) => {
    startTransition(async () => {
      const result = await deleteAutomodRule(rule.id);
      if (result.error) {
        onNotice(result.error, "error");
        return;
      }
      onNotice(`Deleted "${rule.name}".`, "success");
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
      <p className="flex items-start gap-3 rounded-lg border border-dashed border-border-hairline p-4 text-chrome-base text-text-muted">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          You are exempt from every rule here. AutoMod reads a message as it is posted; it never reads messages that are
          already up.
        </span>
      </p>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-title-sm font-medium text-text-strong">
            Rules
            <span className="ml-2 font-mono text-chrome-xs font-normal text-text-muted">
              {rules.length} of {AUTOMOD_LIMITS.rules}
            </span>
          </h3>
          <Popover open={creating} onOpenChange={setCreating}>
            <PopoverTrigger
              render={
                <Button type="button" disabled={!canSave || atCap}>
                  <Plus size={16} aria-hidden="true" />
                  Create rule
                </Button>
              }
            />
            <PopoverContent align="end" className="w-72 gap-1 p-2">
              <ul className="space-y-1">
                {AUTOMOD_KINDS.map((kind) => (
                  <li key={kind}>
                    <button
                      type="button"
                      onClick={() => {
                        setCreating(false);
                        setEditing(draftFor(kind));
                      }}
                      className="focus-ring block w-full rounded-lg p-2 text-left transition-colors hover:bg-surface-raised"
                    >
                      <span className="block text-content-sm font-medium text-text-default">
                        {AUTOMOD_KIND_LABELS[kind].label}
                      </span>
                      <span className="block text-chrome-base text-text-muted">{AUTOMOD_KIND_LABELS[kind].detail}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        </div>

        {atCap ? (
          <p className="mt-2 text-chrome-base text-status-warn">
            You have reached the maximum of {AUTOMOD_LIMITS.rules} rules. Delete one to add another.
          </p>
        ) : null}

        {rules.length === 0 ? (
          <div className="mt-4 rounded-xl border border-border-hairline">
            <EmptyState
              title="No rules yet"
              description="Nothing is being filtered. Create a rule to have AutoMod read messages as they are posted."
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {rules.map((rule) => {
              const enabled = optimistic[rule.id] ?? rule.enabled;
              const exemptCount = rule.exemptions.roleIds.length + rule.exemptions.channelIds.length;
              return (
                <li
                  key={rule.id}
                  className="flex flex-wrap items-start gap-4 rounded-lg border border-border-hairline bg-surface-panel p-4"
                >
                  <Switch
                    checked={enabled}
                    disabled={!canSave}
                    onCheckedChange={(next) => toggle(rule, next)}
                    aria-label={`Enable ${rule.name}`}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-content-sm font-medium text-text-default">{rule.name}</span>
                      <StatusBadge tone="neutral">{AUTOMOD_KIND_LABELS[rule.kind].label}</StatusBadge>
                      {enabled ? null : <span className="text-chrome-xs text-text-muted">Off</span>}
                    </p>
                    <p className="mt-1 text-chrome-base text-text-muted">{describeRule(rule, presets)}</p>
                    {exemptCount > 0 ? (
                      <p className="mt-1 text-chrome-base text-text-muted">
                        {exemptCount} exemption{exemptCount === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="chrome" onClick={() => setEditing({ ...rule })}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-chrome"
                      onClick={() => remove(rule)}
                      disabled={!canSave}
                      aria-label={`Delete ${rule.name}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-title-sm font-medium text-text-strong">Recently caught</h3>
        {alerts.length === 0 ? (
          <p className="mt-3 text-content-sm text-text-muted">Nothing yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {alerts.map((alert) => (
              <li key={alert.id} className="rounded-lg border border-border-hairline p-chrome-x">
                <p className="flex flex-wrap items-center gap-2 text-chrome-base text-text-muted">
                  <span className={alert.blocked ? "font-medium text-status-warn" : "text-text-muted"}>
                    {alert.blocked ? "Blocked" : "Flagged"}
                  </span>
                  <span>{alert.ruleName}</span>
                  <span>{alert.subjectName}</span>
                  {alert.channelName ? <span>{`#${alert.channelName}`}</span> : null}
                  <time dateTime={alert.createdAt}>{new Date(alert.createdAt).toLocaleString()}</time>
                </p>
                <p className="mt-1 break-words text-content-sm text-text-default">{alert.bodyExcerpt}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
