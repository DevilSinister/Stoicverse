"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Ban, CircleDollarSign, LoaderCircle, Shield, ShieldOff, Sparkles, UserRoundCog } from "lucide-react";

import { giftMemberSubscription, moderateMember, setMemberPlatformRole } from "@/app/creator/members/actions";
import { MemberModalShell } from "@/components/creator/members/MemberModalShell";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import type { MemberSummary } from "@/lib/member-operations/types";

/**
 * A member's record, and the three things a creator can do to it. Monolith,
 * phase 11b.
 *
 * **The suspend confirmation was `bg-error text-accent-contrast`** — the
 * accent's own contrast colour on the danger fill. It happens to be legible,
 * which is why it survived: the colour is only wrong in the sense that it means
 * something else, and the day `--accent-contrast` moves to suit the accent this
 * button moves with it for no reason. It is the `destructive` variant now,
 * which is what the system has for exactly this.
 *
 * The status chips here and in the registry were two hand-written tone ladders
 * with the same three branches. Both are `ui/status-badge`.
 *
 * Everything else is the token layer, the primitives, and making a file whose
 * three action panels were one line each readable.
 */

const date = (value: string | null) =>
  value ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value)) : "—";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

const statusTone = (status: MemberSummary["membershipStatus"]): StatusTone =>
  status === "suspended" ? "danger" : status === "active" || status === "gifted" ? "accent" : "neutral";

export function MemberDetailModal({
  memberId,
  onClose,
  onChanged,
}: {
  memberId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [member, setMember] = useState<MemberSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [actionPanel, setActionPanel] = useState<"gift" | "moderation" | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const fetchMember = useCallback(async () => {
    const response = await fetch(`/api/creator/members/${memberId}`, { cache: "no-store" });
    const payload = (await response.json()) as { member?: MemberSummary; error?: string };
    if (!response.ok || !payload.member) throw new Error(payload.error ?? "Member details unavailable");
    return payload.member;
  }, [memberId]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    void fetchMember()
      .then(setMember)
      .catch(() => setLoadError("Member details could not be loaded. Try again."))
      .finally(() => setLoading(false));
  }, [fetchMember]);

  useEffect(() => {
    let active = true;
    void fetchMember()
      .then((next) => {
        if (active) setMember(next);
      })
      .catch(() => {
        if (active) setLoadError("Member details could not be loaded. Try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchMember]);

  const finish = (result: { error?: string; message?: string; success?: true }) => {
    setNotice({ kind: result.error ? "error" : "success", text: result.error ?? result.message ?? "Member updated." });
    if (result.success) {
      setActionPanel(null);
      setReason("");
      void load();
      onChanged();
    }
  };

  const mutate = (task: () => Promise<{ error?: string; message?: string; success?: true }>) =>
    startTransition(async () => finish(await task()));

  return (
    <MemberModalShell
      title={member?.fullName ?? "Member details"}
      description={member ? `Account ${member.id}` : "Complete membership and turnover summary."}
      onClose={onClose}
      wide
    >
      {loading ? (
        <DetailSkeleton />
      ) : loadError || !member ? (
        <div className="grid min-h-72 place-items-center p-8 text-center">
          <div>
            <p role="alert" className="text-content-sm text-status-danger">
              {loadError ?? "Member not found."}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <div className="space-y-8 p-5 sm:p-7 lg:border-r lg:border-border-hairline">
            {notice && (
              <p
                role={notice.kind === "error" ? "alert" : "status"}
                className={`rounded-lg border px-4 py-3 text-content-sm ${
                  notice.kind === "error"
                    ? "border-status-danger/40 bg-status-danger/10 text-status-danger"
                    : "border-primary/30 bg-accent-soft text-primary"
                }`}
              >
                {notice.text}
              </p>
            )}

            <section aria-labelledby="identity-heading">
              <div className="flex items-center justify-between gap-4">
                <h3 id="identity-heading" className="text-title-sm font-medium text-text-strong">
                  Identity &amp; access
                </h3>
                <StatusBadge tone={statusTone(member.membershipStatus)} className="capitalize">
                  {member.membershipStatus}
                </StatusBadge>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5">
                <Detail label="Account created" value={date(member.accountCreatedAt)} />
                <Detail label="Joined" value={date(member.joinedAt)} />
                <Detail label="Membership" value={member.membershipStatus} capitalize />
                <Detail
                  label="Expires"
                  value={
                    member.expiresAt ? date(member.expiresAt) : member.membershipStatus === "active" ? "Lifetime" : "—"
                  }
                />
                <Detail label="Tier" value={member.isMaster ? "Master" : `Tier ${member.currentTier}`} />
                <Detail label="Platform role" value={member.platformRole} capitalize />
              </dl>
            </section>

            {/* Read-only since phase 9. Assigning a role is a hierarchy-checked
                RPC in the Roles settings section: it refuses a role above your
                own and a permission you do not hold yourself. The buttons that
                used to sit here called a wrapper that could do neither, and
                could not set hoist, mentionable, icon or permissions at all. */}
            <section aria-labelledby="badges-heading">
              <div className="flex items-center justify-between gap-4">
                <h3 id="badges-heading" className="text-title-sm font-medium text-text-strong">
                  Community roles
                </h3>
                <span className="font-mono text-mono-xs text-text-muted tabular-nums">
                  {member.cosmeticRoles.length} assigned
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {member.cosmeticRoles.map((role) => (
                  // The colour belongs to the row; nothing in the token layer
                  // can know what a creator named their role.
                  <span
                    key={role.id}
                    className="inline-flex min-h-10 items-center rounded-md border px-3 font-mono text-mono-xs"
                    style={{ borderColor: role.color, color: role.color, backgroundColor: `${role.color}1F` }}
                  >
                    {role.name}
                  </span>
                ))}
                {!member.cosmeticRoles.length && (
                  <p className="text-content-sm text-text-muted">This member holds no roles.</p>
                )}
              </div>
              <Link
                href="/creator/settings?section=roles"
                className="focus-ring mt-4 inline-flex min-h-10 items-center gap-1 rounded-md text-content-sm text-primary hover:underline"
              >
                Assign roles in Community settings
                <UserRoundCog size={13} />
              </Link>
            </section>

            <section aria-labelledby="turnover-heading">
              <h3 id="turnover-heading" className="text-title-sm font-medium text-text-strong">
                Turnover
              </h3>
              <div className="mt-4 grid grid-cols-2 border-y border-border-hairline py-4">
                <Detail label="Current week" value={money(member.currentWeekTurnover)} mono />
                <Detail label="All time" value={money(member.allTimeTurnover)} mono />
              </div>
            </section>
          </div>

          <aside className="space-y-6 bg-surface-sunken p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-7">
            <section>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                <h3 className="text-title-sm font-medium text-text-strong">Subscription gift</h3>
              </div>
              <p className="mt-2 text-content-sm text-text-default">
                Adds time from the later of today or the member&rsquo;s current expiry. Tier remains unchanged.
              </p>

              {actionPanel === "gift" ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {([1, 3, 6, 12] as const).map((months) => (
                    <Button
                      key={months}
                      variant="outline"
                      disabled={pending}
                      onClick={() => mutate(() => giftMemberSubscription(member.id, months))}
                    >
                      {months} {months === 1 ? "month" : "months"}
                    </Button>
                  ))}
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  disabled={member.isSuspended || (member.membershipStatus === "active" && !member.expiresAt)}
                  onClick={() => setActionPanel("gift")}
                >
                  <CircleDollarSign size={15} />
                  Gift access
                </Button>
              )}

              {member.isSuspended && (
                <p className="mt-2 text-content-sm text-status-danger">Reinstate before gifting access.</p>
              )}
              {member.membershipStatus === "active" && !member.expiresAt && (
                <p className="mt-2 text-content-sm text-text-muted">Lifetime access cannot be extended.</p>
              )}
            </section>

            <section className="border-t border-border-hairline pt-6">
              <div className="flex items-center gap-2">
                <UserRoundCog size={16} className="text-primary" />
                <h3 className="text-title-sm font-medium text-text-strong">Platform role</h3>
              </div>
              <p className="mt-2 text-content-sm text-text-default">
                Moderators can support community operations. Cosmetic roles remain separate.
              </p>
              <Button
                variant="outline"
                className="mt-4 w-full"
                disabled={pending}
                onClick={() =>
                  mutate(() =>
                    setMemberPlatformRole(member.id, member.platformRole === "member" ? "moderator" : "member"),
                  )
                }
              >
                {member.platformRole === "member" ? <Shield size={15} /> : <ShieldOff size={15} />}
                {member.platformRole === "member" ? "Promote to moderator" : "Demote to member"}
              </Button>
            </section>

            <section className="border-t border-border-hairline pt-6">
              <div className="flex items-center gap-2">
                <Ban size={16} className={member.isSuspended ? "text-primary" : "text-status-danger"} />
                <h3 className="text-title-sm font-medium text-text-strong">Access enforcement</h3>
              </div>
              <p className="mt-2 text-content-sm text-text-default">
                {member.isSuspended
                  ? "Reinstatement restores access without changing membership history."
                  : "Suspension blocks access immediately. Expiry continues and member data is preserved."}
              </p>

              {actionPanel === "moderation" ? (
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="terminal-label text-text-faint">Required reason</span>
                    <Textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      minLength={3}
                      maxLength={500}
                      rows={3}
                      className="mt-2"
                      placeholder={
                        member.isSuspended ? "Why is access being restored?" : "Why is this member being suspended?"
                      }
                    />
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant={member.isSuspended ? "default" : "destructive"}
                      className="flex-1"
                      disabled={pending || reason.trim().length < 3}
                      onClick={() =>
                        mutate(() => moderateMember(member.id, member.isSuspended ? "reinstate" : "suspend", reason))
                      }
                    >
                      {pending && <LoaderCircle size={15} className="animate-spin" />}
                      Confirm {member.isSuspended ? "reinstatement" : "suspension"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setActionPanel(null);
                        setReason("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant={member.isSuspended ? "outline" : "destructive"}
                  className="mt-4 w-full"
                  onClick={() => setActionPanel("moderation")}
                >
                  {member.isSuspended ? "Reinstate member" : "Suspend member"}
                </Button>
              )}
            </section>

            {pending && (
              <p role="status" className="flex items-center gap-2 text-content-sm text-text-muted">
                <LoaderCircle size={14} className="animate-spin" />
                Applying change…
              </p>
            )}
          </aside>
        </div>
      )}
    </MemberModalShell>
  );
}

function Detail({
  label,
  value,
  capitalize = false,
  mono = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="terminal-label text-text-faint">{label}</dt>
      <dd
        className={`mt-1 text-content-sm text-text-default ${capitalize ? "capitalize" : ""} ${
          mono ? "font-mono text-text-strong tabular-nums" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid animate-pulse gap-8 p-7 lg:grid-cols-2" aria-label="Loading member details">
      <div className="space-y-5">
        {[1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="h-12 rounded-lg bg-surface-raised" />
        ))}
      </div>
      <div className="space-y-5">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-28 rounded-lg bg-surface-raised" />
        ))}
      </div>
    </div>
  );
}
