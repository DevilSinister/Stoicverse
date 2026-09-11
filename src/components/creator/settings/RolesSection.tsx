"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldAlert } from "lucide-react";

import { saveRolePermissions } from "@/app/creator/settings/actions";
import { RolePermissionGrid } from "@/components/creator/settings/RolePermissionGrid";
import type { RoleWithPermissions } from "@/lib/community-settings/governance";
import {
  MODERATOR_BASELINE,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  type PermissionConfig,
  type PermissionKey,
} from "@/lib/community-settings/model";

export function RolesSection({ roles, canSave }: { roles: RoleWithPermissions[]; canSave: boolean }) {
  const [selectedId, setSelectedId] = useState(roles[0]?.id ?? "");
  const selected = roles.find((role) => role.id === selectedId);

  if (!roles.length) {
    return (
      <div className="rounded-xl border border-surgical-steel p-6">
        <p className="text-sm leading-6 text-on-surface-variant">
          No roles exist yet. Create one in Members, then come back to decide what it can do.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Preamble />

      <div className="md:grid md:grid-cols-[14rem_minmax(0,1fr)] md:gap-6">
        <ul className="mb-4 space-y-1 md:mb-0">
          {roles.map((role) => {
            const current = role.id === selectedId;
            return (
              <li key={role.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(role.id)}
                  aria-current={current ? "true" : undefined}
                  className={`focus-ring flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm transition ${
                    current
                      ? "bg-surface-container-high text-white"
                      : "text-on-surface-variant hover:bg-surface-container-high/50"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 rounded-full border border-surgical-steel"
                    style={role.color ? { background: role.color } : undefined}
                  />
                  <span className="min-w-0 flex-1 truncate font-semibold">{role.name}</span>
                  <span className="shrink-0 text-xs text-fog-muted">{role.memberCount}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {selected && <RoleForm key={selected.id} role={selected} canSave={canSave} />}
      </div>
    </div>
  );
}

/** The most important copy on the page. */
function Preamble() {
  return (
    <div className="rounded-xl border border-surgical-steel bg-surface-container-low p-4">
      <p className="text-sm leading-6 text-on-surface">
        Grants compose with channel access — they never bypass it. A role with <strong>Post</strong> still cannot open
        a Tier 4 channel from Tier 1.
      </p>
      <p className="mt-2 text-xs leading-5 text-fog-muted">
        Moderators already hold {MODERATOR_BASELINE.map((key) => PERMISSION_LABELS[key].label).join(", ")} without any
        role. Mentioning everyone and managing channels are deliberately not in that baseline — they need a grant here.
      </p>
    </div>
  );
}

function RoleForm({ role, canSave }: { role: RoleWithPermissions; canSave: boolean }) {
  const [permissions, setPermissions] = useState<PermissionConfig>(role.permissions);
  const [baseline, setBaseline] = useState(() => JSON.stringify(role.permissions));
  const [confirmation, setConfirmation] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = JSON.stringify(permissions) !== baseline;

  // Only newly-added escalating grants need the confirm. Removing one, or
  // saving one that was already in force, should not demand ceremony.
  const newlyEscalating = PERMISSION_KEYS.filter(
    (key) => PERMISSION_LABELS[key].escalating && permissions[key] === true && role.permissions[key] !== true,
  );
  const needsConfirmation = newlyEscalating.length > 0;
  const confirmed = !needsConfirmation || confirmation.trim() === role.name;

  const toggle = (key: PermissionKey, next: boolean) =>
    setPermissions((current) => ({ ...current, [key]: next }));

  const submit = (data: FormData) =>
    startTransition(async () => {
      const result = await saveRolePermissions(data);
      if (result.error) {
        setFeedback({ tone: "error", message: result.error });
        return;
      }
      setBaseline(JSON.stringify(permissions));
      setConfirmation("");
      setFeedback({
        tone: "success",
        message: `Saved. This applies to ${role.memberCount} ${
          role.memberCount === 1 ? "member" : "members"
        } on their next page load.`,
      });
    });

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="roleId" value={role.id} />

      <div>
        <h2 className="font-headline text-lg font-bold text-white">{role.name}</h2>
        <p className="mt-0.5 text-xs leading-5 text-fog-muted">
          Effective for {role.memberCount} {role.memberCount === 1 ? "member" : "members"}.
        </p>
      </div>

      <RolePermissionGrid permissions={permissions} onToggle={toggle} disabled={pending} />

      {needsConfirmation && (
        <div className="rounded-lg border border-error/40 bg-error/10 p-3">
          <p className="flex items-start gap-2 text-sm leading-6 text-error">
            <ShieldAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>
              You are granting {newlyEscalating.map((key) => PERMISSION_LABELS[key].label).join(" and ")} to{" "}
              {role.memberCount} {role.memberCount === 1 ? "member" : "members"}. Type <strong>{role.name}</strong> to
              confirm.
            </span>
          </p>
          <label htmlFor="role-confirm" className="sr-only">
            Type the role name to confirm
          </label>
          <input
            id="role-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            className="focus-ring mt-3 h-11 w-full max-w-xs rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-white outline-none"
          />
        </div>
      )}

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
          disabled={!canSave || !dirty || !confirmed || pending}
          className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-container px-5 text-sm font-semibold text-on-primary-fixed transition hover:brightness-110 disabled:opacity-40"
        >
          {pending && <Loader2 size={15} aria-hidden="true" className="animate-spin" />}
          Save permissions
        </button>
        {!canSave && <span className="text-xs leading-5 text-error">Saving is unavailable right now.</span>}
      </div>
    </form>
  );
}
