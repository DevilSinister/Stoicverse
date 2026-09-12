"use client";

import { useEffect, useState } from "react";
import { Gift, Loader2, ShieldBan, ShieldMinus, Timer } from "lucide-react";

import { giftMembership } from "@/app/community/member-actions";
import { banMember, timeoutMember, untimeoutMember } from "@/app/community/moderation-actions";
import { useCommunity } from "@/components/channels/CommunityProvider";
import { GIFT_OPTIONS } from "@/components/channels/MemberMenuItems";
import { useToast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SANCTION_LIMITS, TIMEOUT_PRESETS } from "@/lib/community-settings/model";
import { createClient } from "@/lib/supabase/client";

/**
 * One person's card.
 *
 * Opened from a name or an avatar anywhere on the page — a message, the member
 * list — and it is the same card every time. Two reads back it:
 *
 *   * `community_member_profile` is open to any signed-in member and carries
 *     what a community is entitled to know about the people in it: the name,
 *     the picture, the roles, the day they joined.
 *   * `community_member_detail` is refused to anybody without
 *     `moderate_members`, and carries what somebody paid. That is not public
 *     information inside a community, so it is a second call rather than a
 *     wider first one — a member cannot receive a field the server never sent.
 *
 * The moderation half is drawn from the viewer's grants, but nothing here is
 * the decision: every action calls an RPC that asks the same questions again,
 * checks the role hierarchy, and writes the case.
 */

type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  joined_at: string | null;
  platform_role: string | null;
  roles: { id: string; name: string; color: string | null; position: number }[] | null;
};

type Detail = {
  membership_status: string | null;
  membership_expires_at: string | null;
  membership_source: string | null;
  amount_paid: number | null;
  message_count: number | null;
};

type Pending = { kind: "timeout"; seconds: number } | { kind: "ban" } | null;

const ACCOUNT_LABEL: Record<string, string> = {
  influencer: "Creator",
  super_admin: "Administrator",
  member: "Member",
};

export function MemberProfileDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { viewer, onlineIds, members } = useCommunity();

  const grants = viewer?.grants ?? [];
  const can = (key: string) => grants.includes(key) || grants.includes("administrator");
  const isSelf = userId === viewer?.userId;
  const isOwner = Boolean(viewer?.isInfluencer);
  const canTimeout = can("moderate_members");
  const canBan = can("ban_members");
  const canSeeDetail = isOwner || canTimeout;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const notify = useToast();

  // Loads once, on mount. The shell keys this component on the person it is
  // showing, so opening a second card while the first is open remounts rather
  // than re-runs — which is why there is no state to reset here, and why the
  // card can never briefly show one person's roles under another's name.
  useEffect(() => {
    let live = true;

    void (async () => {
      const supabase = createClient();
      const [profileResult, detailResult] = await Promise.all([
        supabase.rpc("community_member_profile", { target: userId }),
        canSeeDetail ? supabase.rpc("community_member_detail", { target: userId }) : Promise.resolve({ data: null }),
      ]);
      if (!live) return;
      const row = (profileResult.data as Profile[] | null)?.[0] ?? null;
      setProfile(row);
      setMissing(row === null);
      setDetail((detailResult.data as Detail[] | null)?.[0] ?? null);
    })();

    return () => {
      live = false;
    };
  }, [userId, canSeeDetail]);

  const name = profile?.full_name ?? members.find((member) => member.id === userId)?.fullName ?? "Member";
  const online = onlineIds.has(userId);
  const topColor = profile?.roles?.find((role) => role.color)?.color ?? null;

  // The creator is not moderatable from here, and neither is yourself. The
  // database refuses both; offering the buttons would only produce a refusal
  // somebody has to read to understand.
  const targetIsOwner = profile?.platform_role === "influencer" || profile?.platform_role === "super_admin";
  const moderating = !isSelf && !targetIsOwner && (canTimeout || canBan);

  const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString() : "—");

  const gift = async (days: number) => {
    const result = await giftMembership(userId, days);
    if (result.error) {
      notify(result.error);
      return;
    }
    const until = result.expiresAt ? new Date(result.expiresAt).toLocaleDateString() : null;
    notify(until ? `${name} now has access until ${until}.` : `${name} was gifted access.`, "success");
    // The card is showing what just changed, so it re-reads rather than lying.
    const supabase = createClient();
    const { data } = await supabase.rpc("community_member_detail", { target: userId });
    setDetail((data as Detail[] | null)?.[0] ?? null);
  };

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    const result =
      pending.kind === "timeout"
        ? await timeoutMember(userId, pending.seconds, reason)
        : await banMember(userId, reason);
    setBusy(false);
    if (result.error) {
      // The confirmation stays open with the reason still typed in it.
      notify(result.error);
      return;
    }
    notify(pending.kind === "ban" ? `${name} was banned.` : `${name} was timed out.`, "success");
    setPending(null);
    setReason("");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Profile for ${name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        // Escape backs out of the reason first: somebody halfway through
        // typing why they are banning a person has not asked to close the card.
        if (pending) setPending(null);
        else if (!busy) onClose();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-xl border border-surgical-steel bg-surface-container-low">
        <div className="flex items-start gap-3 border-b border-surgical-steel p-4">
          <span className="relative shrink-0">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="size-14 rounded-full object-cover" />
            ) : (
              <span className="flex size-14 items-center justify-center rounded-full bg-surface-container-high text-lg font-semibold text-on-surface-variant">
                {name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span
              aria-hidden="true"
              className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-surface-container-low ${
                online ? "bg-primary-container" : "bg-fog-muted"
              }`}
            />
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold" style={topColor ? { color: topColor } : undefined}>
              <span className={topColor ? "" : "text-on-surface"}>{name}</span>
            </h2>
            <p className="text-[11px] text-fog-muted">
              {`${ACCOUNT_LABEL[profile?.platform_role ?? "member"] ?? "Member"} · ${online ? "Online" : "Offline"}`}
            </p>
          </div>
        </div>

        {missing ? (
          <p className="p-4 text-xs text-fog-muted">This account is no longer here.</p>
        ) : profile === null ? (
          <p className="p-4 text-xs text-fog-muted">Loading…</p>
        ) : (
          <div className="space-y-4 p-4">
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fog-muted">Roles</h3>
              {profile.roles && profile.roles.length > 0 ? (
                <ul className="mt-1.5 flex flex-wrap gap-1">
                  {profile.roles.map((role) => (
                    <li
                      key={role.id}
                      className="flex items-center gap-1 rounded border border-surgical-steel px-1.5 py-0.5 text-[11px]"
                      style={role.color ? { color: role.color } : undefined}
                    >
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-full"
                        style={{ backgroundColor: role.color ?? "currentColor" }}
                      />
                      <span className={role.color ? "" : "text-on-surface-variant"}>{role.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-fog-muted">No roles.</p>
              )}
            </section>

            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fog-muted">Member since</h3>
              <p className="mt-1 text-xs text-on-surface-variant">{date(profile.joined_at)}</p>
            </section>

            {/*
              Only a moderator or the owner ever receives this half, and only
              they ever see it. `community_member_detail` refuses everybody
              else, so a member's browser never holds these values at all.
            */}
            {canSeeDetail && detail ? (
              <section className="border-t border-surgical-steel pt-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fog-muted">
                  Membership
                </h3>
                <dl className="mt-1.5 space-y-1 text-xs">
                  <Row label="Status" value={detail.membership_status ?? "none"} />
                  <Row label="Access until" value={date(detail.membership_expires_at)} />
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
              </section>
            ) : null}

            {moderating || (isOwner && !isSelf) ? (
              <section className="border-t border-surgical-steel pt-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fog-muted">
                  Moderation
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {canTimeout && moderating ? (
                    <>
                      {/*
                        The duration is chosen after the decision to time
                        somebody out, not before it — six buttons in the open
                        would be six punishments on a card somebody opened to
                        read a name.
                      */}
                      <DropdownMenu>
                        <DropdownMenuTrigger className="focus-ring flex items-center gap-1.5 rounded-lg border border-surgical-steel px-2 py-1 text-[11px] text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface">
                          <Timer size={12} aria-hidden="true" />
                          Time out
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44">
                          {TIMEOUT_PRESETS.map((preset) => (
                            <DropdownMenuItem
                              key={preset.seconds}
                              onClick={() => {
                                setReason("");
                                setPending({ kind: "timeout", seconds: preset.seconds });
                              }}
                            >
                              {preset.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <button
                        type="button"
                        onClick={() =>
                          void untimeoutMember(userId).then((result) =>
                            result.error
                              ? notify(result.error)
                              : notify(`${name}'s timeout was removed.`, "success"),
                          )
                        }
                        className="focus-ring flex items-center gap-1.5 rounded-lg border border-surgical-steel px-2 py-1 text-[11px] text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface"
                      >
                        <ShieldMinus size={12} aria-hidden="true" />
                        Remove timeout
                      </button>
                    </>
                  ) : null}

                  {canBan && moderating ? (
                    <button
                      type="button"
                      onClick={() => {
                        setReason("");
                        setPending({ kind: "ban" });
                      }}
                      className="focus-ring flex items-center gap-1.5 rounded-lg border border-error/50 px-2 py-1 text-[11px] text-error hover:bg-error/10"
                    >
                      <ShieldBan size={12} aria-hidden="true" />
                      Ban
                    </button>
                  ) : null}

                  {/*
                    Gifting is the owner's alone — `community_gift_membership`
                    refuses a moderator, so showing it to one would be showing
                    a guaranteed failure.
                  */}
                  {isOwner && !isSelf ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger className="focus-ring flex items-center gap-1.5 rounded-lg border border-surgical-steel px-2 py-1 text-[11px] text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface">
                        <Gift size={12} aria-hidden="true" />
                        Gift a membership
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-44">
                        {GIFT_OPTIONS.map((option) => (
                          <DropdownMenuItem key={option.days} onClick={() => void gift(option.days)}>
                            {option.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>

                {targetIsOwner && (canTimeout || canBan) ? (
                  <p className="mt-2 text-[11px] text-fog-muted">
                    The creator cannot be sanctioned from here.
                  </p>
                ) : null}
              </section>
            ) : null}
          </div>
        )}

        <div className="flex justify-end border-t border-surgical-steel px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-lg border border-surgical-steel px-3 py-1.5 text-xs text-on-surface-variant"
          >
            Close
          </button>
        </div>
      </div>

      {pending ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={pending.kind === "ban" ? `Ban ${name}` : `Time out ${name}`}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-sm rounded-xl border border-surgical-steel bg-surface-container-low p-4">
            <h2 className="text-sm font-semibold text-on-surface">
              {pending.kind === "ban" ? `Ban ${name} from the community?` : `Time out ${name}`}
            </h2>
            <label className="mt-3 block text-xs text-on-surface-variant">
              {/*
                Required, not optional. `parseModerationReason` refuses an
                empty one for every sanction that is not an undo.
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
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={busy}
                className="focus-ring rounded-lg border border-surgical-steel px-3 py-1.5 text-xs text-on-surface-variant disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void run()}
                disabled={busy}
                className={`focus-ring flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-monolith-surface disabled:opacity-50 ${
                  pending.kind === "ban" ? "bg-error" : "bg-primary-container"
                }`}
              >
                {busy ? <Loader2 size={12} aria-hidden="true" className="animate-spin" /> : null}
                {pending.kind === "ban" ? "Ban" : "Time out"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
