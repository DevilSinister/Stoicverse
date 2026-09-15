"use client";

import Image from "next/image";
import { AlertTriangle, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { EmojiPicker } from "@/components/community/emoji/EmojiPicker";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
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
      <legend className="terminal-label block">Role colour</legend>

      <div className="mt-2 flex flex-wrap gap-2">
        {ROLE_SWATCHES.map((swatch) => {
          const selected = value.toUpperCase() === swatch.hex.toUpperCase();
          return (
            <button
              key={swatch.hex}
              type="button"
              onClick={() => onChange(swatch.hex)}
              aria-pressed={selected}
              className={`focus-ring inline-flex size-11 items-center justify-center rounded-lg border transition-colors ${
                selected ? "border-primary" : "border-border-hairline"
              }`}
            >
              <span aria-hidden="true" className="size-5 rounded-md" style={{ background: swatch.hex }} />
              <span className="sr-only">{swatch.name}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-content-sm text-text-muted">
          <span>Custom</span>
          <input
            type="color"
            value={isHexColor(value) ? value : "#94A3B8"}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            className="focus-ring h-11 w-16 cursor-pointer rounded-lg border border-border-hairline bg-surface-sunken p-1"
          />
        </label>
        <p className={`text-chrome-base ${usable ? "text-text-muted" : "text-status-danger"}`}>
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
 *
 * Monolith, phase 12b. The icon was a bare `<img>`, which is one of the two
 * eslint warnings this screen carried; it is `next/image` with `unoptimized`,
 * the same treatment `IdentityPreview` gives the community logo, because the
 * source is a storage URL rather than a bundled asset. The upload failures are
 * toasts: they are the outcome of an action, and rendering them under the row
 * pushed the emoji picker down by a line as they came and went.
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
  const notify = useToast();
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (file.size > ROLE_LIMITS.iconBytes) {
      notify("A role icon must be 256 KB or smaller.", "error");
      return;
    }
    if (!(ROLE_LIMITS.iconTypes as readonly string[]).includes(file.type)) {
      notify("A role icon must be a PNG, WebP or GIF.", "error");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const nextPath = `${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase() ?? "png"}`;
    const { error: uploadError } = await supabase.storage.from(ROLE_ICON_BUCKET).upload(nextPath, file);
    setUploading(false);

    if (uploadError) {
      notify("That icon could not be uploaded.", "error");
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
      <legend className="terminal-label block">Role icon</legend>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-11 items-center justify-center overflow-hidden rounded-lg border border-border-hairline bg-surface-sunken text-content-lg"
        >
          {emoji ? (
            emoji
          ) : url ? (
            <Image src={url} alt="" width={44} height={44} unoptimized className="size-full object-contain" />
          ) : (
            "—"
          )}
        </span>

        <Button type="button" variant="outline" onClick={() => setPicking((open) => !open)} aria-expanded={picking}>
          Choose emoji
        </Button>

        <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
          {uploading ? (
            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          ) : (
            <Upload size={14} aria-hidden="true" />
          )}
          Upload image
        </Button>

        {(emoji || path) && (
          <Button type="button" variant="ghost" onClick={() => onChange({ emoji: null, path: null, url: null })}>
            <X size={14} aria-hidden="true" />
            Remove
          </Button>
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

      <p className="mt-2 text-chrome-base text-text-muted">
        PNG, WebP or GIF up to 256 KB. An emoji and an image cannot both be set.
      </p>
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
 *
 * These stay native inputs. They carry `name="permissions"` with the key as the
 * value and are read back with `getAll`, so they are the one control set on
 * this screen with a real form contract - and a repaint is not where that gets
 * re-tested against a primitive with no call sites.
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
            <legend className="terminal-label mb-2 block">{group.label}</legend>
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
        <fieldset
          disabled={disabled}
          className="rounded-lg border border-status-danger/40 bg-status-danger/10 p-chrome-x"
        >
          <legend className="terminal-label px-1 text-status-danger">Danger</legend>
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
      className={`flex items-start gap-3 rounded-lg p-chrome-x transition-colors ${
        bare ? "" : "border border-border-hairline has-[:checked]:border-primary"
      } ${locked ? "opacity-50" : "cursor-pointer"} has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary`}
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
        <span className="flex flex-wrap items-center gap-2 text-content-sm font-medium text-text-strong">
          {meta.label}
          {meta.escalating && (
            <StatusBadge tone="danger" className="gap-1">
              <AlertTriangle size={11} aria-hidden="true" />
              Escalating
            </StatusBadge>
          )}
        </span>
        <span className="mt-0.5 block text-chrome-base text-text-muted">{meta.detail}</span>
        {locked && (
          <span className="mt-1 block text-chrome-base text-status-danger">
            You do not hold this permission yourself.
          </span>
        )}
      </span>
    </label>
  );
}
