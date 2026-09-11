"use client";

import { AlertTriangle } from "lucide-react";

import {
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  type PermissionConfig,
  type PermissionKey,
} from "@/lib/community-settings/model";

/**
 * The seven grants, as real checkboxes.
 *
 * Shared so the settings page and the role manager cannot offer different
 * permission sets. Nothing here is optimistic: an optimistic toggle on
 * `delete_others` would be a lie about a security-relevant write.
 */
export function RolePermissionGrid({
  permissions,
  onToggle,
  disabled = false,
}: {
  permissions: PermissionConfig;
  onToggle: (key: PermissionKey, next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="sr-only">Permissions</legend>
      {PERMISSION_KEYS.map((key) => {
        const meta = PERMISSION_LABELS[key];
        const checked = permissions[key] === true;
        return (
          <label
            key={key}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-surgical-steel p-3 transition has-[:checked]:border-primary-container has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-container"
          >
            <input
              type="checkbox"
              name="permissions"
              value={key}
              checked={checked}
              onChange={(event) => onToggle(key, event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[#10B981]"
            />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                {meta.label}
                {meta.escalating && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-error/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-error">
                    <AlertTriangle size={11} aria-hidden="true" />
                    Escalating
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-fog-muted">{meta.detail}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
