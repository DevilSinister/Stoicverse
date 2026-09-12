"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { saveCommunityModeration } from "@/app/creator/settings/actions";
import { MODERATION_LIMITS, type CommunityModeration } from "@/lib/community-settings/model";

const label = "block text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted";
const numberField =
  "focus-ring h-11 w-28 rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-white outline-none";

/**
 * What is left of community-wide moderation: the edit window and whether a
 * deletion needs a reason.
 *
 * Slow mode moved to the channel in phase 3 — it is a property of a room, not
 * of the whole community — and blocked words became AutoMod rules in phase 5,
 * where each list carries its own match mode, its own action and its own
 * exemptions. Two community-wide columns could no longer say what any one rule
 * does, so they were dropped rather than left as controls that half-worked.
 */
export function ModerationSection({
  moderation,
  canSave,
}: {
  moderation: CommunityModeration;
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
            <span className="text-sm text-fog-muted">minutes. 0 means a message can be edited forever.</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-fog-muted">
            Applies to members only. You can correct an older message; a member rewriting a week-old one changes the
            record.
          </p>
        </div>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="deleteRequiresReason"
            checked={values.deleteRequiresReason}
            onChange={(event) => set("deleteRequiresReason", event.target.checked)}
            className="focus-ring mt-1 size-4 rounded border-surgical-steel bg-surface-container-lowest"
          />
          <span className="text-sm leading-6 text-on-surface">
            A deletion needs a reason
            <span className="block text-xs text-fog-muted">
              The reason is written to the audit log and shown to the member.
            </span>
          </span>
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!dirty || pending || !canSave}
            className="focus-ring inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-monolith-surface disabled:opacity-50"
          >
            {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            Save changes
          </button>
          {feedback ? (
            <p
              role="status"
              className={feedback.tone === "error" ? "text-sm text-red-300" : "text-sm text-emerald-300"}
            >
              {feedback.message}
            </p>
          ) : null}
        </div>
      </form>

      <p className="rounded-lg border border-dashed border-surgical-steel p-4 text-xs leading-5 text-fog-muted">
        Looking for blocked words? They are AutoMod rules now, under Moderation → AutoMod, where each list has its own
        action and its own exemptions.
      </p>
    </div>
  );
}
