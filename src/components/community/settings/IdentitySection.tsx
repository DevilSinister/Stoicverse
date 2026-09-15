"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";

import { saveCommunityIdentity } from "@/app/creator/settings/actions";
import { AccentField } from "@/components/community/settings/AccentField";
import { IdentityPreview } from "@/components/community/settings/IdentityPreview";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  contrastRatio,
  IDENTITY_LIMITS,
  isHexColor,
  MIN_ACCENT_CONTRAST,
  type CommunityIdentity,
} from "@/lib/community-settings/model";
import { createClient } from "@/lib/supabase/client";

/**
 * Community identity. Monolith, phase 12a.
 *
 * **The two class-name constants are gone.** `field` and `label` were a
 * hand-rolled input and a hand-rolled label kept as strings at the top of the
 * file - the same pair phase 10 removed from account settings, and the reason
 * both screens drifted off the system independently. They are `ui/input`,
 * `ui/textarea` and the `terminal-label` utility now.
 *
 * **The save and upload outcomes moved out of the layout.** They were a
 * paragraph rendered between the last field and the Save button, so a failed
 * save pushed the button down at the moment somebody was reaching for it -
 * lesson 70, and the reason `ui/toast` exists. What stays in place is the
 * `canSave` line beside the button: that describes the state of the form
 * rather than the outcome of an action, and it is only meaningful where it is.
 *
 * **The checkbox is `ui/checkbox` and deliberately carries no `value`.** The
 * server reads `data.get("showWelcome") !== null`, so what matters is that an
 * unchecked box submits *nothing*. Base UI renders a real
 * `<input type="checkbox" name>` and adds a hidden companion only when
 * `uncheckedValue` is given - omitting it is what keeps the absent-means-false
 * contract intact. Read out of `CheckboxRoot.js` rather than assumed, because
 * a checkbox that submits `""` when unchecked would make this preference
 * impossible to turn off, with nothing to see and nothing to log.
 */

const labelClass = "terminal-label block";

export function IdentitySection({
  identity,
  logoUrl: initialLogoUrl,
  canSave,
}: {
  identity: CommunityIdentity;
  logoUrl: string | null;
  canSave: boolean;
}) {
  const notice = useToast();
  const [values, setValues] = useState(identity);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  // State, not a ref: `dirty` is read during render, and a ref read there is not
  // guaranteed to re-render when it changes.
  const [baseline, setBaseline] = useState(() => JSON.stringify(identity));

  const set = <K extends keyof CommunityIdentity>(key: K, value: CommunityIdentity[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const dirty = JSON.stringify(values) !== baseline;
  const ratio = useMemo(() => contrastRatio(values.accentColor), [values.accentColor]);
  const accentUsable = ratio !== null && ratio >= MIN_ACCENT_CONTRAST;

  const submit = (data: FormData) =>
    startTransition(async () => {
      const result = await saveCommunityIdentity(data);
      if (result.error) {
        // The form is never reset on failure: what the creator typed stays.
        notice(result.error, "error");
        return;
      }
      setBaseline(JSON.stringify(values));
      notice("Saved. Members see this on their next page load.", "success");
    });

  const upload = async (file: File) => {
    if (file.size > IDENTITY_LIMITS.logoBytes) {
      notice("That logo is over 2MB. Pick a smaller file.", "error");
      return;
    }
    if (!IDENTITY_LIMITS.logoTypes.includes(file.type as (typeof IDENTITY_LIMITS.logoTypes)[number])) {
      notice("Logos must be JPEG, PNG, WebP or SVG.", "error");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `logo-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from("community-branding").upload(path, file, { upsert: true });
    setUploading(false);

    if (error) {
      notice("That logo could not be uploaded.", "error");
      return;
    }
    set("logoPath", path);
    setLogoUrl(supabase.storage.from("community-branding").getPublicUrl(path).data.publicUrl);
  };

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_20rem]">
      <form action={submit} className="space-y-6">
        <input type="hidden" name="logoPath" value={values.logoPath ?? ""} />
        <input type="hidden" name="accentColor" value={values.accentColor} />

        <div>
          <label htmlFor="identity-name" className={labelClass}>
            Community name
          </label>
          <Input
            id="identity-name"
            name="name"
            required
            minLength={IDENTITY_LIMITS.name.min}
            maxLength={IDENTITY_LIMITS.name.max}
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            className="mt-2"
          />
        </div>

        <div>
          <label htmlFor="identity-tagline" className={labelClass}>
            Tagline <span className="font-normal normal-case tracking-normal">· optional</span>
          </label>
          <Input
            id="identity-tagline"
            name="tagline"
            maxLength={IDENTITY_LIMITS.tagline.max}
            value={values.tagline}
            onChange={(event) => set("tagline", event.target.value)}
            placeholder="One line on what this community practises."
            className="mt-2"
          />
          <p className="mt-1 font-mono text-chrome-xs text-text-muted">
            {values.tagline.length} / {IDENTITY_LIMITS.tagline.max}
          </p>
        </div>

        <fieldset>
          <legend className={labelClass}>Logo</legend>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label
              className={buttonVariants({
                variant: "outline",
                className:
                  "cursor-pointer has-[:focus-visible]:border-ring has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50",
              })}
            >
              {uploading ? (
                <Loader2 size={15} aria-hidden="true" className="animate-spin" />
              ) : (
                <Upload size={15} aria-hidden="true" />
              )}
              {values.logoPath ? "Replace logo" : "Upload logo"}
              <input
                type="file"
                accept={IDENTITY_LIMITS.logoTypes.join(",")}
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                  event.target.value = "";
                }}
                className="sr-only"
              />
            </label>
            {values.logoPath && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  set("logoPath", null);
                  setLogoUrl(null);
                }}
              >
                Remove
              </Button>
            )}
          </div>
          <p className="mt-2 text-chrome-base text-text-muted">
            JPEG, PNG, WebP or SVG, up to 2MB. Shown beside the community name.
          </p>
        </fieldset>

        <AccentField value={values.accentColor} onChange={(hex) => set("accentColor", hex)} />

        <div>
          <label htmlFor="identity-welcome" className={labelClass}>
            Welcome message
          </label>
          <Textarea
            id="identity-welcome"
            name="welcomeMessage"
            rows={4}
            maxLength={IDENTITY_LIMITS.welcomeMessage.max}
            value={values.welcomeMessage}
            onChange={(event) => set("welcomeMessage", event.target.value)}
            className="mt-2"
          />
          <label className="group/field-label mt-3 flex min-h-11 cursor-pointer items-center gap-2 text-content-sm text-text-muted">
            <Checkbox
              name="showWelcome"
              checked={values.showWelcome}
              onCheckedChange={(checked) => set("showWelcome", checked)}
            />
            Show this to members who have just joined
          </label>
        </div>

        <div>
          <label htmlFor="identity-rules" className={labelClass}>
            Rules
          </label>
          <Textarea
            id="identity-rules"
            name="rules"
            rows={8}
            maxLength={IDENTITY_LIMITS.rules.max}
            value={values.rules}
            onChange={(event) => set("rules", event.target.value)}
            className="mt-2"
          />
          <p className="mt-1 text-chrome-base text-text-muted">
            Plain text. Line breaks are kept; markdown is not rendered and would show as literal syntax.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border-hairline pt-4">
          <Button type="submit" disabled={!canSave || !dirty || pending || uploading || !accentUsable}>
            {pending && <Loader2 size={15} aria-hidden="true" className="animate-spin" />}
            Save identity
          </Button>
          {!canSave && (
            <span className="text-chrome-base text-status-danger">
              Saving is unavailable until the settings table is in place.
            </span>
          )}
        </div>
      </form>

      <IdentityPreview
        name={values.name}
        tagline={values.tagline}
        accentColor={isHexColor(values.accentColor) ? values.accentColor : "#10B981"}
        welcomeMessage={values.welcomeMessage}
        rules={values.rules}
        showWelcome={values.showWelcome}
        logoUrl={logoUrl}
      />
    </div>
  );
}
