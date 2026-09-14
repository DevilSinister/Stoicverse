"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, CircleDollarSign, LoaderCircle, Search } from "lucide-react";

import { saveWeeklyTurnover } from "@/app/creator/members/actions";
import { AppShell } from "@/components/layout/AppShell";
import type { MemberDirectoryPage, MemberDirectoryRow, MembershipStatus } from "@/lib/member-operations/types";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const statuses: { value: MembershipStatus | ""; label: string }[] = [{ value: "", label: "All statuses" }, { value: "active", label: "Active" }, { value: "gifted", label: "Gifted" }, { value: "expired", label: "Expired" }, { value: "pending", label: "Pending" }, { value: "suspended", label: "Suspended" }];

function isoWeekRange() {
  const monday = new Date();
  const day = monday.getUTCDay() || 7;
  monday.setUTCDate(monday.getUTCDate() - day + 1);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday); sunday.setUTCDate(sunday.getUTCDate() + 6);
  const format = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${format.format(monday)}–${format.format(sunday)}, ${sunday.getUTCFullYear()}`;
}

export function TurnoverWorkspace({ memberName, initialPage }: { memberName: string; initialPage: MemberDirectoryPage }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState<MembershipStatus | "">("");
  const [tier, setTier] = useState("");
  const [cursor, setCursor] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [page, setPage] = useState(initialPage);
  const [dirty, setDirty] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const firstRequest = useRef(true);

  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedQuery(query.trim()); setCursor(""); setHistory([]); }, 280); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => {
    if (firstRequest.current && !debouncedQuery && !status && !tier && !cursor && refreshKey === 0) { firstRequest.current = false; return; }
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (status) params.set("status", status);
    if (tier) params.set("tier", tier);
    if (cursor) params.set("cursor", cursor);
    setLoading(true); setError(null);
    fetch(`/api/creator/members?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { const payload = await response.json() as MemberDirectoryPage & { error?: string }; if (!response.ok) throw new Error(payload.error); return payload; })
      .then(setPage)
      .catch((fetchError: unknown) => { if (!(fetchError instanceof DOMException && fetchError.name === "AbortError")) setError("Turnover rows could not be loaded. Try again."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [cursor, debouncedQuery, refreshKey, status, tier]);

  const dirtyCount = Object.keys(dirty).length;
  const totalPreview = useMemo(() => page.members.reduce((sum, member) => sum + (dirty[member.id] ?? member.currentWeekTurnover), 0), [dirty, page.members]);
  const save = () => startTransition(async () => {
    const result = await saveWeeklyTurnover(Object.entries(dirty).map(([userId, amountUsd]) => ({ userId, amountUsd })));
    setNotice({ kind: result.error ? "error" : "success", text: result.error ?? result.message ?? "Turnover saved." });
    if (result.success) { setDirty({}); setRefreshKey((key) => key + 1); }
  });

  return (
    <AppShell active="Members" title="Member turnover" memberName={memberName} platformRole="influencer" routeBase="/creator">
      <main className="mx-auto w-full max-w-[1440px] px-4 py-7 pb-28 sm:px-6 lg:px-10 lg:py-10 lg:pb-28">
        <header className="flex flex-col gap-6 border-b border-surgical-steel pb-7 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/creator/members" className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-primary-container"><ArrowLeft size={15} />Member registry</Link><h1 className="mt-3 font-headline text-3xl font-semibold tracking-[-0.025em] text-text-strong sm:text-4xl">Weekly turnover</h1><p className="mt-3 max-w-[68ch] text-sm leading-6 text-on-surface-variant">Edit the current ISO week only. Previous weeks remain immutable and lifetime totals are calculated from every saved week.</p></div><div className="border-y border-surgical-steel py-3 lg:min-w-72"><p className="text-xs font-semibold text-fog-muted">Current week · UTC</p><p className="mt-1 font-mono text-sm font-semibold text-text-strong">{isoWeekRange()}</p></div></header>

        {notice && <p role={notice.kind === "error" ? "alert" : "status"} className={`mt-5 rounded-lg border px-4 py-3 text-sm ${notice.kind === "error" ? "border-error/40 bg-error/10 text-error" : "border-primary-container/30 bg-primary-container/10 text-primary-container"}`}>{notice.text}</p>}
        <section className="mt-7" aria-label="Turnover filters"><div className="grid gap-3 lg:grid-cols-[minmax(20rem,1fr)_auto_auto]"><label className="relative"><span className="sr-only">Search members</span><Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary-container" /><input type="search" value={query} disabled={dirtyCount > 0} onChange={(event) => setQuery(event.target.value)} placeholder="Search by full name or exact member ID" className="focus-ring min-h-12 w-full rounded-xl border border-surgical-steel bg-surface-container-lowest pl-11 pr-4 text-base text-text-strong placeholder:text-fog-muted disabled:opacity-50 sm:text-sm" /></label><select aria-label="Membership status" value={status} disabled={dirtyCount > 0} onChange={(event) => { setStatus(event.target.value as MembershipStatus | ""); setCursor(""); setHistory([]); }} className="focus-ring min-h-12 rounded-lg border border-surgical-steel bg-surface-container-lowest px-4 text-base font-semibold text-on-surface disabled:opacity-50 sm:text-xs">{statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><select aria-label="Tier" value={tier} disabled={dirtyCount > 0} onChange={(event) => { setTier(event.target.value); setCursor(""); setHistory([]); }} className="focus-ring min-h-12 rounded-lg border border-surgical-steel bg-surface-container-lowest px-4 text-base font-semibold text-on-surface disabled:opacity-50 sm:text-xs"><option value="">All tiers</option>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value === 5 ? "Master" : `Tier ${value}`}</option>)}</select></div>{dirtyCount > 0 && <p className="mt-2 text-xs text-fog-muted">Save or discard this page’s changes before searching, filtering, or paging.</p>}</section>

        <section className="mt-6 overflow-hidden rounded-xl border border-surgical-steel bg-surface-container-lowest" aria-busy={loading}><div className="flex items-center justify-between border-b border-surgical-steel px-5 py-4"><div><h2 className="text-sm font-semibold text-text-strong">Member turnover entries</h2><p className="mt-0.5 text-xs text-fog-muted">Page {history.length + 1} · {page.members.length} rows · Page week total {money(totalPreview)}</p></div>{loading && <LoaderCircle size={17} className="animate-spin text-primary-container" />}</div>{error ? <div className="grid min-h-64 place-items-center p-6 text-center"><div><p role="alert" className="text-sm text-error">{error}</p><button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="focus-ring mt-4 min-h-11 rounded-lg border border-surgical-steel px-5 text-sm font-semibold text-text-strong">Try again</button></div></div> : page.members.length ? <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-surgical-steel text-[11px] font-semibold text-fog-muted"><th className="px-5 py-3">Member</th><th className="px-4 py-3">Status & tier</th><th className="px-4 py-3">Current week (USD)</th><th className="px-5 py-3 text-right">Lifetime total</th></tr></thead><tbody className="divide-y divide-surgical-steel">{page.members.map((member) => <TurnoverDesktopRow key={member.id} member={member} dirtyValue={dirty[member.id]} setValue={(amount) => setDirty((values) => amount === member.currentWeekTurnover ? Object.fromEntries(Object.entries(values).filter(([id]) => id !== member.id)) : { ...values, [member.id]: amount })} />)}</tbody></table></div><div className="divide-y divide-surgical-steel md:hidden">{page.members.map((member) => <TurnoverMobileRow key={member.id} member={member} dirtyValue={dirty[member.id]} setValue={(amount) => setDirty((values) => amount === member.currentWeekTurnover ? Object.fromEntries(Object.entries(values).filter(([id]) => id !== member.id)) : { ...values, [member.id]: amount })} />)}</div></> : <div className="grid min-h-64 place-items-center p-6 text-center"><div><CircleDollarSign size={26} className="mx-auto text-primary-container" /><p className="mt-3 font-semibold text-text-strong">No members match these filters</p><p className="mt-1 text-sm text-fog-muted">Change the search or filters to continue.</p></div></div>}<footer className="flex items-center justify-between border-t border-surgical-steel px-5 py-3"><span className="text-xs text-fog-muted">50 rows maximum per page</span><div className="flex gap-2"><button type="button" disabled={!history.length || loading || dirtyCount > 0} onClick={() => { const next = [...history]; setCursor(next.pop() ?? ""); setHistory(next); }} className="focus-ring inline-flex min-h-10 items-center gap-1 rounded-lg border border-surgical-steel px-3 text-xs font-semibold text-text-strong disabled:opacity-35"><ChevronLeft size={15} />Previous</button><button type="button" disabled={!page.nextCursor || loading || dirtyCount > 0} onClick={() => { setHistory((items) => [...items, cursor]); setCursor(page.nextCursor ?? ""); }} className="focus-ring inline-flex min-h-10 items-center gap-1 rounded-lg border border-surgical-steel px-3 text-xs font-semibold text-text-strong disabled:opacity-35">Next<ChevronRight size={15} /></button></div></footer></section>
      </main>

      {dirtyCount > 0 && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-surgical-steel bg-monolith-surface/95 px-4 py-3 shadow-[0_-18px_50px_-30px_rgba(0,0,0,0.95)] backdrop-blur sm:px-6 md:left-64"><div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-text-strong">{dirtyCount} unsaved {dirtyCount === 1 ? "change" : "changes"}</p><p className="text-xs text-fog-muted">These values publish to the corresponding member dashboards.</p></div><div className="flex gap-2"><button type="button" disabled={pending} onClick={() => setDirty({})} className="focus-ring min-h-11 rounded-lg border border-surgical-steel px-4 text-xs font-semibold text-text-strong">Discard</button><button type="button" disabled={pending} onClick={save} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-container px-5 text-sm font-semibold text-on-primary-fixed disabled:opacity-50">{pending ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}Save changes</button></div></div></div>}
    </AppShell>
  );
}

function AmountInput({ member, dirtyValue, setValue }: { member: MemberDirectoryRow; dirtyValue?: number; setValue: (value: number) => void }) { return <label className="relative block max-w-48"><span className="sr-only">Current week turnover for {member.fullName}</span><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-fog-muted">$</span><input type="number" inputMode="decimal" min="0" max="999999999999.99" step="0.01" value={dirtyValue ?? member.currentWeekTurnover} onChange={(event) => setValue(Number(event.target.value))} className={`focus-ring min-h-11 w-full rounded-lg border bg-surface-container-lowest pl-7 pr-3 font-mono text-base tabular-nums text-text-strong sm:text-sm ${dirtyValue === undefined ? "border-surgical-steel" : "border-primary-container"}`} /></label>; }
function TurnoverDesktopRow({ member, dirtyValue, setValue }: { member: MemberDirectoryRow; dirtyValue?: number; setValue: (value: number) => void }) { const lifetime = member.allTimeTurnover + ((dirtyValue ?? member.currentWeekTurnover) - member.currentWeekTurnover); return <tr className={dirtyValue === undefined ? "" : "bg-primary-container/[0.04]"}><td className="px-5 py-4"><p className="text-sm font-semibold text-text-strong">{member.fullName}</p><p className="mt-1 font-mono text-[10px] text-fog-muted">{member.id}</p></td><td className="px-4 py-4 text-xs capitalize text-on-surface-variant">{member.membershipStatus} · {member.isMaster ? "Master" : `Tier ${member.currentTier}`}</td><td className="px-4 py-4"><AmountInput member={member} dirtyValue={dirtyValue} setValue={setValue} /></td><td className="px-5 py-4 text-right font-mono text-sm tabular-nums text-on-surface">{money(lifetime)}</td></tr>; }
function TurnoverMobileRow({ member, dirtyValue, setValue }: { member: MemberDirectoryRow; dirtyValue?: number; setValue: (value: number) => void }) { const lifetime = member.allTimeTurnover + ((dirtyValue ?? member.currentWeekTurnover) - member.currentWeekTurnover); return <article className={`p-4 ${dirtyValue === undefined ? "" : "bg-primary-container/[0.04]"}`}><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-semibold text-text-strong">{member.fullName}</h3><p className="mt-1 text-xs capitalize text-fog-muted">{member.membershipStatus} · {member.isMaster ? "Master" : `Tier ${member.currentTier}`}</p></div><div className="text-right"><p className="text-[10px] text-fog-muted">Lifetime</p><p className="mt-1 font-mono text-xs tabular-nums text-on-surface">{money(lifetime)}</p></div></div><div className="mt-4"><AmountInput member={member} dirtyValue={dirtyValue} setValue={setValue} /></div></article>; }
