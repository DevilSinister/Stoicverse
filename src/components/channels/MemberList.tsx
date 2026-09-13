"use client";

import { useMemo, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";

import { giftMembership, restrictMember, unrestrictMember } from "@/app/community/member-actions";
import { banMember, timeoutMember, untimeoutMember } from "@/app/community/moderation-actions";
import { useCommunity } from "@/components/channels/CommunityProvider";
import { memberMenuItems, type MemberMenuContext } from "@/components/channels/MemberMenuItems";
import { useToast } from "@/components/ui/toast";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { groupMembers } from "@/lib/channels/presence";
import { SANCTION_LIMITS } from "@/lib/community-settings/model";
import type { DirectoryMember } from "@/lib/community/messages";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Who is in the community, and what can be done about them.
 *
 * The grouping rule lives in `presence.ts`; the action list lives in
 * `MemberMenuItems.tsx` and is rendered into both a left-click dropdown and a
 * right-click context menu from the same source, so the two cannot drift.
 *
 * Every destructive action asks for the reason its case will carry, because
 * the database refuses one without it.
 */

type Pending =
  | { kind: "timeout"; member: DirectoryMember; seconds: number }
  | { kind: "ban"; member: DirectoryMember }
  | { kind: "restrict"; member: DirectoryMember; scope: "channel" | "category"; scopeId: string; scopeLabel: string }
  | null;

const DROPDOWN_PARTS = {
  Item: DropdownMenuItem,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
  Separator: DropdownMenuSeparator,
};

const CONTEXT_PARTS = {
  Item: ContextMenuItem,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
  Separator: ContextMenuSeparator,
};

export function MemberList({
  channelId,
  onMention,
  variant = "column",
}: {
  channelId: string;
  onMention: (name: string) => void;
  /**
   * `column` is the permanent right-hand column, which only exists from `xl`
   * up. `drawer` is the same list inside the mobile pane, where it is already
   * inside a labelled dialog with its own heading and scroller.
   */
  variant?: "column" | "drawer";
}) {
  const { members, viewer, onlineIds, affordances, channels, openProfile } = useCommunity();
  const permissions = affordances(channelId);
  const channel = channels.find((entry) => entry.id === channelId);

  const grants = viewer?.grants ?? [];
  const can = (key: string) => grants.includes(key) || grants.includes("administrator");
  const canTimeout = can("moderate_members");
  const canBan = can("ban_members");
  const isOwner = Boolean(viewer?.isInfluencer);
  const canSeeDetail = isOwner || canTimeout;

  const notify = useToast();

  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const sections = useMemo(() => groupMembers(members, onlineIds), [members, onlineIds]);

  // Plain functions, deliberately. None of these is passed to a memoised
  // child, so a useCallback bought nothing here and cost the React compiler
  // its ability to optimise the component at all.
  const gift = async (member: DirectoryMember, days: number) => {
    const result = await giftMembership(member.id, days);
    if (result.error) {
      notify(result.error);
      return;
    }
    const until = result.expiresAt ? new Date(result.expiresAt).toLocaleDateString() : null;
    notify(
      until ? `${member.fullName} now has access until ${until}.` : `${member.fullName} was gifted access.`,
      "success",
    );
  };

  const run = async () => {
    if (!pending) return;
    setBusy(true);

    const result =
      pending.kind === "timeout"
        ? await timeoutMember(pending.member.id, pending.seconds, reason)
        : pending.kind === "ban"
          ? await banMember(pending.member.id, reason)
          : await restrictMember(pending.member.id, pending.scope, pending.scopeId, reason);

    setBusy(false);
    if (result.error) {
      // The dialog stays open with the typed reason intact; the refusal goes
      // to a toast rather than resizing the dialog under the cursor.
      notify(result.error);
      return;
    }
    notify(
      pending.kind === "restrict"
        ? `${pending.member.fullName} was removed from ${pending.scopeLabel}.`
        : pending.kind === "ban"
          ? `${pending.member.fullName} was banned.`
          : `${pending.member.fullName} was timed out.`,
      "success",
    );
    setPending(null);
    setReason("");
  };

  const contextFor = (member: DirectoryMember): MemberMenuContext => ({
    isSelf: member.id === viewer?.userId,
    canMention: permissions.composer === "ready",
    canTimeout,
    canBan,
    canSeeDetail,
    canGift: isOwner,
    channelName: channel?.name ?? "this channel",
    categoryName: channel?.categoryName ?? "this category",
    onMention: () => onMention(member.fullName),
    onDetail: () => openProfile(member.id),
    onGift: (days) => void gift(member, days),
    onTimeout: (seconds) => {
      setReason("");
      setPending({ kind: "timeout", member, seconds });
    },
    onRemoveTimeout: () => {
      void untimeoutMember(member.id).then((result) =>
        result.error
          ? notify(result.error)
          : notify(`${member.fullName}'s timeout was removed.`, "success"),
      );
    },
    onRestrict: (scope) => {
      if (!channel) return;
      setReason("");
      setPending({
        kind: "restrict",
        member,
        scope,
        scopeId: scope === "channel" ? channel.id : channel.categoryId,
        scopeLabel: scope === "channel" ? `#${channel.name}` : channel.categoryName,
      });
    },
    onLift: (scope) => {
      if (!channel) return;
      const scopeId = scope === "channel" ? channel.id : channel.categoryId;
      void unrestrictMember(member.id, scope, scopeId).then((result) =>
        result.error
          ? notify(result.error)
          : notify(`${member.fullName}'s restriction was lifted.`, "success"),
      );
    },
    onBan: () => {
      setReason("");
      setPending({ kind: "ban", member });
    },
  });

  return (
    <aside
      aria-label={variant === "drawer" ? undefined : "Members"}
      className={
        variant === "drawer"
          ? "flex min-h-0 flex-col"
          : "hidden min-h-0 w-56 shrink-0 flex-col border-l border-surgical-steel bg-surface-container-lowest xl:flex"
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {sections.length === 0 ? <p className="px-2 text-xs text-fog-muted">Nobody here yet.</p> : null}

        {sections.map((section) => (
          <div key={section.key} className="mb-4">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
              <span
                style={section.color ? { color: section.color } : undefined}
                className={section.color ? "" : "text-fog-muted"}
              >
                {`${section.label} — ${section.members.length}`}
              </span>
            </p>
            <ul className="space-y-0.5">
              {section.members.map((entry) => {
                const member = members.find((candidate) => candidate.id === entry.id) ?? (entry as DirectoryMember);
                const online = onlineIds.has(member.id);
                const context = contextFor(member);
                const row = (
                  <>
                    <span className="relative shrink-0">
                      <span className="flex size-6 items-center justify-center rounded-full bg-surface-container-high text-[11px] font-semibold text-on-surface-variant">
                        {member.fullName.slice(0, 1).toUpperCase()}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface-container-lowest ${
                          online ? "bg-primary-container" : "bg-fog-muted"
                        }`}
                      />
                    </span>
                    <span
                      className="truncate"
                      style={member.topRoleColor && online ? { color: member.topRoleColor } : undefined}
                    >
                      {member.fullName}
                    </span>
                    <span className="sr-only">{online ? "online" : "offline"}</span>
                  </>
                );
                const rowClass = `focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-surface-container-low ${
                  online ? "text-on-surface" : "text-fog-muted opacity-60"
                }`;

                return (
                  <li key={member.id}>
                    {/*
                      Left-click opens the person, right-click opens what can
                      be done to them — the split Discord uses, and the one
                      somebody clicking a name is expecting. The actions are
                      also on the "..." button, because a right-click is not
                      available on a touchscreen and `Mention` would otherwise
                      be unreachable there.
                    */}
                    <ContextMenu>
                      <ContextMenuTrigger className="block">
                        <div className="group/member relative flex items-center">
                          <button type="button" className={rowClass} onClick={() => openProfile(member.id)}>
                            {row}
                          </button>

                          <DropdownMenu>
                            {/*
                              `opacity-0`, never `display: none`: the menu
                              portals to the body, and a trigger with no
                              layout box puts it in the top-left corner.
                            */}
                            <DropdownMenuTrigger
                              aria-label={`Actions for ${member.fullName}`}
                              className="focus-ring hit-target absolute right-1 rounded p-1 text-fog-muted opacity-0 group-focus-within/member:opacity-100 group-hover/member:opacity-100 data-[popup-open]:opacity-100 hover:text-on-surface"
                            >
                              <MoreVertical size={13} aria-hidden="true" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <MemberHeader member={member} />
                              {memberMenuItems(DROPDOWN_PARTS, context)}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56">
                        <MemberHeader member={member} />
                        {memberMenuItems(CONTEXT_PARTS, context)}
                      </ContextMenuContent>
                    </ContextMenu>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {pending ? (
        <ReasonDialog
          title={
            pending.kind === "ban"
              ? `Ban ${pending.member.fullName} from the community?`
              : pending.kind === "restrict"
                ? `Remove ${pending.member.fullName} from ${pending.scopeLabel}?`
                : `Time out ${pending.member.fullName}`
          }
          busy={busy}
          confirmLabel={pending.kind === "ban" ? "Ban" : pending.kind === "restrict" ? "Remove" : "Time out"}
          destructive={pending.kind !== "timeout"}
          onCancel={() => setPending(null)}
          onConfirm={() => void run()}
        >
          <label className="block text-xs text-on-surface-variant">
            {/*
              Required, not optional. `parseModerationReason` refuses an empty
              one for every sanction that is not an undo, so a dialog that let
              this through would only produce a failure to read and redo.
            */}
            Reason — kept with the case, and the record of why this happened.
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              minLength={SANCTION_LIMITS.reason.min}
              maxLength={SANCTION_LIMITS.reason.max}
              autoFocus
              className="mt-1 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest p-2 text-sm text-on-surface outline-none"
            />
          </label>
        </ReasonDialog>
      ) : null}
    </aside>
  );
}

function MemberHeader({ member }: { member: DirectoryMember }) {
  return (
    <div className="px-2 py-1.5">
      <p className="truncate text-xs font-semibold text-on-surface">{member.fullName}</p>
      {member.roles.length > 0 ? (
        <p className="mt-1 flex flex-wrap gap-1">
          {member.roles.map((role) => (
            <span
              key={role.id}
              className="rounded border border-surgical-steel px-1 text-[10px]"
              style={role.color ? { color: role.color } : undefined}
            >
              {role.name}
            </span>
          ))}
        </p>
      ) : (
        <p className="mt-0.5 text-[11px] text-fog-muted">No roles</p>
      )}
    </div>
  );
}

function ReasonDialog({
  title,
  children,
  busy,
  confirmLabel,
  destructive,
  onCancel,
  onConfirm,
}: {
  title: string;
  children: ReactNode;
  busy: boolean;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // The twin of MessageMenu's ActionDialog, down to the props. Both are thin
  // wrappers over the one confirm now, which is why they can stay separate
  // local components without being a second implementation of anything.
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={title}
      confirmLabel={confirmLabel}
      tone={destructive ? "danger" : "default"}
      busy={busy}
      onConfirm={onConfirm}
    >
      {children}
    </ConfirmDialog>
  );
}
