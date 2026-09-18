"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldAlert } from "lucide-react";

import { clearLockdown, saveCommunitySafety } from "@/app/creator/settings/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { nativeSelectClass } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { SAFETY_LIMITS, VERIFICATION_LEVELS, type CommunitySafety } from "@/lib/community-settings/model";
import { cn } from "@/lib/utils";

/**
 * Who may post, how soon, and what happens when many people join at once.
 *
 * Everything here answers the same question - how much rope a member gets -
 * which is why the edit window and "deleting needs a reason" moved in from the
 * old Moderation section rather than staying a second form with its own Save.
 *
 * Two things on this page are read-only, and deliberately so. The rules
 * version is bumped by the database when the rules text changes, and the
 * lockdown is set by the join-rate trigger. A form that could write either
 * would let this page overwrite what the database had just decided.
 *
 * Monolith, phase 12b. Two things beyond the palette.
 *
 * **"Lift it now" was 26px tall.** It is the control somebody reaches for
 * while a raid is in progress, and it was `px-3 py-1.5 text-xs` - a third of
 * the 44px this design system requires everywhere else. Save was 36px. Both
 * are `ui/button` now, which is where that decision belongs; the previous
 * system had a hand-written height per call site and this screen chose two
 * different wrong ones.
 *
 * **`text-monolith-surface` was the label colour on both fills.** That alias
 * resolves to `--surface-panel`, a near-black *surface* being used as *text* -
 * legible on lime and on red by coincidence rather than by design, and it would
 * have followed the panel colour anywhere the panel moved. Same family as the
 * `accent-contrast` misuses phases 6 through 11 kept finding: an `accent*` or
 * `surface*` token describes a role, not a colour you may borrow.
 *
 * The radios stay native. `ui/radio-group` exists in the primitives and has no
 * call site anywhere in the product, and `verificationLevel` reaches the action
 * through the radio's own `name`/`value` - moving a working form control onto
 * an unexercised primitive is a behaviour change, not a repaint. The checkbox
 * does move, because `ui/checkbox` was exercised in phase 12a and the contract
 * it has to keep is identical: the action reads
 * `data.get("deleteRequiresReason") !== null`, so an unchecked box must submit
 * nothing, which is what Base UI does when no `uncheckedValue` is given.
 */

const labelClass = "terminal-label block";

function when(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString();
}

export function SafetySection({
  safety,
  rulesChannels,
  acceptedCount,
  canSave,
}: {
  safety: CommunitySafety;
  /** Only channels of type `rules` - the database trigger refuses any other. */
  rulesChannels: { id: string; name: string }[];
  /** How many members have accepted the rules as they currently stand. */
  acceptedCount: number;
  canSave: boolean;
}) {
  const notify = useToast();
  const [values, setValues] = useState(safety);
  const [baseline, setBaseline] = useState(() => JSON.stringify(safety));
  const [pending, startTransition] = useTransition();
  const [lifting, startLifting] = useTransition();

  const set = <K extends keyof CommunitySafety>(key: K, next: CommunitySafety[K]) =>
    setValues((current) => ({ ...current, [key]: next }));

  const dirty = JSON.stringify(values) !== baseline;
  const lockedDown = values.raidLockdownUntil !== null && new Date(values.raidLockdownUntil) > new Date();

  const submit = (data: FormData) =>
    startTransition(async () => {
      const result = await saveCommunitySafety(data);
      if (result.error) {
        notify(result.error, "error");
        return;
      }
      setBaseline(JSON.stringify(values));
      notify("Saved. This applies to the next message anybody sends.", "success");
    });

  const lift = () =>
    startLifting(async () => {
      const result = await clearLockdown();
      if (result.error) {
        notify(result.error, "error");
        return;
      }
      set("raidLockdownUntil", null);
      notify("The lockdown is lifted.", "success");
    });

  return (
    <div className="max-w-2xl space-y-8">
      {/*
        The banner is first because while it is showing it is the only thing on
        this page anybody came to read.
      */}
      {lockedDown ? (
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-status-danger/50 bg-status-danger/10 p-chrome-x">
          <ShieldAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-status-danger" />
          <div className="min-w-0 flex-1">
            <p className="text-content-sm font-medium text-status-danger">The community is locked down</p>
            <p className="mt-1 text-chrome-base text-text-muted">
              {`Members cannot post until ${when(values.raidLockdownUntil)}. Enough people joined inside the window below for this to trip on its own, and it lifts itself when the time is up.`}
            </p>
          </div>
          {canSave ? (
            <Button type="button" variant="destructive" onClick={lift} disabled={lifting} className="shrink-0">
              {lifting ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
              Lift it now
            </Button>
          ) : null}
        </div>
      ) : null}

      <form action={submit} className="space-y-8">
        <fieldset className="space-y-3">
          <legend className={labelClass}>Before a member may post</legend>
          {VERIFICATION_LEVELS.map((level) => (
            <label
              key={level.value}
              className={`flex cursor-pointer gap-3 rounded-xl border p-chrome-x transition-colors ${
                values.verificationLevel === level.value ? "border-primary bg-surface-panel" : "border-border-hairline"
              }`}
            >
              <input
                type="radio"
                name="verificationLevel"
                value={level.value}
                checked={values.verificationLevel === level.value}
                onChange={() => set("verificationLevel", level.value)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="min-w-0">
                <span className="block text-content-sm font-medium text-text-default">{level.label}</span>
                <span className="mt-0.5 block text-chrome-base text-text-muted">{level.blurb}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {/*
          Hidden rather than unmounted. A number field that leaves the form
          submits nothing, and `parseSafety` would refuse the save for a reason
          nobody could see, on a control nobody could find.
        */}
        <div className={values.verificationLevel === "member_age" ? "" : "hidden"}>
          <label htmlFor="safety-wait" className={labelClass}>
            How long they wait
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Input
              id="safety-wait"
              name="verificationMinutes"
              type="number"
              min={SAFETY_LIMITS.verificationMinutes.min}
              max={SAFETY_LIMITS.verificationMinutes.max}
              value={values.verificationMinutes}
              onChange={(event) => set("verificationMinutes", Number(event.target.value))}
              className="w-28"
            />
            <span className="text-content-sm text-text-muted">minutes after their membership starts.</span>
          </div>
        </div>

        <div className={values.verificationLevel === "accepted_rules" ? "" : "hidden"}>
          <label htmlFor="safety-rules-channel" className={labelClass}>
            Where the rules are
          </label>
          <select
            id="safety-rules-channel"
            name="rulesChannelId"
            value={values.rulesChannelId ?? ""}
            onChange={(event) => set("rulesChannelId", event.target.value === "" ? null : event.target.value)}
            className={cn(nativeSelectClass, "mt-2")}
          >
            <option value="">No channel chosen</option>
            {rulesChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>{`#${channel.name}`}</option>
            ))}
          </select>
          <p className="mt-2 text-chrome-base text-text-muted">
            {rulesChannels.length === 0
              ? "There is no rules channel yet. Make one in Channels with the type Rules, and it will appear here."
              : `Version ${values.rulesVersion}, last changed ${when(values.rulesUpdatedAt)}. ${acceptedCount} ${
                  acceptedCount === 1 ? "member has" : "members have"
                } accepted it. Editing the rules in Overview publishes a new version, and everybody is asked again.`}
          </p>
        </div>

        <fieldset className="space-y-3 border-t border-border-hairline pt-6">
          <legend className={labelClass}>When many join at once</legend>
          <p className="text-chrome-base text-text-muted">
            A burst of sign-ups is the shape of a raid. Past the limit the community stops taking messages for a while,
            the audit log records it, and everyone who can lift it is told. Nobody is banned and no join is refused: a
            lockdown holds posting, not membership.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              name="joinRateLimit"
              type="number"
              aria-label="Joins before a lockdown"
              min={SAFETY_LIMITS.joinRateLimit.min}
              max={SAFETY_LIMITS.joinRateLimit.max}
              value={values.joinRateLimit}
              onChange={(event) => set("joinRateLimit", Number(event.target.value))}
              className="w-28"
            />
            <span className="text-content-sm text-text-muted">joins within</span>
            <Input
              name="joinRateWindowMinutes"
              type="number"
              aria-label="The window, in minutes"
              min={SAFETY_LIMITS.joinRateWindowMinutes.min}
              max={SAFETY_LIMITS.joinRateWindowMinutes.max}
              value={values.joinRateWindowMinutes}
              onChange={(event) => set("joinRateWindowMinutes", Number(event.target.value))}
              className="w-28"
            />
            <span className="text-content-sm text-text-muted">minutes locks posting for</span>
            <Input
              name="lockdownMinutes"
              type="number"
              aria-label="How long a lockdown lasts, in minutes"
              min={SAFETY_LIMITS.lockdownMinutes.min}
              max={SAFETY_LIMITS.lockdownMinutes.max}
              value={values.lockdownMinutes}
              onChange={(event) => set("lockdownMinutes", Number(event.target.value))}
              className="w-28"
            />
            <span className="text-content-sm text-text-muted">minutes.</span>
          </div>
          {values.joinRateLimit === 0 ? (
            <p className="text-chrome-base text-text-muted">0 turns raid protection off.</p>
          ) : null}
        </fieldset>

        <fieldset className="space-y-4 border-t border-border-hairline pt-6">
          <legend className={labelClass}>After a message is sent</legend>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              name="editWindowMinutes"
              type="number"
              aria-label="Edit window, in minutes"
              min={SAFETY_LIMITS.editWindowMinutes.min}
              max={SAFETY_LIMITS.editWindowMinutes.max}
              value={values.editWindowMinutes}
              onChange={(event) => set("editWindowMinutes", Number(event.target.value))}
              className="w-28"
            />
            <span className="text-content-sm text-text-muted">minutes to edit it. 0 means forever.</span>
          </div>
          <label className="group/field-label flex cursor-pointer items-start gap-3">
            <Checkbox
              name="deleteRequiresReason"
              checked={values.deleteRequiresReason}
              onCheckedChange={(checked) => set("deleteRequiresReason", checked)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-content-sm text-text-default">
                A moderator deleting a message must say why
              </span>
              <span className="mt-0.5 block text-chrome-base text-text-muted">
                The reason goes to the audit log beside the message as it was.
              </span>
            </span>
          </label>
        </fieldset>

        {canSave ? (
          <Button type="submit" disabled={!dirty || pending}>
            {pending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
            {dirty ? "Save safety settings" : "Saved"}
          </Button>
        ) : (
          <p className="text-chrome-base text-text-muted">You can read these settings but not change them.</p>
        )}
      </form>
    </div>
  );
}
