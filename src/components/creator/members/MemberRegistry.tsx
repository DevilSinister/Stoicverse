"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  LoaderCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";

import { MemberDetailModal } from "@/components/creator/members/MemberDetailModal";
import { AppShell } from "@/components/layout/AppShell";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import type {
  CosmeticRole,
  MemberDirectoryPage,
  MemberDirectoryRow,
  MembershipStatus,
  PlatformMemberRole,
} from "@/lib/member-operations/types";

/**
 * The member registry. Monolith, phase 11b.
 *
 * **A second design brief was being injected into the DOM**, which makes it a
 * pattern rather than an accident: a hidden `<div>` used
 * `dangerouslySetInnerHTML` to write an HTML comment — "THESIS…", "OWN-WORLD…",
 * "corroborated seed 7cbfba2e" — into every render of this page, exactly as the
 * account settings screen did until phase 10. Whatever produced these screens
 * emitted the brief alongside the markup, so there may be more of them.
 *
 * The status chip here was a second copy of the detail modal's three-branch
 * tone ladder. Both are `ui/status-badge` now, so "suspended is danger, active
 * and gifted are the accent, everything else is neutral" is written once.
 *
 * Everything else is the token layer, `ui/button`, and unpacking a file whose
 * desktop table, mobile list and pager were one line each.
 */

const SELECT_CLASS =
  "focus-ring h-11 w-full rounded-lg border border-border-hairline bg-surface-sunken px-4 text-content-sm text-text-default sm:w-auto";

const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value))
    : "—";

const STATUS_OPTIONS: { value: MembershipStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "gifted", label: "Gifted" },
  { value: "expired", label: "Expired" },
  { value: "pending", label: "Pending" },
  { value: "suspended", label: "Suspended" },
];

const statusTone = (status: MembershipStatus): StatusTone =>
  status === "suspended" ? "danger" : status === "active" || status === "gifted" ? "accent" : "neutral";

const expiry = (member: MemberDirectoryRow) =>
  member.expiresAt ? date(member.expiresAt) : member.membershipStatus === "active" ? "Lifetime" : "—";

const tierLabel = (member: MemberDirectoryRow) => (member.isMaster ? "Master" : `Tier ${member.currentTier}`);

type Filters = {
  status: MembershipStatus | "";
  tier: string;
  platformRole: PlatformMemberRole | "";
  cosmeticRoleId: string;
};

const EMPTY_FILTERS: Filters = { status: "", tier: "", platformRole: "", cosmeticRoleId: "" };

export function MemberRegistry({
  memberName,
  initialPage,
  initialRoles,
}: {
  memberName: string;
  initialPage: MemberDirectoryPage;
  initialRoles: CosmeticRole[];
}) {
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const firstRequest = useRef(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setCursor("");
      setCursorHistory([]);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    // The server already rendered the first page; refetching it on mount would
    // be a wasted round trip that also flashes the table.
    if (
      firstRequest.current &&
      !debouncedQuery &&
      !cursor &&
      Object.values(filters).every((item) => !item) &&
      refreshKey === 0
    ) {
      firstRequest.current = false;
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (filters.status) params.set("status", filters.status);
    if (filters.tier) params.set("tier", filters.tier);
    if (filters.platformRole) params.set("platformRole", filters.platformRole);
    if (filters.cosmeticRoleId) params.set("cosmeticRoleId", filters.cosmeticRoleId);
    if (cursor) params.set("cursor", cursor);

    setLoading(true);
    setError(null);

    fetch(`/api/creator/members?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as MemberDirectoryPage & { error?: string };
        if (!response.ok) throw new Error(payload.error);
        return payload;
      })
      .then(setPage)
      .catch((fetchError: unknown) => {
        if (!(fetchError instanceof DOMException && fetchError.name === "AbortError")) {
          setError("Members could not be loaded. Check your connection and try again.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [cursor, debouncedQuery, filters, refreshKey, retryKey]);

  const pageNumber = cursorHistory.length + 1;
  const filterCount = Object.values(filters).filter(Boolean).length;
  const hasSearch = Boolean(debouncedQuery || filterCount);

  const changeFilters = (next: Filters) => {
    setFilters(next);
    setCursor("");
    setCursorHistory([]);
  };

  const refresh = useCallback(() => {
    setRefreshKey((key) => key + 1);
    router.refresh();
  }, [router]);

  const closeDetail = useCallback(() => setSelectedMemberId(null), []);

  return (
    <AppShell active="Members" title="Members" memberName={memberName} platformRole="influencer" routeBase="/creator">
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <header className="flex flex-col gap-6 border-b border-border-hairline pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="terminal-label text-text-faint">Community operations</p>
            <h1 className="mt-3 text-title-lg font-medium text-text-strong">Member registry</h1>
            <p className="mt-3 max-w-[68ch] text-content-base text-text-default">
              Find any account, inspect access and turnover, then make deliberate membership changes from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/creator/settings?section=roles" className={buttonVariants({ variant: "outline" })}>
              <ShieldCheck size={15} />
              Manage roles
            </Link>
            <Link href="/creator/members/turnover" className={buttonVariants()}>
              Turnover
              <ArrowRight size={15} />
            </Link>
          </div>
        </header>

        <section className="mt-7" aria-label="Member search and filters">
          <label htmlFor="member-search" className="terminal-label text-text-faint">
            Search members
          </label>
          <div className="relative mt-2">
            <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-primary" />
            <input
              id="member-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by full name or exact member ID"
              className="focus-ring h-14 w-full rounded-lg border border-border-hairline bg-surface-sunken pr-4 pl-12 text-content-base text-text-strong placeholder:text-text-faint"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="chrome"
              className="sm:hidden"
              onClick={() => setFilterOpen((open) => !open)}
              aria-expanded={filterOpen}
              aria-controls="member-filters"
            >
              <SlidersHorizontal size={14} />
              Filters
              {filterCount > 0 && (
                <span className="grid size-5 place-items-center rounded-full bg-primary font-mono text-mono-xs text-primary-foreground">
                  {filterCount}
                </span>
              )}
            </Button>

            <div
              id="member-filters"
              className={`${filterOpen ? "flex" : "hidden"} w-full flex-col gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap`}
            >
              <FilterSelect
                label="Membership status"
                value={filters.status}
                onChange={(value) => changeFilters({ ...filters, status: value as MembershipStatus | "" })}
                options={STATUS_OPTIONS}
              />
              <FilterSelect
                label="Tier"
                value={filters.tier}
                onChange={(tier) => changeFilters({ ...filters, tier })}
                options={[
                  { value: "", label: "All tiers" },
                  ...[1, 2, 3, 4, 5].map((tier) => ({
                    value: String(tier),
                    label: tier === 5 ? "Master" : `Tier ${tier}`,
                  })),
                ]}
              />
              <FilterSelect
                label="Platform role"
                value={filters.platformRole}
                onChange={(role) => changeFilters({ ...filters, platformRole: role as PlatformMemberRole | "" })}
                options={[
                  { value: "", label: "Members & moderators" },
                  { value: "member", label: "Members" },
                  { value: "moderator", label: "Moderators" },
                ]}
              />
              <FilterSelect
                label="Community role"
                value={filters.cosmeticRoleId}
                onChange={(cosmeticRoleId) => changeFilters({ ...filters, cosmeticRoleId })}
                options={[
                  { value: "", label: "All roles" },
                  ...initialRoles.map((role) => ({ value: role.id, label: role.name })),
                ]}
              />
            </div>

            {filterCount > 0 && (
              <Button variant="link" size="chrome" onClick={() => changeFilters(EMPTY_FILTERS)}>
                Clear filters
              </Button>
            )}
          </div>
        </section>

        <section
          className="relative mt-6 overflow-hidden rounded-lg border border-border-hairline bg-surface-sunken"
          aria-labelledby="results-heading"
          aria-busy={loading}
        >
          <div className="flex items-center justify-between gap-4 border-b border-border-hairline px-4 py-4 sm:px-5">
            <div>
              <h2 id="results-heading" className="text-title-sm font-medium text-text-strong">
                {hasSearch ? "Matching members" : "All members"}
              </h2>
              <p className="mt-0.5 font-mono text-mono-xs text-text-muted tabular-nums">
                Page {pageNumber} · Up to 50 accounts
              </p>
            </div>
            {loading && (
              <span role="status" className="inline-flex items-center gap-2 text-content-sm text-text-muted">
                <LoaderCircle size={14} className="animate-spin" />
                Updating
              </span>
            )}
          </div>

          {error ? (
            <ErrorState message={error} retry={() => setRetryKey((key) => key + 1)} />
          ) : page.members.length ? (
            <>
              <DesktopTable members={page.members} onSelect={setSelectedMemberId} />
              <MobileRows members={page.members} onSelect={setSelectedMemberId} />
            </>
          ) : (
            <EmptyState
              filtered={hasSearch}
              clear={() => {
                setQuery("");
                setFilters(EMPTY_FILTERS);
              }}
            />
          )}

          <footer className="flex items-center justify-between gap-4 border-t border-border-hairline px-4 py-3 sm:px-5">
            <p className="font-mono text-mono-xs text-text-muted tabular-nums">
              {page.members.length ? `Showing ${page.members.length} members` : "No rows on this page"}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="chrome"
                disabled={!cursorHistory.length || loading}
                onClick={() => {
                  const history = [...cursorHistory];
                  setCursor(history.pop() ?? "");
                  setCursorHistory(history);
                }}
              >
                <ChevronLeft size={14} />
                Previous
              </Button>
              <Button
                variant="outline"
                size="chrome"
                disabled={!page.nextCursor || loading}
                onClick={() => {
                  setCursorHistory((history) => [...history, cursor]);
                  setCursor(page.nextCursor ?? "");
                }}
              >
                Next
                <ChevronRight size={14} />
              </Button>
            </div>
          </footer>
        </section>
      </main>

      {selectedMemberId && <MemberDetailModal memberId={selectedMemberId} onClose={closeDetail} onChanged={refresh} />}
    </AppShell>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={SELECT_CLASS}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DesktopTable({ members, onSelect }: { members: MemberDirectoryRow[]; onSelect: (id: string) => void }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[980px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border-hairline">
            {["Member", "Status", "Tier", "Roles", "Joined", "Expiry"].map((header) => (
              <th key={header} scope="col" className="terminal-label px-4 py-3 text-text-faint first:px-5">
                {header}
              </th>
            ))}
            <th scope="col" className="px-5 py-3 text-right">
              <span className="sr-only">Open details</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-hairline">
          {members.map((member) => (
            <tr key={member.id} className="group transition-colors hover:bg-surface-raised">
              <td className="px-5 py-4">
                <button type="button" onClick={() => onSelect(member.id)} className="focus-ring rounded-md text-left">
                  <span className="block text-content-sm font-medium text-text-strong group-hover:text-primary">
                    {member.fullName}
                  </span>
                  <span className="mt-1 block font-mono text-mono-xs text-text-faint">{member.id}</span>
                </button>
              </td>
              <td className="px-4 py-4">
                <StatusBadge tone={statusTone(member.membershipStatus)} className="capitalize">
                  {member.membershipStatus}
                </StatusBadge>
              </td>
              <td className="px-4 py-4 text-content-sm text-text-default">{tierLabel(member)}</td>
              <td className="max-w-[18rem] px-4 py-4">
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge tone="neutral" className="capitalize">
                    {member.platformRole}
                  </StatusBadge>
                  {member.cosmeticRoles.slice(0, 2).map((role) => (
                    <span
                      key={role.id}
                      className="rounded-md border px-2 py-1 font-mono text-mono-xs"
                      style={{ borderColor: role.color, color: role.color }}
                    >
                      {role.name}
                    </span>
                  ))}
                  {member.cosmeticRoles.length > 2 && (
                    <span className="px-1 py-1 font-mono text-mono-xs text-text-faint">
                      +{member.cosmeticRoles.length - 2}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-4 text-content-sm text-text-muted">{date(member.joinedAt)}</td>
              <td className="px-4 py-4 text-content-sm text-text-muted">{expiry(member)}</td>
              <td className="px-5 py-4 text-right">
                <Button
                  variant="ghost"
                  size="chrome"
                  onClick={() => onSelect(member.id)}
                  aria-label={`View details for ${member.fullName}`}
                >
                  Details
                  <ChevronRight size={14} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileRows({ members, onSelect }: { members: MemberDirectoryRow[]; onSelect: (id: string) => void }) {
  return (
    <div className="divide-y divide-border-hairline md:hidden">
      {members.map((member) => (
        <button
          key={member.id}
          type="button"
          onClick={() => onSelect(member.id)}
          className="focus-ring flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-surface-raised"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-border-hairline bg-surface-panel font-medium text-primary">
            {member.fullName[0]?.toUpperCase() ?? "M"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-content-sm font-medium text-text-strong">{member.fullName}</span>
              <StatusBadge tone={statusTone(member.membershipStatus)} className="capitalize">
                {member.membershipStatus}
              </StatusBadge>
            </span>
            <span className="mt-1 block text-content-sm text-text-muted">
              {tierLabel(member)} · <span className="capitalize">{member.platformRole}</span> · Joined{" "}
              {date(member.joinedAt)}
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-text-faint" />
        </button>
      ))}
    </div>
  );
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="grid min-h-80 place-items-center px-6 text-center">
      <div>
        <Filter className="mx-auto text-status-danger" size={22} />
        <p role="alert" className="mt-3 text-content-base text-text-strong">
          {message}
        </p>
        <Button variant="outline" className="mt-4" onClick={retry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ filtered, clear }: { filtered: boolean; clear: () => void }) {
  const Icon = filtered ? UserRoundSearch : UsersRound;
  return (
    <div className="grid min-h-80 place-items-center px-6 text-center">
      <div>
        <Icon className="mx-auto text-primary" size={26} />
        <p className="mt-4 text-content-base font-medium text-text-strong">
          {filtered ? "No members match this search" : "No member accounts yet"}
        </p>
        <p className="mx-auto mt-2 max-w-sm text-content-sm text-text-muted">
          {filtered
            ? "Try a broader name or remove one of the active filters."
            : "New member and moderator accounts will appear here."}
        </p>
        {filtered && (
          <Button variant="outline" className="mt-4" onClick={clear}>
            Clear search and filters
          </Button>
        )}
      </div>
    </div>
  );
}
