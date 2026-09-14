"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Ban, CircleDollarSign, LoaderCircle, Shield, ShieldOff, Sparkles, UserRoundCog } from "lucide-react";

import Link from "next/link";

import { giftMemberSubscription, moderateMember, setMemberPlatformRole } from "@/app/creator/members/actions";
import { MemberModalShell } from "@/components/creator/members/MemberModalShell";
import type { MemberSummary } from "@/lib/member-operations/types";

const date = (value: string | null) => value ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value)) : "—";
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export function MemberDetailModal({ memberId, onClose, onChanged }: { memberId: string; onClose: () => void; onChanged: () => void }) {
  const [member, setMember] = useState<MemberSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [actionPanel, setActionPanel] = useState<"gift" | "moderation" | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const fetchMember = useCallback(async () => {
    const response = await fetch(`/api/creator/members/${memberId}`, { cache: "no-store" });
    const payload = await response.json() as { member?: MemberSummary; error?: string };
    if (!response.ok || !payload.member) throw new Error(payload.error ?? "Member details unavailable");
    return payload.member;
  }, [memberId]);

  const load = useCallback(() => {
    setLoading(true); setLoadError(null);
    void fetchMember().then(setMember).catch(() => setLoadError("Member details could not be loaded. Try again.")).finally(() => setLoading(false));
  }, [fetchMember]);

  useEffect(() => {
    let active = true;
    void fetchMember().then((nextMember) => { if (active) setMember(nextMember); }).catch(() => { if (active) setLoadError("Member details could not be loaded. Try again."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchMember]);

  const finish = (result: { error?: string; message?: string; success?: true }) => {
    setNotice({ kind: result.error ? "error" : "success", text: result.error ?? result.message ?? "Member updated." });
    if (result.success) { setActionPanel(null); setReason(""); void load(); onChanged(); }
  };
  const mutate = (task: () => Promise<{ error?: string; message?: string; success?: true }>) => startTransition(async () => finish(await task()));

  return (
    <MemberModalShell title={member?.fullName ?? "Member details"} description={member ? `Account ${member.id}` : "Complete membership and turnover summary."} onClose={onClose} wide>
      {loading ? <DetailSkeleton /> : loadError || !member ? <div className="grid min-h-72 place-items-center p-8 text-center"><div><p role="alert" className="text-sm text-error">{loadError ?? "Member not found."}</p><button type="button" onClick={() => void load()} className="focus-ring mt-4 min-h-11 rounded-lg border border-surgical-steel px-5 text-sm font-semibold text-text-strong">Try again</button></div></div> : (
        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <div className="space-y-8 p-5 sm:p-7 lg:border-r lg:border-surgical-steel">
            {notice && <p role={notice.kind === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${notice.kind === "error" ? "border-error/40 bg-error/10 text-error" : "border-primary-container/30 bg-primary-container/10 text-primary-container"}`}>{notice.text}</p>}
            <section aria-labelledby="identity-heading"><div className="flex items-center justify-between gap-4"><h3 id="identity-heading" className="font-semibold text-text-strong">Identity & access</h3><Status status={member.membershipStatus} /></div><dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 text-sm"><Detail label="Account created" value={date(member.accountCreatedAt)} /><Detail label="Joined" value={date(member.joinedAt)} /><Detail label="Membership" value={member.membershipStatus} capitalize /><Detail label="Expires" value={member.expiresAt ? date(member.expiresAt) : member.membershipStatus === "active" ? "Lifetime" : "—"} /><Detail label="Tier" value={member.isMaster ? "Master" : `Tier ${member.currentTier}`} /><Detail label="Platform role" value={member.platformRole} capitalize /></dl></section>

            {/* Read-only since phase 9. Assigning a role is a hierarchy-checked
                RPC in the Roles settings section: it refuses a role above your
                own and a permission you do not hold yourself. The buttons that
                used to sit here called a wrapper that could do neither, and
                could not set hoist, mentionable, icon or permissions at all. */}
            <section aria-labelledby="badges-heading"><div className="flex items-center justify-between"><h3 id="badges-heading" className="font-semibold text-text-strong">Community roles</h3><span className="text-xs text-fog-muted">{member.cosmeticRoles.length} assigned</span></div><div className="mt-4 flex flex-wrap gap-2">{member.cosmeticRoles.map((role) => <span key={role.id} className="inline-flex min-h-10 items-center rounded-md border px-3 text-xs font-semibold" style={{ borderColor: role.color, color: role.color, backgroundColor: `${role.color}1F` }}>{role.name}</span>)}{!member.cosmeticRoles.length && <p className="text-sm text-fog-muted">This member holds no roles.</p>}</div><Link href="/creator/settings?section=roles" className="focus-ring mt-4 inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-primary-container hover:underline">Assign roles in Community settings<UserRoundCog size={13} /></Link></section>

            <section aria-labelledby="turnover-heading"><h3 id="turnover-heading" className="font-semibold text-text-strong">Turnover</h3><div className="mt-4 grid grid-cols-2 border-y border-surgical-steel py-4"><Detail label="Current week" value={money(member.currentWeekTurnover)} mono /><Detail label="All time" value={money(member.allTimeTurnover)} mono /></div></section>
          </div>

          <aside className="space-y-6 bg-surface-container-low/40 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-7">
            <section><div className="flex items-center gap-2"><Sparkles size={17} className="text-primary-container" /><h3 className="font-semibold text-text-strong">Subscription gift</h3></div><p className="mt-2 text-xs leading-5 text-on-surface-variant">Adds time from the later of today or the member’s current expiry. Tier remains unchanged.</p>{actionPanel === "gift" ? <div className="mt-4 grid grid-cols-2 gap-2">{([1, 3, 6, 12] as const).map((months) => <button key={months} type="button" disabled={pending} onClick={() => mutate(() => giftMemberSubscription(member.id, months))} className="focus-ring min-h-11 rounded-lg border border-surgical-steel text-xs font-semibold text-text-strong hover:border-primary-container disabled:opacity-50">{months} {months === 1 ? "month" : "months"}</button>)}</div> : <button type="button" disabled={member.isSuspended || (member.membershipStatus === "active" && !member.expiresAt)} onClick={() => setActionPanel("gift")} className="focus-ring mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary-container text-sm font-semibold text-primary-container disabled:cursor-not-allowed disabled:border-surgical-steel disabled:text-fog-muted"><CircleDollarSign size={16} />Gift access</button>}{member.isSuspended && <p className="mt-2 text-xs text-error">Reinstate before gifting access.</p>}{member.membershipStatus === "active" && !member.expiresAt && <p className="mt-2 text-xs text-fog-muted">Lifetime access cannot be extended.</p>}</section>

            <section className="border-t border-surgical-steel pt-6"><div className="flex items-center gap-2"><UserRoundCog size={17} className="text-primary-container" /><h3 className="font-semibold text-text-strong">Platform role</h3></div><p className="mt-2 text-xs leading-5 text-on-surface-variant">Moderators can support community operations. Cosmetic roles remain separate.</p><button type="button" disabled={pending} onClick={() => mutate(() => setMemberPlatformRole(member.id, member.platformRole === "member" ? "moderator" : "member"))} className="focus-ring mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-surgical-steel text-sm font-semibold text-text-strong hover:border-primary-container disabled:opacity-50">{member.platformRole === "member" ? <Shield size={16} /> : <ShieldOff size={16} />}{member.platformRole === "member" ? "Promote to moderator" : "Demote to member"}</button></section>

            <section className="border-t border-surgical-steel pt-6"><div className="flex items-center gap-2"><Ban size={17} className={member.isSuspended ? "text-primary-container" : "text-error"} /><h3 className="font-semibold text-text-strong">Access enforcement</h3></div><p className="mt-2 text-xs leading-5 text-on-surface-variant">{member.isSuspended ? "Reinstatement restores access without changing membership history." : "Suspension blocks access immediately. Expiry continues and member data is preserved."}</p>{actionPanel === "moderation" ? <div className="mt-4"><label className="text-xs font-semibold text-on-surface-variant">Required reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={500} rows={3} placeholder={member.isSuspended ? "Why is access being restored?" : "Why is this member being suspended?"} className="focus-ring mt-2 w-full resize-y rounded-lg border border-surgical-steel bg-surface-container-lowest p-3 text-base text-text-strong placeholder:text-fog-muted sm:text-sm" /></label><div className="mt-3 flex gap-2"><button type="button" disabled={pending || reason.trim().length < 3} onClick={() => mutate(() => moderateMember(member.id, member.isSuspended ? "reinstate" : "suspend", reason))} className={`focus-ring inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold disabled:opacity-50 ${member.isSuspended ? "bg-primary-container text-on-primary-fixed" : "bg-error text-accent-contrast"}`}>{pending && <LoaderCircle size={15} className="animate-spin" />}Confirm {member.isSuspended ? "reinstatement" : "suspension"}</button><button type="button" onClick={() => { setActionPanel(null); setReason(""); }} className="focus-ring min-h-11 rounded-lg border border-surgical-steel px-4 text-xs font-semibold text-text-strong">Cancel</button></div></div> : <button type="button" onClick={() => setActionPanel("moderation")} className={`focus-ring mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border text-sm font-semibold ${member.isSuspended ? "border-primary-container text-primary-container" : "border-error/60 text-error"}`}>{member.isSuspended ? "Reinstate member" : "Suspend member"}</button>}</section>
            {pending && <p role="status" className="flex items-center gap-2 text-xs text-fog-muted"><LoaderCircle size={14} className="animate-spin" />Applying change…</p>}
          </aside>
        </div>
      )}
    </MemberModalShell>
  );
}

function Detail({ label, value, capitalize = false, mono = false }: { label: string; value: string; capitalize?: boolean; mono?: boolean }) { return <div><dt className="text-xs text-fog-muted">{label}</dt><dd className={`mt-1 font-semibold text-on-surface ${capitalize ? "capitalize" : ""} ${mono ? "font-mono tabular-nums" : ""}`}>{value}</dd></div>; }
function Status({ status }: { status: MemberSummary["membershipStatus"] }) { const tone = status === "suspended" ? "border-error/40 bg-error/10 text-error" : status === "active" || status === "gifted" ? "border-primary-container/30 bg-primary-container/10 text-primary-container" : "border-surgical-steel text-on-surface-variant"; return <span className={`rounded-md border px-3 py-1 text-[11px] font-semibold capitalize ${tone}`}>{status}</span>; }
function DetailSkeleton() { return <div className="grid animate-pulse gap-8 p-7 lg:grid-cols-2" aria-label="Loading member details"><div className="space-y-5">{[1,2,3,4,5].map((item) => <div key={item} className="h-12 rounded-lg bg-surface-container-high" />)}</div><div className="space-y-5">{[1,2,3].map((item) => <div key={item} className="h-28 rounded-lg bg-surface-container-high" />)}</div></div>; }
