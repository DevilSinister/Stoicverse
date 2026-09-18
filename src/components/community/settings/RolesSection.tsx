"use client";

import Image from "next/image";
import { ChevronDown, ChevronUp, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";

import { deleteRole, reorderRoles, saveRole } from "@/app/creator/settings/actions";
import { RoleEditor } from "@/components/community/settings/roles/RoleEditor";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { canMove, describeMove, moveWithin } from "@/lib/community-settings/order";
import { canManageRole, type PermissionKey, type ViewerForGrants } from "@/lib/community-settings/permissions";
import { isTierRole, ROLE_LIMITS, type CommunityRole } from "@/lib/community-settings/role-model";
import type { RolesLoad } from "@/lib/community-settings/roles";

const COMMIT_DELAY_MS = 600;

/**
 * The role hierarchy.
 *
 * Highest first, @everyone pinned to the bottom where it belongs: it is the
 * floor every other role stacks on top of, and showing it in the middle of the
 * list would suggest it could be reordered.
 *
 * Monolith, phase 12b. Two things beyond the palette.
 *
 * **The reorder arrows were 24px.** They are the *only* way to move a role -
 * there is no drag here - so the whole hierarchy was operated through two
 * targets barely half the size the rest of the product uses. `size="icon-sm"`
 * paints 28px and carries `hit-target`, which gives them the 44px area without
 * making the row taller.
 *
 * **The order status stays in place, and the save outcomes do not.** The line
 * that says "Saving order…" or that the order snapped back describes the state
 * of the list beside it, and only means anything there. Creating and deleting a
 * role are outcomes of an action, so those are toasts - which also stops a
 * failed create from pushing the role list down while somebody is reading it.
 */
export function RolesSection({
  data,
  viewer,
  canSave,
}: {
  data: RolesLoad;
  viewer: { isInfluencer: boolean; permissions: PermissionKey[]; highestPosition: number };
  canSave: boolean;
}) {
  const grants: ViewerForGrants = {
    isOwner: viewer.isInfluencer,
    permissions: new Set(viewer.permissions),
    highestPosition: viewer.isInfluencer ? Number.MAX_SAFE_INTEGER : viewer.highestPosition,
  };

  const { order, status, announcement, move, canMoveRole } = useRoleOrder(data.roles, canSave);
  const everyone = data.roles.find((role) => role.systemKey === "everyone") ?? null;

  const [selectedId, setSelectedId] = useState(order[0]?.id ?? everyone?.id ?? "");
  const selected = data.roles.find((role) => role.id === selectedId) ?? order[0] ?? everyone ?? null;

  if (!data.roles.length) {
    return (
      <div className="rounded-xl border border-border-hairline">
        <EmptyState
          title="Roles could not be read"
          description="There is nothing to edit here yet. If this persists, the roles migration may not be applied."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Preamble />

      <div className="md:grid md:grid-cols-[17rem_minmax(0,1fr)] md:gap-6">
        <div className="mb-6 md:mb-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="terminal-label block">Roles</h2>
            <CreateRoleButton disabled={!canSave} onCreated={setSelectedId} />
          </div>

          <ul className="mt-2 space-y-1">
            {order.map((role) => (
              <RoleRow
                key={role.id}
                role={role}
                iconUrl={data.iconUrls[role.id] ?? null}
                current={role.id === selected?.id}
                manageable={canManageRole(grants, role)}
                canMoveUp={canMoveRole(role.id, "up")}
                canMoveDown={canMoveRole(role.id, "down")}
                onSelect={() => setSelectedId(role.id)}
                onMove={move}
              />
            ))}
            {everyone && (
              <RoleRow
                role={everyone}
                iconUrl={null}
                current={everyone.id === selected?.id}
                manageable={canManageRole(grants, everyone)}
                canMoveUp={false}
                canMoveDown={false}
                pinned
                onSelect={() => setSelectedId(everyone.id)}
                onMove={move}
              />
            )}
          </ul>

          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
          {status === "failed" && (
            <p role="alert" className="mt-2 text-chrome-base text-status-danger">
              The new order could not be saved, so the list has gone back to the saved one.
            </p>
          )}
          {status === "saving" && <p className="mt-2 text-chrome-base text-text-muted">Saving order…</p>}
        </div>

        {selected && (
          <div className="min-w-0 space-y-6">
            <RoleEditor
              key={selected.id}
              role={selected}
              iconUrl={data.iconUrls[selected.id] ?? null}
              viewer={grants}
              editable={canManageRole(grants, selected) && !isTierRole(selected.systemKey)}
              canSave={canSave}
            />
            {selected.systemKey === null && canManageRole(grants, selected) && (
              <DeleteRoleCard role={selected} disabled={!canSave} onDeleted={() => setSelectedId(everyone?.id ?? "")} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The most important copy on the page. */
function Preamble() {
  return (
    <div className="rounded-xl border border-border-hairline bg-surface-panel p-4">
      <p className="text-content-sm text-text-default">
        Roles stack. A member holds every role given to them and can do the union of what those roles allow — the
        highest one that carries a colour sets the colour of their name.
      </p>
      <p className="mt-2 text-chrome-base text-text-muted">
        You can only edit, reorder and assign roles below your own highest role, and you cannot grant a permission you
        do not hold yourself. The tier roles and Moderator are assigned automatically and cannot be handed out here.
      </p>
    </div>
  );
}

/**
 * Local order with a debounced commit.
 *
 * A keyboard reorder has to feel immediate, so the list moves on keypress and
 * the write follows. Holding Move up through nine roles would otherwise fire
 * nine writes. On failure the list snaps back to the server order rather than
 * leaving someone looking at an arrangement that was never saved.
 */
function useRoleOrder(serverRoles: CommunityRole[], enabled: boolean) {
  // Highest first for display; @everyone is never in this list.
  const build = useCallback(
    (roles: CommunityRole[]) =>
      roles
        .filter((role) => role.systemKey !== "everyone")
        .slice()
        .sort((left, right) => right.position - left.position)
        .map((role) => ({ ...role, isArchived: false })),
    [],
  );

  const [order, setOrder] = useState(() => build(serverRoles));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [announcement, setAnnouncement] = useState("");

  // Re-seed during render, not in an effect, so a revalidated page paints the
  // server's order immediately instead of one frame of the stale local one.
  const [seeded, setSeeded] = useState(serverRoles);
  if (serverRoles !== seeded) {
    setSeeded(serverRoles);
    setOrder(build(serverRoles));
    setStatus("idle");
  }

  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const move = useCallback(
    (id: string, direction: "up" | "down") => {
      if (!enabled) return;
      const next = moveWithin(order, id, direction);
      if (next === order) return;
      setOrder(next);

      const index = next.findIndex((role) => role.id === id);
      setAnnouncement(describeMove(next[index].name, index + 1, next.length));

      if (timer.current !== null) window.clearTimeout(timer.current);
      setStatus("saving");
      timer.current = window.setTimeout(async () => {
        timer.current = null;
        // The RPC reads the array lowest-first, so index 1 lands at position 1
        // and @everyone keeps 0. The list itself is displayed highest-first.
        const result = await reorderRoles(next.map((role) => role.id).reverse());
        if (result.error) {
          setStatus("failed");
          setOrder(build(serverRoles));
          return;
        }
        setStatus("saved");
      }, COMMIT_DELAY_MS);
    },
    [build, enabled, order, serverRoles],
  );

  const canMoveRole = useCallback((id: string, direction: "up" | "down") => canMove(order, id, direction), [order]);

  return { order, status, announcement, move, canMoveRole };
}

function RoleRow({
  role,
  iconUrl,
  current,
  manageable,
  canMoveUp,
  canMoveDown,
  pinned = false,
  onSelect,
  onMove,
}: {
  role: CommunityRole;
  iconUrl: string | null;
  current: boolean;
  manageable: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  pinned?: boolean;
  onSelect: () => void;
  onMove: (id: string, direction: "up" | "down") => void;
}) {
  const automatic = role.systemKey !== null && role.systemKey !== "everyone";

  return (
    <li className={pinned ? "mt-2 border-t border-border-hairline pt-2" : undefined}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onSelect}
          aria-current={current ? "true" : undefined}
          className={`focus-ring flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 text-left text-content-sm transition-colors ${
            current ? "bg-surface-raised text-text-strong" : "text-text-muted hover:bg-surface-raised/50"
          }`}
        >
          {role.iconEmoji ? (
            <span aria-hidden="true" className="shrink-0">
              {role.iconEmoji}
            </span>
          ) : iconUrl ? (
            <Image
              src={iconUrl}
              alt=""
              width={16}
              height={16}
              unoptimized
              aria-hidden="true"
              className="size-4 shrink-0 rounded-md object-contain"
            />
          ) : (
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full border border-border-hairline"
              style={{ background: role.color }}
            />
          )}
          <span className="min-w-0 flex-1 truncate font-medium">{role.name}</span>
          {automatic && <Lock size={12} aria-hidden="true" className="shrink-0 text-text-faint" />}
          <span className="shrink-0 font-mono text-chrome-xs text-text-muted">{role.memberCount}</span>
        </button>

        {!pinned && (
          <span className="flex shrink-0 flex-col">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onMove(role.id, "up")}
              disabled={!manageable || !canMoveUp}
              aria-label={`Move ${role.name} up`}
            >
              <ChevronUp size={14} aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onMove(role.id, "down")}
              disabled={!manageable || !canMoveDown}
              aria-label={`Move ${role.name} down`}
            >
              <ChevronDown size={14} aria-hidden="true" />
            </Button>
          </span>
        )}
      </div>
    </li>
  );
}

function CreateRoleButton({ disabled, onCreated }: { disabled: boolean; onCreated: (roleId: string) => void }) {
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const nameId = useId();

  const submit = (data: FormData) =>
    startTransition(async () => {
      const result = await saveRole(data);
      if (result.error) {
        notify(result.error, "error");
        return;
      }
      setOpen(false);
      notify("Role created. It starts with no permissions at all.", "success");
      if (result.roleId) onCreated(result.roleId);
    });

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="chrome" disabled={disabled} onClick={() => setOpen(true)}>
        <Plus size={14} aria-hidden="true" />
        New role
      </Button>
    );
  }

  return (
    <form action={submit} className="w-full space-y-2 rounded-lg border border-border-hairline p-chrome-x">
      {/* A new role starts with no grants at all: it is created, then opened,
          and every permission on it is a deliberate second step. */}
      <input type="hidden" name="color" value="#94A3B8" />
      <label htmlFor={nameId} className="terminal-label block">
        New role name
      </label>
      <Input
        id={nameId}
        name="name"
        required
        autoFocus
        minLength={ROLE_LIMITS.name.min}
        maxLength={ROLE_LIMITS.name.max}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending && <Loader2 size={14} aria-hidden="true" className="animate-spin" />}
          Create
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * Deleting a role takes its grants away from everyone holding it, so the
 * confirmation asks for the name whenever anyone does.
 */
function DeleteRoleCard({
  role,
  disabled,
  onDeleted,
}: {
  role: CommunityRole;
  disabled: boolean;
  onDeleted: () => void;
}) {
  const notify = useToast();
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();
  const confirmId = useId();

  const needsTyping = role.memberCount > 0;
  const confirmed = !needsTyping || confirmation.trim() === role.name;

  const remove = () =>
    startTransition(async () => {
      const result = await deleteRole(role.id);
      if (result.error) {
        notify(result.error, "error");
        return;
      }
      notify(`Deleted ${role.name}.`, "success");
      onDeleted();
    });

  return (
    <div className="rounded-xl border border-status-danger/40 p-4">
      <h3 className="text-title-sm font-medium text-status-danger">Delete {role.name}</h3>
      <p className="mt-1 text-chrome-base text-text-muted">
        {needsTyping
          ? `${role.memberCount} ${role.memberCount === 1 ? "member holds" : "members hold"} this role and will lose everything it grants. Type ${role.name} to confirm.`
          : "Nobody holds this role, so nothing changes for any member."}
      </p>

      {needsTyping && (
        <>
          <label htmlFor={confirmId} className="sr-only">
            Type the role name to confirm deletion
          </label>
          <Input
            id={confirmId}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            className="mt-3 max-w-xs"
          />
        </>
      )}

      <Button
        type="button"
        variant="destructive"
        onClick={remove}
        disabled={disabled || !confirmed || pending}
        className="mt-3"
      >
        {pending ? (
          <Loader2 size={14} aria-hidden="true" className="animate-spin" />
        ) : (
          <Trash2 size={14} aria-hidden="true" />
        )}
        Delete role
      </Button>
    </div>
  );
}
