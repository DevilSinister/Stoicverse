"use client";

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";

import { saveAutomodRule, setAutomodExemptions, testAutomodBody } from "@/app/creator/settings/automod-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nativeSelectClass } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AUTOMOD_KIND_LABELS,
  AUTOMOD_LIMITS,
  formatDuration,
  KEYWORD_WILDCARD_BOUND,
  matchesKeywordRule,
  parseKeyword,
  TIMEOUT_STOPS,
  type AutomodExemptions,
  type AutomodPreset,
  type AutomodRule,
} from "@/lib/community-settings/automod";
import { cn } from "@/lib/utils";
import type { Notify } from "@/components/ui/toast";

export type RuleDraft = AutomodRule & { exemptions: AutomodExemptions };

const labelClass = "terminal-label block";

/** A checkbox or radio and its label, as one 44px row rather than a 16px box. */
const choiceRow = "flex min-h-11 cursor-pointer items-center gap-2 text-content-sm text-text-default";

/**
 * One editor for all five kinds.
 *
 * The kind is fixed once a rule exists: changing it would reinterpret settings
 * that do not carry over, and the database's per-kind CHECK rejects the
 * half-converted shape anyway.
 *
 * Monolith, phase 12b. Four hand-written class constants - `label`, `field`,
 * `numberField` and `textArea` - are `terminal-label`, `ui/input`,
 * `ui/textarea` and `ui/select`'s `nativeSelectClass`. The save error was a
 * `text-red-300` paragraph sitting beside the Save button, which is both a
 * stock colour and the wrong place: it is the outcome of an action, so it is a
 * toast, and the button no longer moves when a save fails.
 *
 * The live preview's hit marker was `text-amber-300`; it is `status-warn`, the
 * token that means "this is worth your attention", and it now agrees with the
 * "Blocked" label in the list this editor returns to.
 *
 * The radios and checkboxes stay native. Nothing here is submitted as a form -
 * `save()` builds the draft object itself - so there is no form contract to
 * preserve, and `ui/radio-group` has no call site in the product to have
 * exercised one. What they did need was a hit target: every one of them was a
 * 16px box on a line of text.
 */
export function RuleEditor({
  rule,
  presets,
  roles,
  channels,
  canSave,
  onClose,
  onNotice,
}: {
  rule: RuleDraft;
  presets: AutomodPreset[];
  roles: { id: string; name: string }[];
  channels: { id: string; name: string }[];
  canSave: boolean;
  onClose: () => void;
  onNotice: Notify;
}) {
  const [draft, setDraft] = useState<RuleDraft>(rule);
  const [keywordText, setKeywordText] = useState(rule.keywords.join("\n"));
  const [domainText, setDomainText] = useState(rule.allowedDomains.join("\n"));
  const [sample, setSample] = useState("");
  const [serverResult, setServerResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof RuleDraft>(key: K, next: RuleDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: next }));

  const splitLines = (text: string) => [
    ...new Set(
      text
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];

  const keywords = splitLines(keywordText);

  // The live preview runs the mirror in automod.ts; "Check every saved rule"
  // runs the database. A parity test asserts the two compile identically, and
  // the server check is here so the operator can confirm that rather than take
  // it on trust.
  const localHit =
    draft.kind === "keyword" && sample !== "" && keywords.length > 0
      ? matchesKeywordRule(sample, keywords, draft.matchMode)
      : false;

  const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];

  const save = () =>
    startTransition(async () => {
      let keywordList: string[] = [];
      try {
        if (draft.kind === "keyword") keywordList = keywords.map(parseKeyword);
      } catch (issue) {
        onNotice(issue instanceof Error ? issue.message : "That rule could not be saved.", "error");
        return;
      }

      const result = await saveAutomodRule({
        ...draft,
        keywords: keywordList,
        allowedDomains: splitLines(domainText),
        timeoutSeconds: draft.timeoutSeconds ?? "",
      });
      if (result.error) {
        onNotice(result.error, "error");
        return;
      }

      const id = result.id ?? draft.id;
      if (id) {
        const exempt = await setAutomodExemptions(id, draft.exemptions.roleIds, draft.exemptions.channelIds);
        if (exempt.error) {
          onNotice(exempt.error, "error");
          return;
        }
      }
      onNotice(`Saved "${draft.name}".`, "success");
      onClose();
    });

  const testOnServer = () =>
    startTransition(async () => {
      const result = await testAutomodBody(sample);
      if (result.error) {
        setServerResult(result.error);
        return;
      }
      setServerResult(
        result.ruleName
          ? `The database caught this with "${result.ruleName}" and would ${result.wouldBlock ? "block" : "allow"} it.`
          : "The database found no enabled rule matching this.",
      );
    });

  return (
    <div className="space-y-6 rounded-xl border border-border-hairline bg-surface-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-title-sm font-medium text-text-strong">{AUTOMOD_KIND_LABELS[draft.kind].label}</p>
          <p className="text-chrome-base text-text-muted">{AUTOMOD_KIND_LABELS[draft.kind].detail}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close editor">
          <X size={16} aria-hidden="true" />
        </Button>
      </div>

      <div>
        <label htmlFor="automod-name" className={labelClass}>
          Rule name
        </label>
        <Input
          id="automod-name"
          value={draft.name}
          maxLength={AUTOMOD_LIMITS.name.max}
          onChange={(event) => set("name", event.target.value)}
          className="mt-2"
        />
      </div>

      {draft.kind === "keyword" ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="automod-keywords" className={labelClass}>
              Words and phrases
            </label>
            <Textarea
              id="automod-keywords"
              rows={5}
              value={keywordText}
              onChange={(event) => setKeywordText(event.target.value)}
              className="mt-2"
            />
            <p className="mt-2 text-chrome-base text-text-muted">
              One per line or comma-separated. <code>*</code> matches up to {KEYWORD_WILDCARD_BOUND} more characters, so{" "}
              <code>scam*</code> catches <code>scammer</code>. No other patterns are accepted — a regular expression
              typed here would run against every message anyone sends.
              <span className="mt-1 block font-mono text-chrome-xs">
                {keywords.length} of {AUTOMOD_LIMITS.keywords.max}
              </span>
            </p>
          </div>
          <fieldset>
            <legend className={labelClass}>Match</legend>
            <div className="mt-2 flex gap-6">
              {(["word", "substring"] as const).map((mode) => (
                <label key={mode} className={choiceRow}>
                  <input
                    type="radio"
                    name="matchMode"
                    checked={draft.matchMode === mode}
                    onChange={() => set("matchMode", mode)}
                    className="size-4 shrink-0 accent-primary"
                  />
                  {mode === "word" ? "Whole words" : "Any substring"}
                </label>
              ))}
            </div>
            <p className="mt-2 text-chrome-base text-text-muted">
              Substring catches more by accident: <code>ass</code> would match <code>classic</code>.
            </p>
          </fieldset>
        </div>
      ) : null}

      {draft.kind === "preset" ? (
        <fieldset>
          <legend className={labelClass}>Preset list</legend>
          <div className="mt-2 space-y-2">
            {presets.map((preset) => (
              <label
                key={preset.key}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-chrome-x transition-colors ${
                  draft.presetKey === preset.key ? "border-primary" : "border-border-hairline"
                }`}
              >
                <input
                  type="radio"
                  name="presetKey"
                  checked={draft.presetKey === preset.key}
                  onChange={() => set("presetKey", preset.key)}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block text-content-sm font-medium text-text-default">{preset.label}</span>
                  <span className="block text-chrome-base text-text-muted">{preset.description}</span>
                  <span className="block font-mono text-chrome-xs text-text-muted">{preset.phraseCount} phrases</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {draft.kind === "mention_spam" ? (
        <div>
          <label htmlFor="automod-mentions" className={labelClass}>
            Mention limit
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Input
              id="automod-mentions"
              type="number"
              min={AUTOMOD_LIMITS.mentionLimit.min}
              max={AUTOMOD_LIMITS.mentionLimit.max}
              value={draft.mentionLimit ?? AUTOMOD_LIMITS.mentionLimit.min}
              onChange={(event) => set("mentionLimit", Number(event.target.value))}
              className="w-28"
            />
            <span className="text-content-sm text-text-muted">mentions in one message before it is caught.</span>
          </div>
        </div>
      ) : null}

      {draft.kind === "link_filter" ? (
        <div>
          <label htmlFor="automod-domains" className={labelClass}>
            Allowed domains
          </label>
          <Textarea
            id="automod-domains"
            rows={4}
            value={domainText}
            onChange={(event) => setDomainText(event.target.value)}
            className="mt-2"
          />
          <p className="mt-2 text-chrome-base text-text-muted">
            One hostname per line. A domain allows its subdomains, so <code>youtube.com</code> covers{" "}
            <code>m.youtube.com</code>. Leave this empty to catch every link.
          </p>
        </div>
      ) : null}

      {draft.kind === "duplicate_spam" ? (
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="automod-count" className={labelClass}>
              Repeats
            </label>
            <Input
              id="automod-count"
              type="number"
              min={AUTOMOD_LIMITS.duplicateCount.min}
              max={AUTOMOD_LIMITS.duplicateCount.max}
              value={draft.duplicateCount ?? AUTOMOD_LIMITS.duplicateCount.min}
              onChange={(event) => set("duplicateCount", Number(event.target.value))}
              className="mt-2 w-28"
            />
          </div>
          <div>
            <label htmlFor="automod-window" className={labelClass}>
              Within (seconds)
            </label>
            <Input
              id="automod-window"
              type="number"
              min={AUTOMOD_LIMITS.duplicateWindowSeconds.min}
              max={AUTOMOD_LIMITS.duplicateWindowSeconds.max}
              value={draft.duplicateWindowSeconds ?? AUTOMOD_LIMITS.duplicateWindowSeconds.min}
              onChange={(event) => set("duplicateWindowSeconds", Number(event.target.value))}
              className="mt-2 w-28"
            />
          </div>
        </div>
      ) : null}

      <fieldset className="space-y-3 border-t border-border-hairline pt-5">
        <legend className={labelClass}>What happens</legend>
        <label className="flex cursor-pointer items-start gap-3 text-content-sm text-text-default">
          <input
            type="checkbox"
            checked={draft.actionBlock}
            onChange={(event) => {
              const next = event.target.checked;
              // A timeout without a block would remove a person while their
              // message stood. The database rejects that pairing; the form
              // should never reach it.
              setDraft((current) => ({
                ...current,
                actionBlock: next,
                timeoutSeconds: next ? current.timeoutSeconds : null,
              }));
            }}
            className="mt-1 size-4 shrink-0 accent-primary"
          />
          <span className="min-w-0">
            Block the message
            <span className="block text-chrome-base text-text-muted">
              Off means the message stands and moderators are notified instead.
            </span>
          </span>
        </label>

        <div>
          <label htmlFor="automod-timeout" className={labelClass}>
            Also time the member out
          </label>
          <select
            id="automod-timeout"
            value={draft.timeoutSeconds ?? ""}
            disabled={!draft.actionBlock}
            onChange={(event) => set("timeoutSeconds", event.target.value === "" ? null : Number(event.target.value))}
            className={cn(nativeSelectClass, "mt-2")}
          >
            <option value="">No timeout</option>
            {TIMEOUT_STOPS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {formatDuration(seconds)}
              </option>
            ))}
          </select>
          {draft.actionBlock ? null : (
            <p className="mt-2 text-chrome-base text-text-muted">A timeout needs the message blocked as well.</p>
          )}
        </div>
      </fieldset>

      <fieldset className="border-t border-border-hairline pt-5">
        <legend className={labelClass}>Exempt from this rule</legend>
        <p className="mt-2 text-chrome-base text-text-muted">You are exempt from every rule already.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-chrome-base font-medium text-text-muted">Roles</p>
            <div className="mt-2">
              {roles.map((role) => (
                <label key={role.id} className={choiceRow}>
                  <input
                    type="checkbox"
                    checked={draft.exemptions.roleIds.includes(role.id)}
                    onChange={() =>
                      set("exemptions", {
                        ...draft.exemptions,
                        roleIds: toggleId(draft.exemptions.roleIds, role.id),
                      })
                    }
                    className="size-4 shrink-0 accent-primary"
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-chrome-base font-medium text-text-muted">Channels</p>
            <div className="mt-2">
              {channels.map((channel) => (
                <label key={channel.id} className={choiceRow}>
                  <input
                    type="checkbox"
                    checked={draft.exemptions.channelIds.includes(channel.id)}
                    onChange={() =>
                      set("exemptions", {
                        ...draft.exemptions,
                        channelIds: toggleId(draft.exemptions.channelIds, channel.id),
                      })
                    }
                    className="size-4 shrink-0 accent-primary"
                  />
                  {`#${channel.name}`}
                </label>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      {draft.kind === "keyword" || draft.kind === "preset" ? (
        <div className="border-t border-border-hairline pt-5">
          <label htmlFor="automod-sample" className={labelClass}>
            Test a sentence
          </label>
          <Input
            id="automod-sample"
            value={sample}
            onChange={(event) => {
              setSample(event.target.value);
              setServerResult(null);
            }}
            placeholder="Type something a member might post"
            className="mt-2"
          />
          {sample !== "" && draft.kind === "keyword" ? (
            <p className="mt-2 text-content-sm" role="status">
              {localHit ? (
                <span className="font-medium text-status-warn">This would be caught by the words above.</span>
              ) : (
                <span className="text-text-muted">The words above would let this through.</span>
              )}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="chrome"
            onClick={testOnServer}
            disabled={sample === "" || pending}
            className="mt-2"
          >
            Check every saved rule
          </Button>
          {serverResult ? (
            <p className="mt-2 text-content-sm text-text-muted" role="status">
              {serverResult}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-border-hairline pt-5">
        <Button type="button" onClick={save} disabled={pending || !canSave}>
          {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
          Save rule
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
