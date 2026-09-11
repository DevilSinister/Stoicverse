"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";

import { addBlockedWords, removeBlockedWord, saveCommunityModeration } from "@/app/creator/settings/actions";
import { matchesBlockedWord, MODERATION_LIMITS, type CommunityModeration } from "@/lib/community-settings/model";

const label = "block text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted";
const numberField =
  "focus-ring h-11 w-28 rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-white outline-none";

export function ModerationSection({
  moderation,
  phrases,
  canSave,
}: {
  moderation: CommunityModeration;
  phrases: { id: string; phrase: string }[];
  canSave: boolean;
}) {
  const [values, setValues] = useState(moderation);
  const [baseline, setBaseline] = useState(() => JSON.stringify(moderation));
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof CommunityModeration>(key: K, next: CommunityModeration[K]) =>
    setValues((current) => ({ ...current, [key]: next }));

  const dirty = JSON.stringify(values) !== baseline;

  const submit = (data: FormData) =>
    startTransition(async () => {
      const result = await saveCommunityModeration(data);
      if (result.error) {
        setFeedback({ tone: "error", message: result.error });
        return;
      }
      setBaseline(JSON.stringify(values));
      setFeedback({ tone: "success", message: "Saved. These rules apply to new messages immediately." });
    });

  return (
    <div className="max-w-2xl space-y-8">
      <form action={submit} className="space-y-6">
        <div>
          <label htmlFor="moderation-slow" className={label}>
            Slow mode
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              id="moderation-slow"
              name="slowModeSeconds"
              type="number"
              min={MODERATION_LIMITS.slowModeSeconds.min}
              max={MODERATION_LIMITS.slowModeSeconds.max}
              value={values.slowModeSeconds}
              onChange={(event) => set("slowModeSeconds", Number(event.target.value))}
              className={numberField}
            />
            <span className="text-sm text-on-surface-variant">
              seconds between messages {values.slowModeSeconds === 0 && "· off"}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-fog-muted">
            0 turns it off. Staff and anyone with Bypass slow mode are exempt.
          </p>
        </div>

        <div>
          <label htmlFor="moderation-edit" className={label}>
            Edit window
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              id="moderation-edit"
              name="editWindowMinutes"
              type="number"
              min={MODERATION_LIMITS.editWindowMinutes.min}
              max={MODERATION_LIMITS.editWindowMinutes.max}
              value={values.editWindowMinutes}
              onChange={(event) => set("editWindowMinutes", Number(event.target.value))}
              className={numberField}
            />
            <span className="text-sm text-on-surface-variant">
              minutes after posting {values.editWindowMinutes === 0 && "· never expires"}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-fog-muted">
            Members only. Staff editing an older post is a correction; a member rewriting a week-old message changes
            the record.
          </p>
        </div>

        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-on-surface-variant has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-container">
          <input
            type="checkbox"
            name="deleteRequiresReason"
            checked={values.deleteRequiresReason}
            onChange={(event) => set("deleteRequiresReason", event.target.checked)}
            className="size-4 accent-[#10B981]"
          />
          Require a reason when deleting a message
        </label>

        <fieldset className="space-y-3">
          <legend className={label}>Blocked words</legend>
          <div className="flex flex-wrap gap-4">
            <Choice
              name="blockedWordMatch"
              value="word"
              checked={values.blockedWordMatch === "word"}
              onChange={() => set("blockedWordMatch", "word")}
              title="Whole words"
              detail="Matches the word on its own."
            />
            <Choice
              name="blockedWordMatch"
              value="substring"
              checked={values.blockedWordMatch === "substring"}
              onChange={() => set("blockedWordMatch", "substring")}
              title="Any substring"
              detail="Also matches inside other words."
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <Choice
              name="blockedWordMode"
              value="block"
              checked={values.blockedWordMode === "block"}
              onChange={() => set("blockedWordMode", "block")}
              title="Block the message"
              detail="The author is told and nothing is posted."
            />
            <Choice
              name="blockedWordMode"
              value="flag"
              checked={values.blockedWordMode === "flag"}
              onChange={() => set("blockedWordMode", "flag")}
              title="Flag it"
              detail="The message posts and lands in the audit log."
            />
          </div>
        </fieldset>

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
            Save moderation rules
          </button>
        </div>
      </form>

      <BlockedWordList phrases={phrases} match={values.blockedWordMatch} canSave={canSave} />
    </div>
  );
}

function Choice({
  name,
  value,
  checked,
  onChange,
  title,
  detail,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  detail: string;
}) {
  return (
    <label className="flex min-h-11 flex-1 cursor-pointer items-start gap-2 rounded-lg border border-surgical-steel p-3 transition has-[:checked]:border-primary-container has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-container">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-1 size-4 accent-[#10B981]"
      />
      <span>
        <span className="block text-sm font-semibold text-white">{title}</span>
        <span className="block text-xs leading-5 text-fog-muted">{detail}</span>
      </span>
    </label>
  );
}

function BlockedWordList({
  phrases,
  match,
  canSave,
}: {
  phrases: { id: string; phrase: string }[];
  match: CommunityModeration["blockedWordMatch"];
  canSave: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [sample, setSample] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const words = useMemo(() => phrases.map((entry) => entry.phrase), [phrases]);
  // Runs the same matcher the trigger runs. Without this, "Any substring"
  // quietly blocking "classic" because "ass" is listed is undiscoverable.
  const hit = sample ? matchesBlockedWord(sample, words, match) : null;

  const add = (data: FormData) =>
    startTransition(async () => {
      const result = await addBlockedWords(data);
      setError(result.error ?? null);
      if (!result.error) setDraft("");
    });

  const remove = (id: string) =>
    startTransition(async () => {
      const result = await removeBlockedWord(id);
      setError(result.error ?? null);
    });

  return (
    <section className="space-y-4 border-t border-surgical-steel pt-6">
      <div>
        <h2 className="font-headline text-lg font-bold text-white">Blocked phrases</h2>
        <p className="mt-1 text-sm leading-6 text-on-surface-variant">
          This is a speed bump, not a filter. Homoglyphs, zero-width characters and <code>b-a-d</code> all pass
          straight through it. Treat it as a way to catch the careless, never as a guarantee.
        </p>
      </div>

      <form action={add} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="blocked-add" className={label}>
            Add phrases
          </label>
          <textarea
            id="blocked-add"
            name="phrases"
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="One per line, or comma separated."
            className="focus-ring mt-2 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 py-2 text-base leading-6 text-white outline-none placeholder:text-fog-muted"
          />
        </div>
        <button
          type="submit"
          disabled={!canSave || pending || !draft.trim()}
          className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-surgical-steel px-4 text-sm font-semibold text-white transition hover:border-primary-container disabled:opacity-40"
        >
          {pending && <Loader2 size={15} aria-hidden="true" className="animate-spin" />}
          Add
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm leading-6 text-error">
          {error}
        </p>
      )}

      {phrases.length === 0 ? (
        <p className="text-sm leading-6 text-fog-muted">
          Nothing is blocked. Messages are checked against this list on every post and edit.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {phrases.map((entry) => (
            <li key={entry.id}>
              <span className="inline-flex min-h-9 items-center gap-1 rounded-full border border-surgical-steel pl-3 pr-1 text-sm text-on-surface-variant">
                {entry.phrase}
                <button
                  type="button"
                  onClick={() => remove(entry.id)}
                  disabled={!canSave || pending}
                  aria-label={`Remove ${entry.phrase}`}
                  className="focus-ring grid size-8 place-items-center rounded-full text-fog-muted transition hover:text-error disabled:opacity-40"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div>
        <label htmlFor="blocked-test" className={label}>
          Test a sentence
        </label>
        <input
          id="blocked-test"
          value={sample}
          onChange={(event) => setSample(event.target.value)}
          placeholder="Type something a member might write."
          className="focus-ring mt-2 h-11 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-white outline-none placeholder:text-fog-muted"
        />
        <p role="status" className="mt-2 min-h-5 text-xs leading-5">
          {!sample ? (
            <span className="text-fog-muted">Checked with the same matcher the database uses.</span>
          ) : hit ? (
            <span className="text-error">Would be caught — matched &ldquo;{hit}&rdquo;.</span>
          ) : (
            <span className="text-primary-container">Would go through.</span>
          )}
        </p>
      </div>
    </section>
  );
}
