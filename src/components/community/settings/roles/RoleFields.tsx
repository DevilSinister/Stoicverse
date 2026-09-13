"use client";

import { AlertTriangle, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { EmojiPicker } from "@/components/community/emoji/EmojiPicker";
import { contrastRatio, formatContrast, isHexColor } from "@/lib/community-settings/model";
import {
  canGrant,
  PERMISSION_CATALOG,
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  type PermissionKey,
  type ViewerForGrants,
} from "@/lib/community-settings/permissions";
import { MIN_ROLE_CONTRAST, ROLE_LIMITS, ROLE_SURFACE_COLOR, ROLE_SWATCHES } from "@/lib/community-settings/role-model";
import { createClient } from "@/lib/supabase/client";

const ROLE_ICON_BUCKET = "community-role-icons";

/**
 * The role colour, measured against the member list rather than the page.
 *
 * The same reasoning as `AccentField`: the ratio is shown as text, always, so
 * someone who wants an off-brand colour can see how close it is. Colour alone
 * can never carry the state.
 */
export function RoleColorField({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  const ratio = contrastRatio(value, ROLE_SURFACE_COLOR);
  const usable = ratio !== null && ratio >= MIN_ROLE_CONTRAST;

  return (
    <fieldset disabled={disabled}>
      <legend className="block text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted">Role colour</legend>

      <div className="mt-2 flex flex-wrap gap-2">
        {ROLE_SWATCHES.map((swatch) => {
          const selected = value.toUpperCase() === swatch.hex.toUpperCase();
          return (
            <button
              key={swatch.hex}
              type="button"
              onClick={() => onChange(swatch.hex)}
              aria-pressed={selected}
              className={`focus-ring inline-flex size-11 items-center justify-center rounded-lg border transition ${
                selected ? "border-primary-container" : "border-surgical-steel"
              }`}
            >
              <span aria-hidden="true" className="size-5 rounded" style={{ background: swatch.hex }} />
              <span className="sr-only">{swatch.name}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-on-surface-variant">
          <span>Custom</span>
          <input
            type="color"
            value={isHexColor(value) ? value : "#94A3B8"}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            className="focus-ring h-11 w-16 cursor-pointer rounded-lg border border-surgical-steel bg-surface-container-lowest p-1"
          />
        </label>
        <p className={`text-xs leading-5 ${usable ? "text-fog-muted" : "text-error"}`}>
          {formatContrast(ratio ?? 1)} against the member list
          {usable ? "" : ` — a role name needs at least ${MIN_ROLE_CONTRAST}:1 to stay readable.`}
        </p>
      </div>
    </fieldset>
  );
}

/**
 * Emoji or an uploaded image, never both — the database CHECK refuses the pair,
 * so the interface refuses it first by clearing whichever one is being replaced.
 */
export function RoleIconField({
  emoji,
  path,
  url,
  onChange,
  disabled = false,
}: {
  emoji: string | null;
  path: string | null;
  url: string | null;
  onChange: (next: { emoji: string | null; path: string | null; url: string | null }) => void;
  disabled?: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setError(null);
    if (file.size > ROLE_LIMITS.iconBytes) {
      setError("A role icon must be 256 KB or smaller.");
      return;
    }
    if (!(ROLE_LIMITS.iconTypes as readonly string[]).includes(file.type)) {
      setError("A role icon must be a PNG, WebP or GIF.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const nextPath = `${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase() ?? "png"}`;
    const { error: uploadError } = await supabase.storage.from(ROLE_ICON_BUCKET).upload(nextPath, file);
    setUploading(false);

    if (uploadError) {
      setError("That icon could not be uploaded.");
      return;
    }
    onChange({
      emoji: null,
      path: nextPath,
      url: supabase.storage.from(ROLE_ICON_BUCKET).getPublicUrl(nextPath).data.publicUrl,
    });
  };

  return (
    <fieldset disabled={disabled}>
      <legend className="block text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted">Role icon</legend>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-11 items-center justify-center overflow-hidden rounded-lg border border-surgical-steel bg-surface-container-lowest text-lg"
        >
          {emoji ? emoji : url ? <img src={url} alt="" className="size-full object-contain" /> : "—"}
        </span>

        <button
          type="button"
          onClick={() => setPicking((open) => !open)}
          aria-expanded={picking}
          className="focus-ring inline-flex min-h-11 items-center rounded-lg border border-surgical-steel px-4 text-sm text-on-surface-variant transition hover:bg-surface-container-high/50"
        >
          Choose emoji
        </button>

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-surgical-steel px-4 text-sm text-on-surface-variant transition hover:bg-surface-container-high/50"
        >
          {uploading ? (
            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          ) : (
            <Upload size={14} aria-hidden="true" />
          )}
          Upload image
        </button>

        {(emoji || path) && (
          <button
            type="button"
            onClick={() => onChange({ emoji: null, path: null, url: null })}
            className="focus-ring inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm text-fog-muted transition hover:text-text-strong"
          >
            <X size={14} aria-hidden="true" />
            Remove
          </button>
        )}

        <input
          ref={fileInput}
          type="file"
          accept={ROLE_LIMITS.iconTypes.join(",")}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>

      {picking && (
        <div className="mt-3">
          <EmojiPicker
            mode="insert"
            onClose={() => setPicking(false)}
            onSelect={(selection) => {
              // Custom emoji are a phase 6 surface and have no glyph to store in
              // `icon_emoji`; only Unicode can be a role icon today.
              if (selection.kind !== "unicode") return;
              onChange({ emoji: selection.glyph, path: null, url: null });
              setPicking(false);
            }}
          />
        </div>
      )}

      <p className="mt-2 text-xs leading-5 text-fog-muted">
        PNG, WebP or GIF up to 256 KB. An emoji and an image cannot both be set.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm leading-6 text-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/**
 * The 24 grants, grouped, as real checkboxes.
 *
 * A grant the viewer does not hold themselves is disabled with the reason
 * attached, rather than hidden: knowing the permission exists and that you
 * cannot pass it on is the honest state. `community_role_save` refuses the
 * same thing, so this is legibility, not enforcement.
 */
export function RolePermissionGrid({
  permissions,
  viewer,
  onToggle,
  appliesToEveryone = false,
  disabled = false,
}: {
  permissions: readonly PermissionKey[];
  viewer: ViewerForGrants;
  onToggle: (key: PermissionKey, next: boolean) => void;
  /** @everyone never offers the moderation grants — they would make every member staff. */
  appliesToEveryone?: boolean;
  disabled?: boolean;
}) {
  const held = new Set(permissions);

  return (
    <div className="space-y-6">
      {PERMISSION_GROUPS.map((group) => {
        const keys = PERMISSION_KEYS.filter(
          (key) =>
            PERMISSION_CATALOG[key].group === group.id &&
            key !== "administrator" &&
            (!appliesToEveryone || PERMISSION_CATALOG[key].appliesToEveryone),
        );
        if (!keys.length) return null;

        return (
          <fieldset key={group.id} disabled={disabled} className="space-y-2">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted">
              {group.label}
            </legend>
            {keys.map((key) => (
              <PermissionToggleRow
                key={key}
                permissionKey={key}
                checked={held.has(key)}
                grantable={canGrant(viewer, key)}
                onToggle={onToggle}
              />
            ))}
          </fieldset>
        );
      })}

      {!appliesToEveryone && (
        <fieldset disabled={disabled} className="rounded-lg border border-error/40 bg-error/10 p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-error">Danger</legend>
          <PermissionToggleRow
            permissionKey="administrator"
            checked={held.has("administrator")}
            grantable={canGrant(viewer, "administrator")}
            onToggle={onToggle}
            bare
          />
        </fieldset>
      )}
    </div>
  );
}

function PermissionToggleRow({
  permissionKey,
  checked,
  grantable,
  onToggle,
  bare = false,
}: {
  permissionKey: PermissionKey;
  checked: boolean;
  grantable: boolean;
  onToggle: (key: PermissionKey, next: boolean) => void;
  bare?: boolean;
}) {
  const meta = PERMISSION_CATALOG[permissionKey];
  // An already-granted permission stays togglable even when the viewer could
  // not grant it themselves, so a role can always be walked back down.
  const locked = !grantable && !checked;

  return (
    <label
      className={`flex items-start gap-3 rounded-lg p-3 transition ${
        bare ? "" : "border border-surgical-steel has-[:checked]:border-primary-container"
      } ${locked ? "opacity-50" : "cursor-pointer"} has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-container`}
    >
      <input
        type="checkbox"
        name="permissions"
        value={permissionKey}
        checked={checked}
        disabled={locked}
        onChange={(event) => onToggle(permissionKey, event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text-strong">
          {meta.label}
          {meta.escalating && (
            <span className="inline-flex items-center gap-1 rounded-full border border-error/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-error">
              <AlertTriangle size={11} aria-hidden="true" />
              Escalating
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-fog-muted">{meta.detail}</span>
        {locked && (
          <span className="mt-1 block text-xs leading-5 text-error">You do not hold this permission yourself.</span>
        )}
      </span>
    </label>
  );
}
