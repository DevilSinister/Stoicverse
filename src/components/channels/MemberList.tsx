"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { giftMembership, restrictMember, unrestrictMember } from "@/app/community/member-actions";
import { banMember, timeoutMember, untimeoutMember } from "@/app/community/moderation-actions";
import { useCommunity } from "@/components/channels/CommunityProvider";
import { memberMenuItems, type MemberMenuContext } from "@/components/channels/MemberMenuItems";
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
import { createClient } from "@/lib/supabase/client";

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

type Detail = {
  full_name: string;
  joined_at: string | null;
  platform_role: string | null;
  membership_status: string | null;
  membership_expires_at: string | null;
  membership_source: string | null;
  amount_paid: number | null;
  message_count: number | null;
  roles: { id: string; name: string; color: string | null }[] | null;
};

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

export function MemberList({ channelId, onMention }: { channelId: string; onMention: (name: string) => void }) {
  const { members, viewer, onlineIds, affordances, channels } = useCommunity();
  const permissions = affordances(channelId);
  const channel = channels.find((entry) => entry.id === channelId);

  const grants = viewer?.grants ?? [];
  const can = (key: string) => grants.includes(key) || grants.includes("administrator");
  const canTimeout = can("moderate_members");
  const canBan = can("ban_members");
  const isOwner = Boolean(viewer?.isInfluencer);
  const canSeeDetail = isOwner || canTimeout;

  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detailFor, setDetailFor] = useState<DirectoryMember | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  const sections = useMemo(() => groupMembers(members, onlineIds), [members, onlineIds]);

  // Plain functions, deliberately. None of these is passed to a memoised
  // child, so a useCallback bought nothing here and cost the React compiler
  // its ability to optimise the component at all.
  const say = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => (current === message ? null : current)), 4000);
  };

  const openDetail = async (member: DirectoryMember) => {
    setDetailFor(member);
    setDetail(null);
    const supabase = createClient();
    const { data } = await supabase.rpc("community_member_detail", { target: member.id });
    setDetail((data as Detail[] | null)?.[0] ?? null);
  };

  const gift = async (member: DirectoryMember, days: number) => {
    setError(null);
    const result = await giftMembership(member.id, days);
    if (result.error) {
      say(result.error);
      return;
    }
    const until = result.expiresAt ? new Date(result.expiresAt).toLocaleDateString() : null;
    say(until ? `${member.fullName} now has access until ${until}.` : `${member.fullName} was gifted access.`);
    // The panel is showing what just changed, so it re-reads rather than lying.
    if (detailFor?.id === member.id) void openDetail(member);
  };

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);

    const result =
      pending.kind === "timeout"
        ? await timeoutMember(pending.member.id, pending.seconds, reason)
        : pending.kind === "ban"
          ? await banMember(pending.member.id, reason)
          : await restrictMember(pending.member.id, pending.scope, pending.scopeId, reason);

    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    say(
      pending.kind === "restrict"
        ? `${pending.member.fullName} was removed from ${pending.scopeLabel}.`
        : pending.kind === "ban"
          ? `${pending.member.fullName} was banned.`
          : `${pending.member.fullName} was timed out.`,
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
    onDetail: () => void openDetail(member),
    onGift: (days) => void gift(member, days),
    onTimeout: (seconds) => {
      setReason("");
      setError(null);
      setPending({ kind: "timeout", member, seconds });
    },
    onRemoveTimeout: () => {
      void untimeoutMember(member.id).then((result) =>
        say(result.error ?? `${member.fullName}'s timeout was removed.`),
      );
    },
    onRestrict: (scope) => {
      if (!channel) return;
      setReason("");
      setError(null);
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
        say(result.error ?? `${member.fullName}'s restriction was lifted.`),
      );
    },
    onBan: () => {
      setReason("");
      setError(null);
      setPending({ kind: "ban", member });
    },
  });

  return (
    <aside
      aria-label="Members"
      className="hidden min-h-0 w-56 shrink-0 flex-col border-l border-surgical-steel bg-surface-container-lowest xl:flex"
    >
      {notice ? (
        <p role="status" className="border-b border-surgical-steel px-3 py-2 text-[11px] text-on-surface-variant">
          {notice}
        </p>
      ) : null}

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
                const rowClass = `focus-ring flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-surface-container-low ${
                  online ? "text-on-surface" : "text-fog-muted opacity-60"
                }`;

                return (
                  <li key={member.id}>
                    {/*
                      Right-click and left-click open the same list. The context
                      menu wraps the row; the dropdown is the row. Two triggers,
                      one set of actions.
                    */}
                    <ContextMenu>
                      <ContextMenuTrigger className="block">
                        <DropdownMenu>
                          <DropdownMenuTrigger className={rowClass}>{row}</DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <MemberHeader member={member} />
                            {memberMenuItems(DROPDOWN_PARTS, context)}
                          </DropdownMenuContent>
                        </DropdownMenu>
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

      {detailFor ? (
        <MemberDetailDialog
          member={detailFor}
          detail={detail}
          canGift={isOwner}
          onGift={(days) => void gift(detailFor, days)}
          onClose={() => {
            setDetailFor(null);
            setDetail(null);
          }}
        />
      ) : null}

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
          error={error}
          confirmLabel={pending.kind === "ban" ? "Ban" : pending.kind === "restrict" ? "Remove" : "Time out"}
          destructive={pending.kind !== "timeout"}
          onCancel={() => {
            setPending(null);
            setError(null);
          }}
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

function MemberDetailDialog({
  member,
  detail,
  canGift,
  onGift,
  onClose,
}: {
  member: DirectoryMember;
  detail: Detail | null;
  canGift: boolean;
  onGift: (days: number) => void;
  onClose: () => void;
}) {
  const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString() : "—");
  const expiry = detail?.membership_expires_at ?? null;
  // Read once when the panel opens. `Date.now()` during render is impure, and
  // a membership does not lapse in the seconds somebody spends reading it.
  const [openedAt] = useState(() => Date.now());
  const lapsed = expiry !== null && Date.parse(expiry) < openedAt;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${member.fullName}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-surgical-steel bg-surface-container-low p-4">
        <h2 className="text-sm font-semibold text-on-surface">{member.fullName}</h2>

        {detail === null ? (
          <p className="mt-3 text-xs text-fog-muted">Loading…</p>
        ) : (
          <dl className="mt-3 space-y-1.5 text-xs">
            <Row label="Member since" value={date(detail.joined_at)} />
            <Row label="Account" value={detail.platform_role ?? "member"} />
            <Row
              label="Membership"
              value={
                detail.membership_status
                  ? `${detail.membership_status}${lapsed ? " (lapsed)" : ""}`
                  : "none"
              }
            />
            <Row label="Access until" value={date(expiry)} />
            <Row
              label="Paid via"
              value={
                detail.membership_source === "gifted"
                  ? "gifted"
                  : detail.membership_source === "stripe"
                    ? `Stripe${detail.amount_paid ? ` — ${detail.amount_paid}` : ""}`
                    : "—"
              }
            />
            <Row label="Messages" value={String(detail.message_count ?? 0)} />
          </dl>
        )}

        {canGift ? (
          <div className="mt-4 border-t border-surgical-steel pt-3">
            <p className="text-[11px] text-fog-muted">
              {/*
                Says "extends", because that is what it does: a gift starts from
                whatever they already have, not from today.
              */}
              Gift access — extends whatever they already have.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                { days: 7, label: "1 week" },
                { days: 30, label: "1 month" },
                { days: 90, label: "3 months" },
                { days: 365, label: "1 year" },
              ].map((option) => (
                <button
                  key={option.days}
                  type="button"
                  onClick={() => onGift(option.days)}
                  className="focus-ring rounded-lg border border-surgical-steel px-2 py-1 text-[11px] text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-lg border border-surgical-steel px-3 py-1.5 text-xs text-on-surface-variant"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-fog-muted">{label}</dt>
      <dd className="truncate text-on-surface-variant">{value}</dd>
    </div>
  );
}

function ReasonDialog({
  title,
  children,
  busy,
  error,
  confirmLabel,
  destructive,
  onCancel,
  onConfirm,
}: {
  title: string;
  children: ReactNode;
  busy: boolean;
  error: string | null;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-surgical-steel bg-surface-container-low p-4">
        <h2 className="text-sm font-semibold text-on-surface">{title}</h2>
        <div className="mt-3">{children}</div>
        {error ? (
          <p role="alert" className="mt-2 text-xs text-red-300">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring rounded-lg border border-surgical-steel px-3 py-1.5 text-xs text-on-surface-variant"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`focus-ring inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
              destructive ? "bg-error text-monolith-surface" : "bg-primary-container text-monolith-surface"
            }`}
          >
            {busy ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
