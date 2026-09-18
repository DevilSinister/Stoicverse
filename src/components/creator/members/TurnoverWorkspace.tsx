"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, CircleDollarSign, LoaderCircle, Search } from "lucide-react";

import { saveWeeklyTurnover } from "@/app/creator/members/actions";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import type { MemberDirectoryPage, MemberDirectoryRow, MembershipStatus } from "@/lib/member-operations/types";

/**
 * Weekly turnover entry. Monolith, phase 11b.
 *
 * The token layer plus a rewrite; no behaviour changed. Three things here are
 * load-bearing and easy to lose in a rewrite, so they are named rather than
 * left to be rediscovered:
 *
 * - **Unsaved edits lock navigation.** Search, both filters and both pager
 *   buttons disable while `dirty` is non-empty, because every one of them
 *   replaces the rows those edits belong to.
 * - **The lifetime column is a preview, not a stored figure.** It is the saved
 *   lifetime total plus the difference the current edit would make, so the
 *   creator sees the consequence of a number before saving it.
 * - **The save bar's `md:left-64` is the rail's width**, hard-coded. It is the
 *   one number in this file that knows about a different component.
 */

const SELECT_CLASS =
  "focus-ring h-12 rounded-lg border border-border-hairline bg-surface-sunken px-4 text-content-sm text-text-default disabled:opacity-50";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

const STATUSES: { value: MembershipStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "gifted", label: "Gifted" },
  { value: "expired", label: "Expired" },
  { value: "pending", label: "Pending" },
  { value: "suspended", label: "Suspended" },
];

function isoWeekRange() {
  const monday = new Date();
  const day = monday.getUTCDay() || 7;
  monday.setUTCDate(monday.getUTCDate() - day + 1);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const format = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${format.format(monday)}–${format.format(sunday)}, ${sunday.getUTCFullYear()}`;
}

const lifetimePreview = (member: MemberDirectoryRow, dirtyValue?: number) =>
  member.allTimeTurnover + ((dirtyValue ?? member.currentWeekTurnover) - member.currentWeekTurnover);

export function TurnoverWorkspace({
  memberName,
  initialPage,
}: {
  memberName: string;
  initialPage: MemberDirectoryPage;
}) {
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setCursor("");
      setHistory([]);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (firstRequest.current && !debouncedQuery && !status && !tier && !cursor && refreshKey === 0) {
      firstRequest.current = false;
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (status) params.set("status", status);
    if (tier) params.set("tier", tier);
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
          setError("Turnover rows could not be loaded. Try again.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [cursor, debouncedQuery, refreshKey, status, tier]);

  const dirtyCount = Object.keys(dirty).length;
  const locked = dirtyCount > 0;

  const totalPreview = useMemo(
    () => page.members.reduce((sum, member) => sum + (dirty[member.id] ?? member.currentWeekTurnover), 0),
    [dirty, page.members],
  );

  const setValue = (member: MemberDirectoryRow, amount: number) =>
    setDirty((values) =>
      amount === member.currentWeekTurnover
        ? Object.fromEntries(Object.entries(values).filter(([id]) => id !== member.id))
        : { ...values, [member.id]: amount },
    );

  const save = () =>
    startTransition(async () => {
      const result = await saveWeeklyTurnover(
        Object.entries(dirty).map(([userId, amountUsd]) => ({ userId, amountUsd })),
      );
      setNotice({ kind: result.error ? "error" : "success", text: result.error ?? result.message ?? "Turnover saved." });
      if (result.success) {
        setDirty({});
        setRefreshKey((key) => key + 1);
      }
    });

  return (
    <AppShell
      active="Members"
      title="Member turnover"
      memberName={memberName}
      platformRole="influencer"
      routeBase="/creator"
    >
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 pb-28 sm:px-6 lg:px-10 lg:py-10 lg:pb-28">
        <header className="flex flex-col gap-6 border-b border-border-hairline pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/creator/members"
              className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md text-content-sm text-text-muted transition-colors hover:text-primary"
            >
              <ArrowLeft size={15} />
              Member registry
            </Link>
            <h1 className="mt-3 text-title-lg font-medium text-text-strong">Weekly turnover</h1>
            <p className="mt-3 max-w-[68ch] text-content-base text-text-default">
              Edit the current ISO week only. Previous weeks remain immutable and lifetime totals are calculated from
              every saved week.
            </p>
          </div>
          <div className="border-y border-border-hairline py-3 lg:min-w-72">
            <p className="terminal-label text-text-faint">Current week · UTC</p>
            <p className="mt-1 font-mono text-content-sm text-text-strong tabular-nums">{isoWeekRange()}</p>
          </div>
        </header>

        {notice && (
          <p
            role={notice.kind === "error" ? "alert" : "status"}
            className={`mt-5 rounded-lg border px-4 py-3 text-content-sm ${
              notice.kind === "error"
                ? "border-status-danger/40 bg-status-danger/10 text-status-danger"
                : "border-primary/30 bg-accent-soft text-primary"
            }`}
          >
            {notice.text}
          </p>
        )}

        <section className="mt-7" aria-label="Turnover filters">
          <div className="grid gap-3 lg:grid-cols-[minmax(20rem,1fr)_auto_auto]">
            <label className="relative">
              <span className="sr-only">Search members</span>
              <Search size={17} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-primary" />
              <input
                type="search"
                value={query}
                disabled={locked}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by full name or exact member ID"
                className="focus-ring h-12 w-full rounded-lg border border-border-hairline bg-surface-sunken pr-4 pl-11 text-content-base text-text-strong placeholder:text-text-faint disabled:opacity-50"
              />
            </label>

            <select
              aria-label="Membership status"
              value={status}
              disabled={locked}
              onChange={(event) => {
                setStatus(event.target.value as MembershipStatus | "");
                setCursor("");
                setHistory([]);
              }}
              className={SELECT_CLASS}
            >
              {STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Tier"
              value={tier}
              disabled={locked}
              onChange={(event) => {
                setTier(event.target.value);
                setCursor("");
                setHistory([]);
              }}
              className={SELECT_CLASS}
            >
              <option value="">All tiers</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value === 5 ? "Master" : `Tier ${value}`}
                </option>
              ))}
            </select>
          </div>

          {locked && (
            <p className="mt-2 text-content-sm text-text-muted">
              Save or discard this page&rsquo;s changes before searching, filtering, or paging.
            </p>
          )}
        </section>

        <section
          className="mt-6 overflow-hidden rounded-lg border border-border-hairline bg-surface-sunken"
          aria-busy={loading}
        >
          <div className="flex items-center justify-between gap-4 border-b border-border-hairline px-5 py-4">
            <div>
              <h2 className="text-title-sm font-medium text-text-strong">Member turnover entries</h2>
              <p className="mt-0.5 font-mono text-mono-xs text-text-muted tabular-nums">
                Page {history.length + 1} · {page.members.length} rows · Page week total {money(totalPreview)}
              </p>
            </div>
            {loading && <LoaderCircle size={16} className="animate-spin text-primary" />}
          </div>

          {error ? (
            <div className="grid min-h-64 place-items-center p-6 text-center">
              <div>
                <p role="alert" className="text-content-sm text-status-danger">
                  {error}
                </p>
                <Button variant="outline" className="mt-4" onClick={() => setRefreshKey((key) => key + 1)}>
                  Try again
                </Button>
              </div>
            </div>
          ) : page.members.length ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="border-b border-border-hairline">
                      <th scope="col" className="terminal-label px-5 py-3 text-text-faint">
                        Member
                      </th>
                      <th scope="col" className="terminal-label px-4 py-3 text-text-faint">
                        Status &amp; tier
                      </th>
                      <th scope="col" className="terminal-label px-4 py-3 text-text-faint">
                        Current week (USD)
                      </th>
                      <th scope="col" className="terminal-label px-5 py-3 text-right text-text-faint">
                        Lifetime total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-hairline">
                    {page.members.map((member) => (
                      <DesktopRow
                        key={member.id}
                        member={member}
                        dirtyValue={dirty[member.id]}
                        setValue={(amount) => setValue(member, amount)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-border-hairline md:hidden">
                {page.members.map((member) => (
                  <MobileRow
                    key={member.id}
                    member={member}
                    dirtyValue={dirty[member.id]}
                    setValue={(amount) => setValue(member, amount)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="grid min-h-64 place-items-center p-6 text-center">
              <div>
                <CircleDollarSign size={24} className="mx-auto text-primary" />
                <p className="mt-3 text-content-base font-medium text-text-strong">No members match these filters</p>
                <p className="mt-1 text-content-sm text-text-muted">Change the search or filters to continue.</p>
              </div>
            </div>
          )}

          <footer className="flex items-center justify-between gap-4 border-t border-border-hairline px-5 py-3">
            <span className="font-mono text-mono-xs text-text-muted tabular-nums">50 rows maximum per page</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="chrome"
                disabled={!history.length || loading || locked}
                onClick={() => {
                  const next = [...history];
                  setCursor(next.pop() ?? "");
                  setHistory(next);
                }}
              >
                <ChevronLeft size={14} />
                Previous
              </Button>
              <Button
                variant="outline"
                size="chrome"
                disabled={!page.nextCursor || loading || locked}
                onClick={() => {
                  setHistory((items) => [...items, cursor]);
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

      {locked && (
        // `md:left-64` is the rail's width. See the docblock.
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-hairline bg-surface-panel/95 px-4 py-3 backdrop-blur sm:px-6 md:left-64">
          <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-content-base font-medium text-text-strong">
                {dirtyCount} unsaved {dirtyCount === 1 ? "change" : "changes"}
              </p>
              <p className="text-content-sm text-text-muted">
                These values publish to the corresponding member dashboards.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={pending} onClick={() => setDirty({})}>
                Discard
              </Button>
              <Button disabled={pending} onClick={save}>
                {pending ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function AmountInput({
  member,
  dirtyValue,
  setValue,
}: {
  member: MemberDirectoryRow;
  dirtyValue?: number;
  setValue: (value: number) => void;
}) {
  return (
    <label className="relative block max-w-48">
      <span className="sr-only">Current week turnover for {member.fullName}</span>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-mono-xs text-text-faint">
        $
      </span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        max="999999999999.99"
        step="0.01"
        value={dirtyValue ?? member.currentWeekTurnover}
        onChange={(event) => setValue(Number(event.target.value))}
        className={`focus-ring h-11 w-full rounded-lg border bg-surface-sunken pr-3 pl-7 font-mono text-content-base text-text-strong tabular-nums ${
          dirtyValue === undefined ? "border-border-hairline" : "border-primary"
        }`}
      />
    </label>
  );
}

function DesktopRow({
  member,
  dirtyValue,
  setValue,
}: {
  member: MemberDirectoryRow;
  dirtyValue?: number;
  setValue: (value: number) => void;
}) {
  return (
    <tr className={dirtyValue === undefined ? "" : "bg-accent-soft"}>
      <td className="px-5 py-4">
        <p className="text-content-sm font-medium text-text-strong">{member.fullName}</p>
        <p className="mt-1 font-mono text-mono-xs text-text-faint">{member.id}</p>
      </td>
      <td className="px-4 py-4 text-content-sm text-text-muted capitalize">
        {member.membershipStatus} · {member.isMaster ? "Master" : `Tier ${member.currentTier}`}
      </td>
      <td className="px-4 py-4">
        <AmountInput member={member} dirtyValue={dirtyValue} setValue={setValue} />
      </td>
      <td className="px-5 py-4 text-right font-mono text-content-sm text-text-default tabular-nums">
        {money(lifetimePreview(member, dirtyValue))}
      </td>
    </tr>
  );
}

function MobileRow({
  member,
  dirtyValue,
  setValue,
}: {
  member: MemberDirectoryRow;
  dirtyValue?: number;
  setValue: (value: number) => void;
}) {
  return (
    <article className={`p-4 ${dirtyValue === undefined ? "" : "bg-accent-soft"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-content-sm font-medium text-text-strong">{member.fullName}</h3>
          <p className="mt-1 text-content-sm text-text-muted capitalize">
            {member.membershipStatus} · {member.isMaster ? "Master" : `Tier ${member.currentTier}`}
          </p>
        </div>
        <div className="text-right">
          <p className="terminal-label text-text-faint">Lifetime</p>
          <p className="mt-1 font-mono text-content-sm text-text-default tabular-nums">
            {money(lifetimePreview(member, dirtyValue))}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <AmountInput member={member} dirtyValue={dirtyValue} setValue={setValue} />
      </div>
    </article>
  );
}
