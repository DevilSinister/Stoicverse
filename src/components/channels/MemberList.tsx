"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Loader2, ShieldBan, ShieldMinus, Timer } from "lucide-react";

import { banMember, timeoutMember, untimeoutMember } from "@/app/community/moderation-actions";
import { useCommunity } from "@/components/channels/CommunityProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { groupMembers } from "@/lib/channels/presence";
import { SANCTION_LIMITS, TIMEOUT_PRESETS } from "@/lib/community-settings/model";
import type { DirectoryMember } from "@/lib/community/messages";

/**
 * Who is in the community, grouped by hoisted role and by whether they are
 * here.
 *
 * The grouping rule lives in `presence.ts` and is tested there. What this adds
 * is the part that acts: a member's menu offers only the sanctions the viewer
 * actually holds the permission for, and each one asks for the reason its case
 * will carry — the database refuses a timeout or a ban without one, so a
 * dialog that did not ask would only produce a failure to read and redo.
 */

type Pending = { kind: "timeout" | "ban"; member: DirectoryMember; seconds?: number } | null;

export function MemberList({ channelId, onMention }: { channelId: string; onMention: (name: string) => void }) {
  const { members, viewer, onlineIds, affordances } = useCommunity();
  const permissions = affordances(channelId);

  const grants = viewer?.grants ?? [];
  const can = (key: string) => grants.includes(key) || grants.includes("administrator");
  const canTimeout = can("moderate_members");
  const canBan = can("ban_members");

  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo(() => groupMembers(members, onlineIds), [members, onlineIds]);

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    const result =
      pending.kind === "timeout"
        ? await timeoutMember(pending.member.id, pending.seconds ?? 600, reason)
        : await banMember(pending.member.id, reason);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPending(null);
    setReason("");
  };

  return (
    <aside
      aria-label="Members"
      className="hidden min-h-0 w-56 shrink-0 flex-col border-l border-surgical-steel bg-surface-container-lowest xl:flex"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {sections.length === 0 ? <p className="px-2 text-xs text-fog-muted">Nobody here yet.</p> : null}

        {sections.map((section) => (
          <div key={section.key} className="mb-4">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
              <span style={section.color ? { color: section.color } : undefined} className={section.color ? "" : "text-fog-muted"}>
                {`${section.label} — ${section.members.length}`}
              </span>
            </p>
            <ul className="space-y-0.5">
              {section.members.map((member) => {
                const full = members.find((entry) => entry.id === member.id);
                const online = onlineIds.has(member.id);
                const subject = full ?? (member as DirectoryMember);
                return (
                  <li key={member.id}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={`focus-ring flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-surface-container-low ${
                          online ? "text-on-surface" : "text-fog-muted opacity-60"
                        }`}
                      >
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
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end" className="w-56">
                        <div className="px-2 py-1.5">
                          <p className="truncate text-xs font-semibold text-on-surface">{member.fullName}</p>
                          {(full?.roles ?? []).length > 0 ? (
                            <p className="mt-1 flex flex-wrap gap-1">
                              {(full?.roles ?? []).map((role) => (
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

                        <DropdownMenuSeparator />
                        {permissions.composer === "ready" ? (
                          <DropdownMenuItem onClick={() => onMention(member.fullName)}>Mention</DropdownMenuItem>
                        ) : null}

                        {/*
                          A moderator cannot sanction themselves — the database
                          refuses it, so offering it would be offering a
                          guaranteed failure.
                        */}
                        {member.id !== viewer?.userId && (canTimeout || canBan) ? (
                          <>
                            <DropdownMenuSeparator />
                            {canTimeout
                              ? TIMEOUT_PRESETS.map((preset) => (
                                  <DropdownMenuItem
                                    key={preset.seconds}
                                    onClick={() => {
                                      setReason("");
                                      setError(null);
                                      setPending({ kind: "timeout", member: subject, seconds: preset.seconds });
                                    }}
                                  >
                                    <span className="flex items-center gap-2">
                                      <Timer size={13} aria-hidden="true" />
                                      {`Time out for ${preset.label}`}
                                    </span>
                                  </DropdownMenuItem>
                                ))
                              : null}
                            {canTimeout ? (
                              <DropdownMenuItem onClick={() => void untimeoutMember(member.id)}>
                                <span className="flex items-center gap-2">
                                  <ShieldMinus size={13} aria-hidden="true" />
                                  Remove timeout
                                </span>
                              </DropdownMenuItem>
                            ) : null}
                            {canBan ? (
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => {
                                  setReason("");
                                  setError(null);
                                  setPending({ kind: "ban", member: subject });
                                }}
                              >
                                <span className="flex items-center gap-2">
                                  <ShieldBan size={13} aria-hidden="true" />
                                  Ban from the community
                                </span>
                              </DropdownMenuItem>
                            ) : null}
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {pending ? (
        <ReasonDialog
          title={pending.kind === "ban" ? `Ban ${pending.member.fullName}?` : `Time out ${pending.member.fullName}`}
          busy={busy}
          error={error}
          confirmLabel={pending.kind === "ban" ? "Ban" : "Time out"}
          destructive={pending.kind === "ban"}
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
