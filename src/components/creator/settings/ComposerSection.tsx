"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { saveCommunityComposer } from "@/app/creator/settings/actions";
import {
  ATTACHMENT_TYPE_CHOICES,
  COMPOSER_LIMITS,
  REACTION_PALETTE,
  type CommunityComposer,
} from "@/lib/community-settings/model";

const label = "block text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted";
const toggle =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-on-surface-variant has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-container";

export function ComposerSection({ composer, canSave }: { composer: CommunityComposer; canSave: boolean }) {
  const [values, setValues] = useState(composer);
  const [baseline, setBaseline] = useState(() => JSON.stringify(composer));
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof CommunityComposer>(key: K, value: CommunityComposer[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const toggleIn = (key: "reactionEmojis" | "allowedAttachmentTypes", item: string) =>
    set(key, values[key].includes(item) ? values[key].filter((entry) => entry !== item) : [...values[key], item]);

  const dirty = JSON.stringify(values) !== baseline;
  const megabytes = Math.round((values.maxAttachmentBytes / (1024 * 1024)) * 10) / 10;

  const submit = (data: FormData) =>
    startTransition(async () => {
      const result = await saveCommunityComposer(data);
      if (result.error) {
        setFeedback({ tone: "error", message: result.error });
        return;
      }
      setBaseline(JSON.stringify(values));
      setFeedback({ tone: "success", message: "Saved. These rules apply to new messages immediately." });
    });

  return (
    <form action={submit} className="max-w-2xl space-y-6">
      <input type="hidden" name="maxAttachmentBytes" value={values.maxAttachmentBytes} />

      <fieldset>
        <legend className={label}>Reactions members can use</legend>
        <p className="mt-1 text-xs leading-5 text-fog-muted">
          Turning one off is not destructive. Reactions already placed still show and can still be taken back — they
          just cannot be added again.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {REACTION_PALETTE.map((emoji) => {
            const enabled = values.reactionEmojis.includes(emoji);
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => toggleIn("reactionEmojis", emoji)}
                aria-pressed={enabled}
                aria-label={`${emoji} ${enabled ? "enabled" : "disabled"}`}
                className={`focus-ring grid size-11 place-items-center rounded-lg border text-lg transition ${
                  enabled
                    ? "border-primary-container bg-primary-container/10"
                    : "border-surgical-steel opacity-40 hover:opacity-70"
                }`}
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            );
          })}
        </div>
        {values.reactionEmojis.map((emoji) => (
          <input key={emoji} type="hidden" name="reactionEmojis" value={emoji} />
        ))}
        <p className="mt-2 text-xs leading-5 text-fog-muted">
          {values.reactionEmojis.length} of {REACTION_PALETTE.length} enabled.
        </p>
      </fieldset>

      <div>
        <label htmlFor="composer-max-body" className={label}>
          Message length limit
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            id="composer-max-body"
            name="maxBodyLength"
            type="number"
            min={COMPOSER_LIMITS.body.min}
            max={COMPOSER_LIMITS.body.max}
            value={values.maxBodyLength}
            onChange={(event) => set("maxBodyLength", Number(event.target.value))}
            className="focus-ring h-11 w-32 rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-white outline-none"
          />
          <span className="text-sm text-on-surface-variant">characters</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-fog-muted">
          Between {COMPOSER_LIMITS.body.min} and {COMPOSER_LIMITS.body.max}. Enforced by a database trigger, so it
          holds even against a direct API call.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className={label}>What a message may contain</legend>
        <label className={toggle}>
          <input
            type="checkbox"
            name="allowLinks"
            checked={values.allowLinks}
            onChange={(event) => set("allowLinks", event.target.checked)}
            className="size-4 accent-[#10B981]"
          />
          Allow links
        </label>
        <label className={toggle}>
          <input
            type="checkbox"
            name="allowAttachments"
            checked={values.allowAttachments}
            onChange={(event) => set("allowAttachments", event.target.checked)}
            className="size-4 accent-[#10B981]"
          />
          Allow attachments
        </label>
        <p className="text-xs leading-5 text-fog-muted">
          These apply to members, not to you or your moderators — otherwise turning links off would block your own
          announcements. Only staff can post today, so both are dormant until per-channel posting policy ships.
        </p>
      </fieldset>

      {values.allowAttachments && (
        <fieldset>
          <legend className={label}>Attachment types</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ATTACHMENT_TYPE_CHOICES.map((choice) => (
              <label
                key={choice.value}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-surgical-steel px-3 text-sm text-on-surface-variant transition has-[:checked]:border-primary-container has-[:checked]:text-primary-container has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-container"
              >
                <input
                  type="checkbox"
                  name="allowedAttachmentTypes"
                  value={choice.value}
                  checked={values.allowedAttachmentTypes.includes(choice.value)}
                  onChange={() => toggleIn("allowedAttachmentTypes", choice.value)}
                  className="size-4 accent-[#10B981]"
                />
                {choice.label}
              </label>
            ))}
          </div>

          <label htmlFor="composer-max-attachment" className={`${label} mt-4`}>
            Largest attachment
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              id="composer-max-attachment"
              type="range"
              min={1}
              max={20}
              step={1}
              value={Math.max(1, Math.round(megabytes))}
              onChange={(event) => set("maxAttachmentBytes", Number(event.target.value) * 1024 * 1024)}
              className="h-11 w-48 accent-[#10B981]"
            />
            <span className="text-sm text-on-surface-variant">{megabytes} MB</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-fog-muted">
            20MB is the storage bucket&apos;s own ceiling; a larger number here would be a promise storage refuses to
            keep.
          </p>
        </fieldset>
      )}

      {feedback && (
        <p
          role={feedback.tone === "error" ? "alert" : "status"}
          className={`text-sm leading-6 ${feedback.tone === "error" ? "text-error" : "text-primary-container"}`}
        >
          {feedback.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-surgical-steel pt-4">
        <button
          type="submit"
          disabled={!canSave || !dirty || pending}
          className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-container px-5 text-sm font-semibold text-on-primary-fixed transition hover:brightness-110 disabled:opacity-40"
        >
          {pending && <Loader2 size={15} aria-hidden="true" className="animate-spin" />}
          Save composer rules
        </button>
        {!canSave && (
          <span className="text-xs leading-5 text-error">
            Saving is unavailable until the settings table is in place.
          </span>
        )}
      </div>
    </form>
  );
}
