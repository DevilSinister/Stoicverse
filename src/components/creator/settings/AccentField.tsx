"use client";

import { Check } from "lucide-react";

import {
  ACCENT_SWATCHES,
  contrastRatio,
  formatContrast,
  isHexColor,
  MIN_ACCENT_CONTRAST,
} from "@/lib/community-settings/model";

/**
 * The accent is `--color-primary-container`: the focus ring on every page, not
 * decoration. So the measured contrast is shown as text, always, rather than as
 * a pass/fail dot — a creator who wants an off-brand colour deserves to see how
 * close it is, and colour alone can never carry the state.
 */
export function AccentField({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const ratio = contrastRatio(value);
  const usable = ratio !== null && ratio >= MIN_ACCENT_CONTRAST;

  return (
    <fieldset>
      <legend className="block text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted">Accent colour</legend>

      <div className="mt-2 flex flex-wrap gap-2">
        {ACCENT_SWATCHES.map((swatch) => {
          const selected = value.toUpperCase() === swatch.hex.toUpperCase();
          return (
            <button
              key={swatch.hex}
              type="button"
              onClick={() => onChange(swatch.hex)}
              aria-pressed={selected}
              className={`focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm transition ${
                selected ? "border-primary-container text-white" : "border-surgical-steel text-on-surface-variant"
              }`}
            >
              <span aria-hidden="true" className="size-4 shrink-0 rounded" style={{ background: swatch.hex }} />
              {swatch.name}
              {selected && <Check size={14} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label htmlFor="identity-accent-hex" className="text-sm text-on-surface-variant">
          Or a hex value
        </label>
        <input
          id="identity-accent-hex"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          className="focus-ring h-11 w-32 rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 font-label text-base text-white outline-none"
        />
      </div>

      <p className={`mt-2 text-xs leading-5 ${usable ? "text-fog-muted" : "text-error"}`}>
        {isHexColor(value) && ratio !== null
          ? `Contrast against the page background: ${formatContrast(ratio)}. ${
              usable
                ? "Clears the 3:1 floor."
                : `Below the ${MIN_ACCENT_CONTRAST}:1 floor — this colour is the focus ring on every page, so it would be hard to see.`
            }`
          : "Enter a six-digit hex value, such as #10B981."}
      </p>
    </fieldset>
  );
}
