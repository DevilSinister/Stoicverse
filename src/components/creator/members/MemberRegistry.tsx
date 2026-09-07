"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Filter, LoaderCircle, Search, ShieldCheck, SlidersHorizontal, UserRoundSearch, UsersRound } from "lucide-react";

import { MemberDetailModal } from "@/components/creator/members/MemberDetailModal";
import { RoleManagerModal } from "@/components/creator/members/RoleManagerModal";
import { AppShell } from "@/components/layout/AppShell";
import type { CosmeticRole, MemberDirectoryPage, MemberDirectoryRow, MembershipStatus, PlatformMemberRole } from "@/lib/member-operations/types";

const date = (value: string | null) => value ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "—";
const statusOptions: { value: MembershipStatus | ""; label: string }[] = [{ value: "", label: "All statuses" }, { value: "active", label: "Active" }, { value: "gifted", label: "Gifted" }, { value: "expired", label: "Expired" }, { value: "pending", label: "Pending" }, { value: "suspended", label: "Suspended" }];

type Filters = { status: MembershipStatus | ""; tier: string; platformRole: PlatformMemberRole | ""; cosmeticRoleId: string };
const EMPTY_FILTERS: Filters = { status: "", tier: "", platformRole: "", cosmeticRoleId: "" };

export function MemberRegistry({ memberName, initialPage, initialRoles }: { memberName: string; initialPage: MemberDirectoryPage; initialRoles: CosmeticRole[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [cursor, setCursor] = useState("");
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const firstRequest = useRef(true);

  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedQuery(query.trim()); setCursor(""); setCursorHistory([]); }, 280); return () => window.clearTimeout(timer); }, [query]);

  useEffect(() => {
    if (firstRequest.current && !debouncedQuery && !cursor && Object.values(filters).every((item) => !item) && refreshKey === 0) { firstRequest.current = false; return; }
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (filters.status) params.set("status", filters.status);
    if (filters.tier) params.set("tier", filters.tier);
    if (filters.platformRole) params.set("platformRole", filters.platformRole);
    if (filters.cosmeticRoleId) params.set("cosmeticRoleId", filters.cosmeticRoleId);
    if (cursor) params.set("cursor", cursor);
    setLoading(true); setError(null);
    fetch(`/api/creator/members?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { const payload = await response.json() as MemberDirectoryPage & { error?: string }; if (!response.ok) throw new Error(payload.error); return payload; })
      .then(setPage)
      .catch((fetchError: unknown) => { if (!(fetchError instanceof DOMException && fetchError.name === "AbortError")) setError("Members could not be loaded. Check your connection and try again."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [cursor, debouncedQuery, filters, refreshKey, retryKey]);

  const pageNumber = cursorHistory.length + 1;
  const filterCount = Object.values(filters).filter(Boolean).length;
  const changeFilters = (next: Filters) => { setFilters(next); setCursor(""); setCursorHistory([]); };
  const refresh = useCallback(() => { setRefreshKey((key) => key + 1); router.refresh(); }, [router]);
  const closeDetail = useCallback(() => setSelectedMemberId(null), []);
  const closeRoles = useCallback(() => setRolesOpen(false), []);
  const hasSearch = Boolean(debouncedQuery || filterCount);

  return (
    <AppShell active="Members" title="Members" memberName={memberName} platformRole="influencer" routeBase="/creator">
      <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
        <div hidden dangerouslySetInnerHTML={{ __html: "<!-- THESIS: Search-first member operations registry for high-volume creator administration. OWN-WORLD: Stoicverse dark editorial surfaces, emerald actions, hairline separators, dense operational data. STORY: Find, inspect, then act without leaving context. FIRST VIEWPORT: Registry search, primary filters, and member rows. FORM: Search-led registry with focused detail and role sheets; corroborated seed 7cbfba2e; committed staging search → filter → inspect → act. -->" }} />
        <header className="flex flex-col gap-6 border-b border-surgical-steel pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="terminal-label">Community operations</p><h1 className="mt-2 max-w-3xl font-headline text-3xl font-semibold tracking-[-0.025em] text-white sm:text-4xl">Member registry</h1><p className="mt-3 max-w-[68ch] text-sm leading-6 text-on-surface-variant">Find any account, inspect access and turnover, then make deliberate membership changes from one place.</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setRolesOpen(true)} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-surgical-steel px-4 text-sm font-semibold text-white transition hover:border-primary-container hover:text-primary-container"><ShieldCheck size={16} />Manage roles</button><Link href="/creator/members/turnover" className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-container px-5 text-sm font-semibold text-on-primary-fixed transition hover:brightness-105">Turnover <ArrowRight size={16} /></Link></div>
        </header>

        <section className="mt-7" aria-label="Member search and filters">
          <label htmlFor="member-search" className="block text-sm font-semibold text-white">Search members</label>
          <div className="relative mt-2"><Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary-container" /><input id="member-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by full name or exact member ID" className="focus-ring min-h-14 w-full rounded-xl border border-surgical-steel bg-surface-container-lowest pl-12 pr-4 text-base text-white shadow-[0_12px_30px_-24px_rgba(0,0,0,0.9)] placeholder:text-fog-muted" /></div>

          <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={() => setFilterOpen((open) => !open)} aria-expanded={filterOpen} aria-controls="member-filters" className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-surgical-steel px-4 text-xs font-semibold text-on-surface sm:hidden"><SlidersHorizontal size={15} />Filters{filterCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary-container text-[10px] text-on-primary-fixed">{filterCount}</span>}</button><div id="member-filters" className={`${filterOpen ? "flex" : "hidden"} w-full flex-col gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap`}><Select label="Membership status" value={filters.status} onChange={(value) => changeFilters({ ...filters, status: value as MembershipStatus | "" })} options={statusOptions} /><Select label="Tier" value={filters.tier} onChange={(tier) => changeFilters({ ...filters, tier })} options={[{ value: "", label: "All tiers" }, ...[1,2,3,4,5].map((tier) => ({ value: String(tier), label: tier === 5 ? "Master" : `Tier ${tier}` }))]} /><Select label="Platform role" value={filters.platformRole} onChange={(platformRole) => changeFilters({ ...filters, platformRole: platformRole as PlatformMemberRole | "" })} options={[{ value: "", label: "Members & moderators" }, { value: "member", label: "Members" }, { value: "moderator", label: "Moderators" }]} /><Select label="Cosmetic role" value={filters.cosmeticRoleId} onChange={(cosmeticRoleId) => changeFilters({ ...filters, cosmeticRoleId })} options={[{ value: "", label: "All cosmetic roles" }, ...initialRoles.map((role) => ({ value: role.id, label: role.name }))]} /></div>{filterCount > 0 && <button type="button" onClick={() => changeFilters(EMPTY_FILTERS)} className="focus-ring min-h-10 px-2 text-xs font-semibold text-primary-container">Clear filters</button>}</div>
        </section>

        <section className="relative mt-6 overflow-hidden rounded-xl border border-surgical-steel bg-surface-container-lowest" aria-labelledby="results-heading" aria-busy={loading}>
          <div className="flex items-center justify-between gap-4 border-b border-surgical-steel px-4 py-4 sm:px-5"><div><h2 id="results-heading" className="text-sm font-semibold text-white">{hasSearch ? "Matching members" : "All members"}</h2><p className="mt-0.5 text-xs text-fog-muted">Page {pageNumber} · Up to 50 accounts</p></div>{loading && <span role="status" className="inline-flex items-center gap-2 text-xs text-fog-muted"><LoaderCircle size={14} className="animate-spin" />Updating</span>}</div>
          {error ? <ErrorState message={error} retry={() => setRetryKey((key) => key + 1)} /> : page.members.length ? <><DesktopTable members={page.members} onSelect={setSelectedMemberId} /><MobileRows members={page.members} onSelect={setSelectedMemberId} />{loading && <div className="pointer-events-none absolute inset-x-0 top-[4.25rem] h-1 overflow-hidden bg-surface-container-high"><div className="h-full w-1/3 animate-[pulse_1s_ease-in-out_infinite] bg-primary-container" /></div>}</> : <EmptyState filtered={hasSearch} clear={() => { setQuery(""); setFilters(EMPTY_FILTERS); }} />}
          <footer className="flex items-center justify-between gap-4 border-t border-surgical-steel px-4 py-3 sm:px-5"><p className="text-xs text-fog-muted">{page.members.length ? `Showing ${page.members.length} members` : "No rows on this page"}</p><div className="flex gap-2"><button type="button" disabled={!cursorHistory.length || loading} onClick={() => { const history = [...cursorHistory]; setCursor(history.pop() ?? ""); setCursorHistory(history); }} className="focus-ring inline-flex min-h-10 items-center gap-1 rounded-full border border-surgical-steel px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35"><ChevronLeft size={15} />Previous</button><button type="button" disabled={!page.nextCursor || loading} onClick={() => { setCursorHistory((history) => [...history, cursor]); setCursor(page.nextCursor ?? ""); }} className="focus-ring inline-flex min-h-10 items-center gap-1 rounded-full border border-surgical-steel px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">Next<ChevronRight size={15} /></button></div></footer>
        </section>
      </main>

      {selectedMemberId && <MemberDetailModal memberId={selectedMemberId} roles={initialRoles} onClose={closeDetail} onChanged={refresh} />}
      {rolesOpen && <RoleManagerModal roles={initialRoles} onClose={closeRoles} onChanged={refresh} />}
    </AppShell>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <label className="sr-only sm:not-sr-only"><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="focus-ring min-h-11 w-full rounded-full border border-surgical-steel bg-surface-container-lowest px-4 text-base font-semibold text-on-surface sm:w-auto sm:text-xs">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }

function DesktopTable({ members, onSelect }: { members: MemberDirectoryRow[]; onSelect: (id: string) => void }) { return <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[980px] border-collapse text-left"><thead><tr className="border-b border-surgical-steel text-[11px] font-semibold text-fog-muted"><th className="px-5 py-3">Member</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Tier</th><th className="px-4 py-3">Roles</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Expiry</th><th className="px-5 py-3 text-right"><span className="sr-only">Open details</span></th></tr></thead><tbody className="divide-y divide-surgical-steel">{members.map((member) => <tr key={member.id} className="group transition hover:bg-surface-container-low"><td className="px-5 py-4"><button type="button" onClick={() => onSelect(member.id)} className="focus-ring rounded text-left"><span className="block text-sm font-semibold text-white group-hover:text-primary-container">{member.fullName}</span><span className="mt-1 block font-mono text-[10px] text-fog-muted">{member.id}</span></button></td><td className="px-4 py-4"><Status status={member.membershipStatus} /></td><td className="px-4 py-4 text-xs font-semibold text-on-surface">{member.isMaster ? "Master" : `Tier ${member.currentTier}`}</td><td className="max-w-[18rem] px-4 py-4"><div className="flex flex-wrap gap-1.5"><span className="rounded-full border border-surgical-steel px-2 py-1 text-[10px] font-semibold capitalize text-on-surface-variant">{member.platformRole}</span>{member.cosmeticRoles.slice(0,2).map((role) => <span key={role.id} className="rounded-full border px-2 py-1 text-[10px] font-semibold" style={{ borderColor: role.color, color: role.color }}>{role.name}</span>)}{member.cosmeticRoles.length > 2 && <span className="px-1 py-1 text-[10px] text-fog-muted">+{member.cosmeticRoles.length - 2}</span>}</div></td><td className="px-4 py-4 text-xs text-on-surface-variant">{date(member.joinedAt)}</td><td className="px-4 py-4 text-xs text-on-surface-variant">{member.expiresAt ? date(member.expiresAt) : member.membershipStatus === "active" ? "Lifetime" : "—"}</td><td className="px-5 py-4 text-right"><button type="button" onClick={() => onSelect(member.id)} aria-label={`View details for ${member.fullName}`} className="focus-ring inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-xs font-semibold text-primary-container">Details<ChevronRight size={14} /></button></td></tr>)}</tbody></table></div>; }

function MobileRows({ members, onSelect }: { members: MemberDirectoryRow[]; onSelect: (id: string) => void }) { return <div className="divide-y divide-surgical-steel md:hidden">{members.map((member) => <button key={member.id} type="button" onClick={() => onSelect(member.id)} className="focus-ring flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-surface-container-low"><span className="grid size-10 shrink-0 place-items-center rounded-full border border-surgical-steel bg-surface-container-low font-semibold text-primary-container">{member.fullName[0]?.toUpperCase() ?? "M"}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-white">{member.fullName}</span><Status status={member.membershipStatus} /></span><span className="mt-1 block text-xs text-fog-muted">{member.isMaster ? "Master" : `Tier ${member.currentTier}`} · <span className="capitalize">{member.platformRole}</span> · Joined {date(member.joinedAt)}</span></span><ChevronRight size={17} className="shrink-0 text-fog-muted" /></button>)}</div>; }

function Status({ status }: { status: MembershipStatus }) { const tone = status === "suspended" ? "border-error/40 bg-error/10 text-error" : status === "active" || status === "gifted" ? "border-primary-container/30 bg-primary-container/10 text-primary-container" : "border-surgical-steel text-on-surface-variant"; return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize ${tone}`}>{status}</span>; }
function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <div className="grid min-h-80 place-items-center px-6 text-center"><div><Filter className="mx-auto text-error" size={24} /><p role="alert" className="mt-3 text-sm font-semibold text-white">{message}</p><button type="button" onClick={retry} className="focus-ring mt-4 min-h-11 rounded-full border border-surgical-steel px-5 text-sm font-semibold text-white">Try again</button></div></div>; }
function EmptyState({ filtered, clear }: { filtered: boolean; clear: () => void }) { return <div className="grid min-h-80 place-items-center px-6 text-center"><div>{filtered ? <UserRoundSearch className="mx-auto text-primary-container" size={28} /> : <UsersRound className="mx-auto text-primary-container" size={28} />}<p className="mt-4 font-semibold text-white">{filtered ? "No members match this search" : "No member accounts yet"}</p><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-fog-muted">{filtered ? "Try a broader name or remove one of the active filters." : "New member and moderator accounts will appear here."}</p>{filtered && <button type="button" onClick={clear} className="focus-ring mt-4 min-h-11 rounded-full border border-surgical-steel px-5 text-sm font-semibold text-white">Clear search and filters</button>}</div></div>; }
