"use client";

import { Info, Link2, Link2Off, Loader2, ShieldQuestion } from "lucide-react";
import { useId, useMemo, useState, useTransition } from "react";

import { setChannelOverrides, setChannelPermissionSync, setChannelSlowMode } from "@/app/creator/channels/actions";
import type { CommunityCategory, CommunityChannel } from "@/components/community/types";
import { formatSlowMode, SLOW_MODE_STOPS } from "@/lib/community-settings/model";
import {
  CHANNEL_PERMISSION_KEYS,
  PERMISSION_CATALOG,
  PERMISSION_GROUPS,
  resolveChannelPermissions,
  type ChannelPermissionKey,
  type OverrideState,
} from "@/lib/community-settings/permissions";
import type { CommunityRole } from "@/lib/community-settings/role-model";
import type { ChannelOverride } from "@/lib/community-settings/structure";
import type { Notify } from "@/components/ui/toast";

type Grid = Record<string, OverrideState>;

/** The stored arrays, turned back into the grid the controls render. */
function gridFrom(override: ChannelOverride | undefined): Grid {
  const grid: Grid = {};
  for (const key of CHANNEL_PERMISSION_KEYS) {
    grid[key] = override?.deny.includes(key) ? "deny" : override?.allow.includes(key) ? "allow" : "neutral";
  }
  return grid;
}

function isNeutral(grid: Grid): boolean {
  return CHANNEL_PERMISSION_KEYS.every((key) => (grid[key] ?? "neutral") === "neutral");
}

/**
 * Who may do what in one channel or category.
 *
 * The grid is the interface to `channel_permission_overrides`, and the
 * precedence it previews — @everyone deny, @everyone allow, role denies, role
 * allows — is computed by the same `resolveChannelPermissions` the database
 * mirrors. Only the 17 channel-scoped keys appear: `ban_members` in one channel
 * and not another is not something anyone should be able to express.
 */
export function ChannelPermissionsTab({
  target,
  channel,
  category,
  roles,
  overrides,
  canSave,
  onNotice,
}: {
  target: "channel" | "category";
  channel?: CommunityChannel;
  category?: CommunityCategory;
  roles: CommunityRole[];
  overrides: ChannelOverride[];
  canSave: boolean;
  onNotice: Notify;
}) {
  const targetId = target === "channel" ? channel?.id : category?.id;
  const synced = target === "channel" ? (channel?.permissionsSynced ?? true) : false;

  // A synced channel shows its category's rules, read-only. Showing its own
  // empty grid would suggest the channel has no rules, when in fact it has
  // whatever the category says.
  const effective = useMemo(
    () =>
      overrides.filter((override) =>
        target === "category"
          ? override.categoryId === targetId
          : synced
            ? override.categoryId === channel?.categoryId
            : override.channelId === targetId,
      ),
    [overrides, target, targetId, synced, channel?.categoryId],
  );

  const [rows, setRows] = useState<{ roleId: string; grid: Grid }[]>(() =>
    effective.map((override) => ({ roleId: override.roleId, grid: gridFrom(override) })),
  );
  const [seeded, setSeeded] = useState(effective);
  if (effective !== seeded) {
    setSeeded(effective);
    setRows(effective.map((override) => ({ roleId: override.roleId, grid: gridFrom(override) })));
  }

  const [pending, startTransition] = useTransition();
  const [previewRoleId, setPreviewRoleId] = useState<string | null>(null);
  const addId = useId();

  const readOnly = synced || !canSave;
  const byId = new Map(roles.map((role) => [role.id, role]));
  const unused = roles.filter((role) => !rows.some((row) => row.roleId === role.id));

  const setState = (roleId: string, key: ChannelPermissionKey, state: OverrideState) =>
    setRows((current) =>
      current.map((row) => (row.roleId === roleId ? { ...row, grid: { ...row.grid, [key]: state } } : row)),
    );

  const save = () =>
    startTransition(async () => {
      if (!targetId) return;
      // Rows the person emptied are sent too: an all-Neutral grid is how the
      // RPC is told to delete that role's override.
      const result = await setChannelOverrides(
        target,
        targetId,
        rows.map((row) => ({ roleId: row.roleId, grid: row.grid as Record<string, string> })),
      );
      if (result.error) onNotice(result.error, "error");
      else onNotice("Channel permissions saved.", "success");
    });

  const toggleSync = (next: boolean) =>
    startTransition(async () => {
      if (!channel) return;
      const result = await setChannelPermissionSync(channel.id, next);
      if (result.error) onNotice(result.error, "error");
      else
        onNotice(
          next ? "This channel follows its category again." : "This channel now has its own permissions.",
          "success",
        );
    });

  return (
    <div className="space-y-6">
      {target === "channel" && channel && (
        <SyncWithCategoryField synced={synced} disabled={!canSave || pending} onToggle={toggleSync} />
      )}

      {rows.length === 0 && (
        <p className="rounded-lg border border-surgical-steel bg-surface-container-low p-4 text-sm leading-6 text-on-surface-variant">
          {synced
            ? "This channel follows its category, and the category sets no overrides. Everyone here can do what their roles already allow."
            : `No role has an override here yet. Add one to allow or deny a permission for just this ${target === "channel" ? "channel" : "category"}.`}
        </p>
      )}

      {rows.map((row) => {
        const role = byId.get(row.roleId);
        if (!role) return null;
        return (
          <fieldset
            key={row.roleId}
            disabled={readOnly || pending}
            className="rounded-xl border border-surgical-steel p-4"
          >
            <legend className="flex items-center gap-2 px-2 text-sm font-semibold" style={{ color: role.color }}>
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: role.color }} />
              {role.name}
            </legend>

            {PERMISSION_GROUPS.map((group) => {
              const keys = CHANNEL_PERMISSION_KEYS.filter((key) => PERMISSION_CATALOG[key].group === group.id);
              if (!keys.length) return null;
              return (
                <div key={group.id} className="mt-4 first:mt-2">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted">{group.label}</h4>
                  <div className="mt-2 space-y-1">
                    {keys.map((key) => (
                      <TriStateControl
                        key={key}
                        permissionKey={key}
                        roleName={role.name}
                        state={row.grid[key] ?? "neutral"}
                        onChange={(state) => setState(row.roleId, key, state)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {isNeutral(row.grid) && !readOnly && (
              <p className="mt-3 text-xs leading-5 text-fog-muted">
                Every control is Neutral, so saving removes this role&apos;s override entirely.
              </p>
            )}
          </fieldset>
        );
      })}

      {!readOnly && unused.length > 0 && (
        <div>
          <label htmlFor={addId} className="block text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted">
            Add a role
          </label>
          <select
            id={addId}
            value=""
            onChange={(event) => {
              const roleId = event.target.value;
              if (!roleId) return;
              setRows((current) => [...current, { roleId, grid: gridFrom(undefined) }]);
            }}
            className="focus-ring mt-2 h-12 w-full max-w-xs rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-text-strong outline-none sm:text-sm"
          >
            <option value="">Choose a role…</option>
            {unused.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <ViewAsRolePreview
        roles={roles}
        rows={rows}
        selectedRoleId={previewRoleId}
        onSelect={setPreviewRoleId}
        channelType={channel?.type}
      />

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3 border-t border-surgical-steel pt-4">
          <button
            type="button"
            onClick={save}
            disabled={pending || !canSave}
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-container px-5 text-sm font-semibold text-on-primary-fixed transition hover:brightness-110 disabled:opacity-40"
          >
            {pending && <Loader2 size={15} aria-hidden="true" className="animate-spin" />}
            Save permissions
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Deny / Neutral / Allow, as a radiogroup rather than three buttons.
 *
 * Arrow keys move between the three within one permission, which is what a
 * radiogroup gives for free and what a row of buttons would have to rebuild.
 */
function TriStateControl({
  permissionKey,
  roleName,
  state,
  onChange,
}: {
  permissionKey: ChannelPermissionKey;
  roleName: string;
  state: OverrideState;
  onChange: (state: OverrideState) => void;
}) {
  const meta = PERMISSION_CATALOG[permissionKey];
  const name = `${roleName}-${permissionKey}`;

  const options: { value: OverrideState; label: string; tone: string; description: string }[] = [
    { value: "deny", label: "✕", tone: "text-error", description: "Deny" },
    { value: "neutral", label: "/", tone: "text-fog-muted", description: "Neutral — inherit" },
    { value: "allow", label: "✓", tone: "text-primary-container", description: "Allow" },
  ];

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg px-2 py-1.5 transition hover:bg-surface-container-high/40">
      <span className="min-w-0">
        <span className="block text-sm text-text-strong">{meta.label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-fog-muted">{meta.detail}</span>
      </span>

      <span role="radiogroup" aria-label={`${meta.label} for ${roleName}`} className="flex shrink-0 gap-1">
        {options.map((option) => {
          const selected = state === option.value;
          return (
            <label
              key={option.value}
              className={`inline-flex size-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-bold transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-container ${
                selected
                  ? `border-current ${option.tone}`
                  : "border-surgical-steel text-fog-muted/50 hover:text-fog-muted"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span aria-hidden="true">{option.label}</span>
              <span className="sr-only">{option.description}</span>
            </label>
          );
        })}
      </span>
    </div>
  );
}

function SyncWithCategoryField({
  synced,
  disabled,
  onToggle,
}: {
  synced: boolean;
  disabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-surgical-steel bg-surface-container-low p-4">
      <p className="flex items-start gap-2 text-sm leading-6 text-on-surface">
        {synced ? (
          <Link2 size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-primary-container" />
        ) : (
          <Link2Off size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-fog-muted" />
        )}
        <span>
          {synced
            ? "This channel follows its category's permissions. The grid below is what the category says, and it is read-only here."
            : "This channel has its own permissions. Its category's are ignored."}
        </span>
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onToggle(!synced)}
        className="focus-ring mt-3 inline-flex min-h-11 items-center rounded-lg border border-surgical-steel px-4 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-high/50 disabled:opacity-40"
      >
        {synced ? "Give this channel its own permissions" : "Follow the category again"}
      </button>
      {!synced && (
        <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-fog-muted">
          <Info size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
          Going back to the category discards every override set here.
        </p>
      )}
    </div>
  );
}

/**
 * What one role would actually end up with.
 *
 * The same function the database mirrors, run on the unsaved grid — so this
 * answers "what will this do" before anyone commits to it, which a column of
 * ticks and crosses cannot.
 */
function ViewAsRolePreview({
  roles,
  rows,
  selectedRoleId,
  onSelect,
  channelType,
}: {
  roles: CommunityRole[];
  rows: { roleId: string; grid: Grid }[];
  selectedRoleId: string | null;
  onSelect: (roleId: string | null) => void;
  channelType?: string;
}) {
  const selectId = useId();
  const everyone = roles.find((role) => role.systemKey === "everyone");
  const selected = roles.find((role) => role.id === selectedRoleId);

  const resolved = useMemo(() => {
    if (!selected || !everyone) return null;
    const base = [...new Set([...everyone.permissions, ...selected.permissions])];
    return resolveChannelPermissions({
      base,
      everyoneRoleId: everyone.id,
      memberRoleIds: [selected.id],
      overrides: rows.map((row) => ({
        roleId: row.roleId,
        allow: CHANNEL_PERMISSION_KEYS.filter((key) => row.grid[key] === "allow"),
        deny: CHANNEL_PERMISSION_KEYS.filter((key) => row.grid[key] === "deny"),
      })),
      channelType: channelType === "rules" ? "rules" : undefined,
    });
  }, [selected, everyone, rows, channelType]);

  return (
    <div className="rounded-xl border border-surgical-steel p-4">
      <label
        htmlFor={selectId}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted"
      >
        <ShieldQuestion size={14} aria-hidden="true" />
        View as role
      </label>
      <select
        id={selectId}
        value={selectedRoleId ?? ""}
        onChange={(event) => onSelect(event.target.value || null)}
        className="focus-ring mt-2 h-12 w-full max-w-xs rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-text-strong outline-none sm:text-sm"
      >
        <option value="">Choose a role…</option>
        {roles
          .filter((role) => role.systemKey !== "everyone")
          .map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
      </select>

      {resolved && (
        <div className="mt-3">
          {resolved.length === 0 ? (
            <p className="text-sm leading-6 text-error">
              Someone whose highest role is {selected?.name} cannot open this channel at all.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {resolved
                .filter((key): key is ChannelPermissionKey =>
                  (CHANNEL_PERMISSION_KEYS as readonly string[]).includes(key),
                )
                .map((key) => (
                  <li
                    key={key}
                    className="rounded-md border border-surgical-steel px-2.5 py-0.5 text-[11px] text-on-surface-variant"
                  >
                    {PERMISSION_CATALOG[key].label}
                  </li>
                ))}
            </ul>
          )}
          <p className="mt-2 text-xs leading-5 text-fog-muted">
            Unsaved changes included. This is @everyone plus {selected?.name}, with the overrides above applied in order.
          </p>
        </div>
      )}
    </div>
  );
}

/** Discord's stops, because "180 seconds" is a worse question than "3 minutes". */
export function SlowModeField({
  channelId,
  seconds,
  disabled,
  onNotice,
}: {
  channelId: string;
  seconds: number;
  disabled: boolean;
  onNotice: Notify;
}) {
  const [value, setValue] = useState(seconds);
  const [pending, startTransition] = useTransition();
  const fieldId = useId();

  const commit = (next: number) => {
    setValue(next);
    startTransition(async () => {
      const result = await setChannelSlowMode(channelId, next);
      if (result.error) onNotice(result.error, "error");
      else onNotice(`Slow mode set to ${formatSlowMode(next)}.`, "success");
    });
  };

  return (
    <div>
      <label htmlFor={fieldId} className="block text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted">
        Slow mode
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <select
          id={fieldId}
          value={value}
          disabled={disabled || pending}
          onChange={(event) => commit(Number(event.target.value))}
          className="focus-ring h-12 rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-text-strong outline-none disabled:opacity-40 sm:text-sm"
        >
          {SLOW_MODE_STOPS.map((stop) => (
            <option key={stop} value={stop}>
              {formatSlowMode(stop)}
            </option>
          ))}
        </select>
        {pending && <Loader2 size={15} aria-hidden="true" className="animate-spin text-fog-muted" />}
      </div>
      <p className="mt-1 text-xs leading-5 text-fog-muted">
        How long a member waits between messages here. Anyone with Bypass slow mode is exempt; nobody else is, including
        moderators.
      </p>
    </div>
  );
}
