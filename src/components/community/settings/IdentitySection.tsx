"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";

import { saveCommunityIdentity } from "@/app/creator/settings/actions";
import { AccentField } from "@/components/community/settings/AccentField";
import { IdentityPreview } from "@/components/community/settings/IdentityPreview";
import {
  contrastRatio,
  IDENTITY_LIMITS,
  isHexColor,
  MIN_ACCENT_CONTRAST,
  type CommunityIdentity,
} from "@/lib/community-settings/model";
import { createClient } from "@/lib/supabase/client";

const field =
  "focus-ring mt-2 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-text-strong outline-none placeholder:text-fog-muted";
const label = "block text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted";

export function IdentitySection({
  identity,
  logoUrl: initialLogoUrl,
  canSave,
}: {
  identity: CommunityIdentity;
  logoUrl: string | null;
  canSave: boolean;
}) {
  const [values, setValues] = useState(identity);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);
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
        setFeedback({ tone: "error", message: result.error });
        return;
      }
      setBaseline(JSON.stringify(values));
      setFeedback({ tone: "success", message: "Saved. Members see this on their next page load." });
    });

  const upload = async (file: File) => {
    if (file.size > IDENTITY_LIMITS.logoBytes) {
      setFeedback({ tone: "error", message: "That logo is over 2MB. Pick a smaller file." });
      return;
    }
    if (!IDENTITY_LIMITS.logoTypes.includes(file.type as (typeof IDENTITY_LIMITS.logoTypes)[number])) {
      setFeedback({ tone: "error", message: "Logos must be JPEG, PNG, WebP or SVG." });
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `logo-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from("community-branding").upload(path, file, { upsert: true });
    setUploading(false);

    if (error) {
      setFeedback({ tone: "error", message: "That logo could not be uploaded." });
      return;
    }
    set("logoPath", path);
    setLogoUrl(supabase.storage.from("community-branding").getPublicUrl(path).data.publicUrl);
    setFeedback(null);
  };

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_20rem]">
      <form action={submit} className="space-y-6">
        <input type="hidden" name="logoPath" value={values.logoPath ?? ""} />
        <input type="hidden" name="accentColor" value={values.accentColor} />

        <div>
          <label htmlFor="identity-name" className={label}>
            Community name
          </label>
          <input
            id="identity-name"
            name="name"
            required
            minLength={IDENTITY_LIMITS.name.min}
            maxLength={IDENTITY_LIMITS.name.max}
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            className={`${field} h-11`}
          />
        </div>

        <div>
          <label htmlFor="identity-tagline" className={label}>
            Tagline <span className="font-normal normal-case tracking-normal">· optional</span>
          </label>
          <input
            id="identity-tagline"
            name="tagline"
            maxLength={IDENTITY_LIMITS.tagline.max}
            value={values.tagline}
            onChange={(event) => set("tagline", event.target.value)}
            placeholder="One line on what this community practises."
            className={`${field} h-11`}
          />
          <p className="mt-1 text-xs text-fog-muted">
            {values.tagline.length} / {IDENTITY_LIMITS.tagline.max}
          </p>
        </div>

        <fieldset>
          <legend className={label}>Logo</legend>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="focus-ring inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-surgical-steel px-4 text-sm font-semibold text-text-strong transition hover:border-primary-container has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-container">
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
              <button
                type="button"
                onClick={() => {
                  set("logoPath", null);
                  setLogoUrl(null);
                }}
                className="focus-ring min-h-11 rounded-lg px-3 text-sm font-semibold text-fog-muted transition hover:text-text-strong"
              >
                Remove
              </button>
            )}
          </div>
          <p className="mt-2 text-xs leading-5 text-fog-muted">
            JPEG, PNG, WebP or SVG, up to 2MB. Shown beside the community name.
          </p>
        </fieldset>

        <AccentField value={values.accentColor} onChange={(hex) => set("accentColor", hex)} />

        <div>
          <label htmlFor="identity-welcome" className={label}>
            Welcome message
          </label>
          <textarea
            id="identity-welcome"
            name="welcomeMessage"
            rows={4}
            maxLength={IDENTITY_LIMITS.welcomeMessage.max}
            value={values.welcomeMessage}
            onChange={(event) => set("welcomeMessage", event.target.value)}
            className={`${field} py-2 leading-6`}
          />
          <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-on-surface-variant has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-container">
            <input
              type="checkbox"
              name="showWelcome"
              checked={values.showWelcome}
              onChange={(event) => set("showWelcome", event.target.checked)}
              className="size-4 accent-primary"
            />
            Show this to members who have just joined
          </label>
        </div>

        <div>
          <label htmlFor="identity-rules" className={label}>
            Rules
          </label>
          <textarea
            id="identity-rules"
            name="rules"
            rows={8}
            maxLength={IDENTITY_LIMITS.rules.max}
            value={values.rules}
            onChange={(event) => set("rules", event.target.value)}
            className={`${field} py-2 leading-6`}
          />
          <p className="mt-1 text-xs leading-5 text-fog-muted">
            Plain text. Line breaks are kept; markdown is not rendered and would show as literal syntax.
          </p>
        </div>

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
            disabled={!canSave || !dirty || pending || uploading || !accentUsable}
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-container px-5 text-sm font-semibold text-on-primary-fixed transition hover:brightness-110 disabled:opacity-40"
          >
            {pending && <Loader2 size={15} aria-hidden="true" className="animate-spin" />}
            Save identity
          </button>
          {!canSave && (
            <span className="text-xs leading-5 text-error">
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
