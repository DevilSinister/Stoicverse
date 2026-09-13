"use client";

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";

import { saveAutomodRule, setAutomodExemptions, testAutomodBody } from "@/app/creator/settings/automod-actions";
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

const label = "block text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted";
const field =
  "focus-ring h-11 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-white outline-none";
const numberField =
  "focus-ring h-11 w-28 rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-white outline-none";
const textArea =
  "focus-ring mt-2 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest p-3 text-base text-white outline-none";

export type RuleDraft = AutomodRule & { exemptions: AutomodExemptions };

/**
 * One editor for all five kinds.
 *
 * The kind is fixed once a rule exists: changing it would reinterpret settings
 * that do not carry over, and the database's per-kind CHECK rejects the
 * half-converted shape anyway.
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
  onNotice: (message: string) => void;
}) {
  const [draft, setDraft] = useState<RuleDraft>(rule);
  const [keywordText, setKeywordText] = useState(rule.keywords.join("\n"));
  const [domainText, setDomainText] = useState(rule.allowedDomains.join("\n"));
  const [sample, setSample] = useState("");
  const [serverResult, setServerResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      setError(null);
      let keywordList: string[] = [];
      try {
        if (draft.kind === "keyword") keywordList = keywords.map(parseKeyword);
      } catch (issue) {
        setError(issue instanceof Error ? issue.message : "That rule could not be saved.");
        return;
      }

      const result = await saveAutomodRule({
        ...draft,
        keywords: keywordList,
        allowedDomains: splitLines(domainText),
        timeoutSeconds: draft.timeoutSeconds ?? "",
      });
      if (result.error) {
        setError(result.error);
        return;
      }

      const id = result.id ?? draft.id;
      if (id) {
        const exempt = await setAutomodExemptions(id, draft.exemptions.roleIds, draft.exemptions.channelIds);
        if (exempt.error) {
          setError(exempt.error);
          return;
        }
      }
      onNotice(`Saved "${draft.name}".`);
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
    <div className="space-y-6 rounded-xl border border-surgical-steel bg-surface-container-low p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-on-surface">{AUTOMOD_KIND_LABELS[draft.kind].label}</p>
          <p className="text-xs text-fog-muted">{AUTOMOD_KIND_LABELS[draft.kind].detail}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close editor" className="focus-ring rounded-lg p-2">
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div>
        <label htmlFor="automod-name" className={label}>
          Rule name
        </label>
        <input
          id="automod-name"
          value={draft.name}
          maxLength={AUTOMOD_LIMITS.name.max}
          onChange={(event) => set("name", event.target.value)}
          className={`${field} mt-2`}
        />
      </div>

      {draft.kind === "keyword" ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="automod-keywords" className={label}>
              Words and phrases
            </label>
            <textarea
              id="automod-keywords"
              rows={5}
              value={keywordText}
              onChange={(event) => setKeywordText(event.target.value)}
              className={textArea}
            />
            <p className="mt-2 text-xs leading-5 text-fog-muted">
              One per line or comma-separated. <code>*</code> matches up to {KEYWORD_WILDCARD_BOUND} more characters,
              so <code>scam*</code> catches <code>scammer</code>. No other patterns are accepted — a regular
              expression typed here would run against every message anyone sends.
              <span className="mt-1 block">
                {keywords.length} of {AUTOMOD_LIMITS.keywords.max}
              </span>
            </p>
          </div>
          <fieldset>
            <legend className={label}>Match</legend>
            <div className="mt-2 flex gap-4 text-sm text-on-surface">
              {(["word", "substring"] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="matchMode"
                    checked={draft.matchMode === mode}
                    onChange={() => set("matchMode", mode)}
                    className="focus-ring size-4"
                  />
                  {mode === "word" ? "Whole words" : "Any substring"}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-fog-muted">
              Substring catches more by accident: <code>ass</code> would match <code>classic</code>.
            </p>
          </fieldset>
        </div>
      ) : null}

      {draft.kind === "preset" ? (
        <fieldset>
          <legend className={label}>Preset list</legend>
          <div className="mt-2 space-y-2">
            {presets.map((preset) => (
              <label
                key={preset.key}
                className="flex items-start gap-3 rounded-lg border border-surgical-steel p-3 text-sm"
              >
                <input
                  type="radio"
                  name="presetKey"
                  checked={draft.presetKey === preset.key}
                  onChange={() => set("presetKey", preset.key)}
                  className="focus-ring mt-1 size-4"
                />
                <span>
                  <span className="font-semibold text-on-surface">{preset.label}</span>
                  <span className="block text-xs text-fog-muted">{preset.description}</span>
                  <span className="block text-xs text-fog-muted">{preset.phraseCount} phrases</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {draft.kind === "mention_spam" ? (
        <div>
          <label htmlFor="automod-mentions" className={label}>
            Mention limit
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              id="automod-mentions"
              type="number"
              min={AUTOMOD_LIMITS.mentionLimit.min}
              max={AUTOMOD_LIMITS.mentionLimit.max}
              value={draft.mentionLimit ?? AUTOMOD_LIMITS.mentionLimit.min}
              onChange={(event) => set("mentionLimit", Number(event.target.value))}
              className={numberField}
            />
            <span className="text-sm text-fog-muted">mentions in one message before it is caught.</span>
          </div>
        </div>
      ) : null}

      {draft.kind === "link_filter" ? (
        <div>
          <label htmlFor="automod-domains" className={label}>
            Allowed domains
          </label>
          <textarea
            id="automod-domains"
            rows={4}
            value={domainText}
            onChange={(event) => setDomainText(event.target.value)}
            className={textArea}
          />
          <p className="mt-2 text-xs leading-5 text-fog-muted">
            One hostname per line. A domain allows its subdomains, so <code>youtube.com</code> covers{" "}
            <code>m.youtube.com</code>. Leave this empty to catch every link.
          </p>
        </div>
      ) : null}

      {draft.kind === "duplicate_spam" ? (
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="automod-count" className={label}>
              Repeats
            </label>
            <input
              id="automod-count"
              type="number"
              min={AUTOMOD_LIMITS.duplicateCount.min}
              max={AUTOMOD_LIMITS.duplicateCount.max}
              value={draft.duplicateCount ?? AUTOMOD_LIMITS.duplicateCount.min}
              onChange={(event) => set("duplicateCount", Number(event.target.value))}
              className={`${numberField} mt-2`}
            />
          </div>
          <div>
            <label htmlFor="automod-window" className={label}>
              Within (seconds)
            </label>
            <input
              id="automod-window"
              type="number"
              min={AUTOMOD_LIMITS.duplicateWindowSeconds.min}
              max={AUTOMOD_LIMITS.duplicateWindowSeconds.max}
              value={draft.duplicateWindowSeconds ?? AUTOMOD_LIMITS.duplicateWindowSeconds.min}
              onChange={(event) => set("duplicateWindowSeconds", Number(event.target.value))}
              className={`${numberField} mt-2`}
            />
          </div>
        </div>
      ) : null}

      <fieldset className="space-y-3 border-t border-surgical-steel pt-5">
        <legend className={label}>What happens</legend>
        <label className="flex items-start gap-3 text-sm text-on-surface">
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
            className="focus-ring mt-1 size-4"
          />
          <span>
            Block the message
            <span className="block text-xs text-fog-muted">
              Off means the message stands and moderators are notified instead.
            </span>
          </span>
        </label>

        <div>
          <label htmlFor="automod-timeout" className={label}>
            Also time the member out
          </label>
          <select
            id="automod-timeout"
            value={draft.timeoutSeconds ?? ""}
            disabled={!draft.actionBlock}
            onChange={(event) => set("timeoutSeconds", event.target.value === "" ? null : Number(event.target.value))}
            className={`${field} mt-2 disabled:opacity-50`}
          >
            <option value="">No timeout</option>
            {TIMEOUT_STOPS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {formatDuration(seconds)}
              </option>
            ))}
          </select>
          {draft.actionBlock ? null : (
            <p className="mt-2 text-xs text-fog-muted">A timeout needs the message blocked as well.</p>
          )}
        </div>
      </fieldset>

      <fieldset className="border-t border-surgical-steel pt-5">
        <legend className={label}>Exempt from this rule</legend>
        <p className="mt-2 text-xs text-fog-muted">You are exempt from every rule already.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-on-surface-variant">Roles</p>
            <div className="mt-2 space-y-1">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm text-on-surface">
                  <input
                    type="checkbox"
                    checked={draft.exemptions.roleIds.includes(role.id)}
                    onChange={() =>
                      set("exemptions", {
                        ...draft.exemptions,
                        roleIds: toggleId(draft.exemptions.roleIds, role.id),
                      })
                    }
                    className="focus-ring size-4"
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant">Channels</p>
            <div className="mt-2 space-y-1">
              {channels.map((channel) => (
                <label key={channel.id} className="flex items-center gap-2 text-sm text-on-surface">
                  <input
                    type="checkbox"
                    checked={draft.exemptions.channelIds.includes(channel.id)}
                    onChange={() =>
                      set("exemptions", {
                        ...draft.exemptions,
                        channelIds: toggleId(draft.exemptions.channelIds, channel.id),
                      })
                    }
                    className="focus-ring size-4"
                  />
                  {`#${channel.name}`}
                </label>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      {draft.kind === "keyword" || draft.kind === "preset" ? (
        <div className="border-t border-surgical-steel pt-5">
          <label htmlFor="automod-sample" className={label}>
            Test a sentence
          </label>
          <input
            id="automod-sample"
            value={sample}
            onChange={(event) => {
              setSample(event.target.value);
              setServerResult(null);
            }}
            placeholder="Type something a member might post"
            className={`${field} mt-2`}
          />
          {sample !== "" && draft.kind === "keyword" ? (
            <p className="mt-2 text-sm" role="status">
              {localHit ? (
                <span className="text-amber-300">This would be caught by the words above.</span>
              ) : (
                <span className="text-fog-muted">The words above would let this through.</span>
              )}
            </p>
          ) : null}
          <button
            type="button"
            onClick={testOnServer}
            disabled={sample === "" || pending}
            className="focus-ring mt-2 inline-flex h-9 items-center rounded-lg border border-surgical-steel px-3 text-xs font-semibold text-on-surface disabled:opacity-50"
          >
            Check every saved rule
          </button>
          {serverResult ? (
            <p className="mt-2 text-sm text-on-surface-variant" role="status">
              {serverResult}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-surgical-steel pt-5">
        <button
          type="button"
          onClick={save}
          disabled={pending || !canSave}
          className="focus-ring inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
          Save rule
        </button>
        <button
          type="button"
          onClick={onClose}
          className="focus-ring inline-flex h-11 items-center rounded-lg border border-surgical-steel px-4 text-sm font-semibold text-on-surface"
        >
          Cancel
        </button>
        {error ? (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
