"use client";

import { Check } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
 * a pass/fail dot - a creator who wants an off-brand colour deserves to see how
 * close it is, and colour alone can never carry the state.
 *
 * Monolith, phase 12a. The swatches and the hex field were hand-written
 * controls; they are `buttonVariants` and `ui/input` now. The selected swatch
 * keeps its `aria-pressed` - these are a set of toggles over one value, and
 * `aria-pressed` is what tells a screen reader which one is on, since the
 * border that shows it visually says nothing.
 */
export function AccentField({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const ratio = contrastRatio(value);
  const usable = ratio !== null && ratio >= MIN_ACCENT_CONTRAST;

  return (
    <fieldset>
      <legend className="terminal-label">Accent colour</legend>

      <div className="mt-2 flex flex-wrap gap-chrome-gap">
        {ACCENT_SWATCHES.map((swatch) => {
          const selected = value.toUpperCase() === swatch.hex.toUpperCase();
          return (
            <button
              key={swatch.hex}
              type="button"
              onClick={() => onChange(swatch.hex)}
              aria-pressed={selected}
              className={buttonVariants({
                variant: "outline",
                className: selected ? "border-primary text-text-strong" : undefined,
              })}
            >
              <span aria-hidden="true" className="size-4 shrink-0 rounded-md" style={{ background: swatch.hex }} />
              {swatch.name}
              {selected && <Check size={14} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Label htmlFor="identity-accent-hex" className="text-content-sm text-text-muted">
          Or a hex value
        </Label>
        <Input
          id="identity-accent-hex"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          className="w-32 font-mono"
        />
      </div>

      <p className={`mt-2 text-chrome-base ${usable ? "text-text-muted" : "text-status-danger"}`}>
        {isHexColor(value) && ratio !== null
          ? `Contrast against the page background: ${formatContrast(ratio)}. ${
              usable
                ? "Clears the 3:1 floor."
                : `Below the ${MIN_ACCENT_CONTRAST}:1 floor - this colour is the focus ring on every page, so it would be hard to see.`
            }`
          : "Enter a six-digit hex value, such as #10B981."}
      </p>
    </fieldset>
  );
}
