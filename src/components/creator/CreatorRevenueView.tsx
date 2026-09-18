"use client";

import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import { ArrowRight, Check, CircleHelp, CreditCard, RefreshCw, SlidersHorizontal, Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/layout/AppShell";
import { RevenueTable, type RevenueColumn } from "@/components/creator/revenue/RevenueTable";
import { Button, buttonVariants } from "@/components/ui/button";
import { nativeSelectClass } from "@/components/ui/select";
import { defaultRevenueFilters, parseRevenueFilters, type RevenueFilters, type RevenueReport } from "@/lib/revenue/model";

/**
 * Revenue. Monolith, phase 11a.
 *
 * 74 alias call sites and the same one-component-per-line density as analytics:
 * the whole filter form, its six member filters and its disabled payment
 * fieldset were three lines. Everything here is the token layer plus the
 * rewrite — no behaviour changed, and the parts that say a figure is missing
 * rather than zero are preserved word for word, because that distinction is the
 * point of the screen.
 *
 * The filters stay native `<select>` elements, for the reason given in
 * `CreatorAnalyticsView`: `ui/select` has no call site anywhere in the product.
 */

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "transactions", label: "Transactions" },
  { id: "credits", label: "Member credits" },
  { id: "withdrawals", label: "Withdrawals" },
] as const;

type Tab = (typeof TABS)[number]["id"];

/** The one control the system has no primitive for. Tokens, not aliases. */
const decimal = (value: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const money = (value: number, currency: string) => `${currency.toUpperCase()} ${decimal(value)}`;

const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
        new Date(value),
      )
    : "Not recorded";

const change = (current: number, previous: number) =>
  previous === 0
    ? current === 0
      ? "No change"
      : "New this period"
    : `${current >= previous ? "+" : ""}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(
        ((current - previous) / previous) * 100,
      )}% vs previous period`;

const productName = (value: string) =>
  value === "membership" ? "Membership" : value === "mentorship" ? "Mentorship" : value;

const statusName = (value: string) =>
  ({ succeeded: "Succeeded", refunded: "Marked refunded", pending: "Pending", failed: "Failed" })[value] ?? value;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-2">
      <span className="terminal-label text-text-faint">{label}</span>
      {children}
    </label>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-surface-panel px-4 py-3 text-content-sm text-text-default">
      <CircleHelp size={16} className="mt-0.5 shrink-0 text-primary" />
      <div>{children}</div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 py-5 sm:px-5">
      <p className="terminal-label text-text-faint">{label}</p>
      <p className="mt-2 break-words font-mono text-title-md text-text-strong tabular-nums">{value}</p>
      <p className="mt-2 text-content-sm text-text-muted">{detail}</p>
    </div>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-title-sm font-medium text-text-strong">{title}</h2>
          {description && <p className="mt-1 max-w-[70ch] text-content-sm text-text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Unavailable({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-border-hairline p-6 text-content-sm text-text-muted">{children}</div>;
}

export function CreatorRevenueView({
  memberName,
  initialFilters,
  initialTab,
}: {
  memberName: string;
  initialFilters: RevenueFilters;
  initialTab: string;
}) {
  const [tab, setTab] = useState<Tab>(TABS.some((item) => item.id === initialTab) ? (initialTab as Tab) : "overview");
  const [draft, setDraft] = useState(initialFilters);
  const [applied, setApplied] = useState(initialFilters);
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/creator/revenue?${new URLSearchParams(applied)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Revenue could not be loaded.");
        if (!controller.signal.aborted) setReport(payload);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Revenue could not be loaded.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [applied, refresh]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ ...applied, tab }).toString();
    window.history.replaceState(null, "", url);
  }, [applied, tab]);

  const apply = (filters: RevenueFilters) => {
    try {
      const parsed = parseRevenueFilters(new URLSearchParams(filters));
      setDraft(parsed);
      setApplied(parsed);
      setLoading(true);
      setError("");
      setValidation("");
    } catch (reason) {
      setValidation(reason instanceof Error ? reason.message : "Invalid filters");
    }
  };

  const retry = () => {
    setLoading(true);
    setError("");
    setRefresh((value) => value + 1);
  };

  const preset =
    [7, 30, 90, 365].find((days) => {
      const dates = defaultRevenueFilters(new Date(), days);
      return draft.start === dates.start && draft.end === dates.end;
    }) ?? "";

  const paymentTab = tab === "overview" || tab === "transactions";
  const currencies = [...new Set([draft.currency, ...(report?.currencies ?? ["usd"])])].sort();
  const filterCount = [draft.product, draft.status, draft.source, draft.tier, draft.membership, draft.q].filter(
    Boolean,
  ).length;

  return (
    <AppShell active="Revenue" title="Revenue" memberName={memberName} platformRole="influencer" routeBase="/creator">
      <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-border-hairline pb-7">
          <div>
            <p className="terminal-label text-text-faint">Community finances</p>
            <h1 className="mt-3 text-title-lg font-medium text-text-strong">Every payment, in perspective.</h1>
            <p className="mt-3 max-w-2xl text-content-base text-text-default">
              Understand your income, review member transactions, and keep credits separate from payouts.
            </p>
          </div>
          <Link href="/creator/analytics" className={buttonVariants({ variant: "outline" })}>
            Analytics
            <ArrowRight size={15} />
          </Link>
        </header>

        <form
          className="mt-8 rounded-lg border border-border-hairline bg-surface-panel p-4 sm:p-5"
          onSubmit={(event) => {
            event.preventDefault();
            apply(draft);
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-44 flex-1">
              <Field label="Reporting period">
                <select
                  className={nativeSelectClass}
                  value={preset}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    const dates = defaultRevenueFilters(new Date(), Number(event.target.value));
                    setDraft({ ...draft, start: dates.start, end: dates.end });
                  }}
                >
                  <option value="">Custom range</option>
                  {[7, 30, 90, 365].map((days) => (
                    <option key={days} value={days}>
                      Last {days} completed days
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="From">
              <input
                className={nativeSelectClass}
                type="date"
                required
                value={draft.start}
                onChange={(event) => setDraft({ ...draft, start: event.target.value })}
              />
            </Field>

            <Field label="Through">
              <input
                className={nativeSelectClass}
                type="date"
                required
                value={draft.end}
                onChange={(event) => setDraft({ ...draft, end: event.target.value })}
              />
            </Field>

            <Button
              type="button"
              variant="outline"
              aria-expanded={expanded}
              aria-controls="revenue-filters"
              onClick={() => setExpanded(!expanded)}
            >
              <SlidersHorizontal size={15} />
              Filters{filterCount ? ` (${filterCount})` : ""}
            </Button>

            <Button type="submit" disabled={loading}>
              <Check size={15} />
              Apply
            </Button>
          </div>

          {expanded && (
            <div id="revenue-filters" className="mt-5 space-y-5 border-t border-border-hairline pt-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Member name or exact ID">
                  <input
                    className={nativeSelectClass}
                    type="search"
                    maxLength={100}
                    placeholder="Search members"
                    value={draft.q}
                    onChange={(event) => setDraft({ ...draft, q: event.target.value })}
                  />
                </Field>

                <Field label="Current tier">
                  <select
                    className={nativeSelectClass}
                    value={draft.tier}
                    onChange={(event) => setDraft({ ...draft, tier: event.target.value })}
                  >
                    <option value="">All tiers</option>
                    {[1, 2, 3, 4, 5].map((tier) => (
                      <option key={tier} value={tier}>
                        {tier === 5 ? "Master" : `Tier ${tier}`}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Current membership">
                  <select
                    className={nativeSelectClass}
                    value={draft.membership}
                    onChange={(event) => setDraft({ ...draft, membership: event.target.value })}
                  >
                    <option value="">All statuses</option>
                    {["active", "expired", "pending", "suspended", "cancelled", "refunded", "unknown"].map((status) => (
                      <option key={status} value={status}>
                        {status[0].toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Disabled on the credits and withdrawals tabs: those figures are
                  recorded turnover in USD and a payment filter cannot narrow them. */}
              <fieldset disabled={!paymentTab}>
                <legend className="terminal-label mb-3 text-text-faint">
                  Payment filters · apply to Overview and Transactions
                </legend>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Field label="Currency">
                    <select
                      className={nativeSelectClass}
                      value={draft.currency}
                      onChange={(event) => setDraft({ ...draft, currency: event.target.value })}
                    >
                      {currencies.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Product">
                    <select
                      className={nativeSelectClass}
                      value={draft.product}
                      onChange={(event) => setDraft({ ...draft, product: event.target.value })}
                    >
                      <option value="">All products</option>
                      <option value="membership">Membership</option>
                      <option value="mentorship">Mentorship</option>
                    </select>
                  </Field>

                  <Field label="Payment status">
                    <select
                      className={nativeSelectClass}
                      value={draft.status}
                      onChange={(event) => setDraft({ ...draft, status: event.target.value })}
                    >
                      <option value="">All statuses</option>
                      {["succeeded", "refunded", "pending", "failed"].map((status) => (
                        <option key={status} value={status}>
                          {statusName(status)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Payment source">
                    <select
                      className={nativeSelectClass}
                      value={draft.source}
                      onChange={(event) => setDraft({ ...draft, source: event.target.value })}
                    >
                      <option value="">Stripe and gifted</option>
                      <option value="stripe">Stripe</option>
                      <option value="gifted">Gifted access</option>
                    </select>
                  </Field>
                </div>
              </fieldset>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-content-sm text-text-muted">
              UTC ·{" "}
              {JSON.stringify(draft) !== JSON.stringify(applied)
                ? "Unapplied changes"
                : "Compared with the preceding equal-length period"}
            </p>
            <Button
              type="button"
              variant="link"
              size="chrome"
              onClick={() => {
                setTransactionSearch("");
                apply(defaultRevenueFilters());
              }}
            >
              Reset filters
            </Button>
          </div>

          {validation && (
            <p role="alert" className="mt-2 text-content-sm text-status-danger">
              {validation}
            </p>
          )}
        </form>

        <nav aria-label="Revenue sections" className="mt-7 flex gap-1 overflow-x-auto border-b border-border-hairline">
          {TABS.map((item) => {
            const selected = tab === item.id;
            return (
              <button
                type="button"
                key={item.id}
                aria-current={selected ? "page" : undefined}
                onClick={() => setTab(item.id)}
                className={`focus-ring relative inline-flex min-h-11 shrink-0 items-center px-4 text-content-sm transition-colors ${
                  selected ? "text-text-strong" : "text-text-muted hover:text-text-strong"
                }`}
              >
                {item.label}
                {selected && <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 bg-primary" />}
              </button>
            );
          })}
        </nav>

        {loading ? (
          <div role="status" aria-label="Loading revenue" className="py-10">
            <p className="flex items-center gap-3 text-content-sm text-text-muted">
              <RefreshCw size={16} className="motion-safe:animate-spin" />
              Preparing your revenue report…
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[0, 1, 2, 3].map((value) => (
                <div key={value} className="h-28 rounded-lg bg-surface-panel motion-safe:animate-pulse" />
              ))}
            </div>
            <div className="mt-8 h-64 rounded-lg bg-surface-panel motion-safe:animate-pulse" />
          </div>
        ) : error ? (
          <div role="alert" className="my-8 rounded-lg border border-border-hairline p-8">
            <h2 className="text-title-sm font-medium text-text-strong">Revenue couldn&rsquo;t load</h2>
            <p className="mt-2 text-content-sm text-text-default">{error}</p>
            <Button variant="outline" className="mt-5" onClick={retry}>
              <RefreshCw size={15} />
              Try again
            </Button>
          </div>
        ) : (
          report && (
            <div className="space-y-7 py-7">
              <div className="flex flex-wrap items-center justify-between gap-3 text-content-sm text-text-muted">
                <p>
                  {date(applied.start)} – {date(applied.end)} ·{" "}
                  {paymentTab ? applied.currency.toUpperCase() : "Trading credits in USD"}
                  {applied.q && ` · ${applied.q}`}
                  {applied.tier && ` · Tier ${applied.tier}`}
                  {applied.membership && ` · ${applied.membership}`}
                  {paymentTab && applied.product && ` · ${productName(applied.product)}`}
                  {paymentTab && applied.status && ` · ${statusName(applied.status)}`}
                  {paymentTab && applied.source && ` · ${applied.source}`}
                </p>
                <Button variant="ghost" size="chrome" onClick={retry}>
                  <RefreshCw size={13} />
                  Updated{" "}
                  {new Date(report.generatedAt).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </Button>
              </div>

              {tab === "overview" && (
                <RevenueOverview
                  report={report}
                  openTransactions={() => setTab("transactions")}
                  openCredits={() => setTab("credits")}
                />
              )}
              <div hidden={tab !== "transactions"}>
                <Transactions report={report} search={transactionSearch} setSearch={setTransactionSearch} />
              </div>
              <div hidden={tab !== "credits"}>
                <MemberCredits report={report} retry={retry} />
              </div>
              {tab === "withdrawals" && <Withdrawals />}
            </div>
          )
        )}
      </main>
    </AppShell>
  );
}

function RevenueTrend({ report }: { report: RevenueReport }) {
  const gradientId = useId().replaceAll(":", "");

  return (
    <Section
      title="Income over time"
      description={`${report.bucketDays === 1 ? "Daily" : "Seven-day"} gross payment totals. Gifts and unpaid records are excluded.`}
    >
      <div
        className="h-64 w-full"
        role="img"
        aria-label="Gross payment trend. Exact figures are available in the table below."
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={report.trends} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-border-hairline)" strokeDasharray="3 6" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => String(value).slice(5)}
              stroke="var(--color-text-muted)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              stroke="var(--color-text-muted)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={55}
              tickFormatter={(value) => new Intl.NumberFormat("en", { notation: "compact" }).format(value)}
            />
            <Tooltip
              // 4px, like every other corner in the system. It was 12.
              contentStyle={{
                background: "var(--color-surface-panel)",
                border: "1px solid var(--color-border-hairline)",
                borderRadius: 4,
                color: "var(--color-text-default)",
              }}
              labelFormatter={(value) => `${report.bucketDays === 7 ? "From " : ""}${date(String(value))}`}
              formatter={(value) => [money(Number(value), report.filters.currency), "Gross payments"]}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-3">
        <summary className="focus-ring min-h-11 cursor-pointer rounded-md py-3 text-content-sm text-text-muted">
          View exact income figures
        </summary>
        <RevenueTable
          title="Income trend"
          filename={`revenue-trend-${report.filters.currency}-${report.filters.start}-${report.filters.end}`}
          columns={[
            { label: report.bucketDays === 1 ? "Date (UTC)" : "Period starting (UTC)" },
            { label: `Gross (${report.filters.currency.toUpperCase()})`, numeric: true, format: decimal },
            { label: "Payments", numeric: true },
          ]}
          rows={report.trends.map((row) => ({ id: row.date, values: [row.date, row.amount, row.payments] }))}
        />
      </details>
    </Section>
  );
}

function RevenueOverview({
  report,
  openTransactions,
  openCredits,
}: {
  report: RevenueReport;
  openTransactions: () => void;
  openCredits: () => void;
}) {
  const metrics = report.metrics;
  const currency = report.filters.currency;

  const gross = metrics.gross === null ? "Unavailable" : money(metrics.gross, currency);
  const grossChange =
    metrics.gross === null || metrics.previousGross === null
      ? "Detailed payment reporting is not configured"
      : change(metrics.gross, metrics.previousGross);

  /* Each row is a figure the product either has or does not have. "Not tracked"
     and "Not available" are different from zero, and saying so is the whole
     reason this table exists. */
  const proceeds: [string, string][] = [
    ["Original gross payment value", metrics.gross === null ? "Unavailable" : money(metrics.gross, currency)],
    [
      "Original value of payments marked refunded",
      report.paymentDetailsAvailable ? money(metrics.flaggedPaymentValue, currency) : "Unavailable",
    ],
    ["Actual refund amounts", "Not tracked"],
    ["Processing fees", "Not tracked"],
    ["Net proceeds", "Not available"],
  ];

  return (
    <div className="space-y-9">
      {!report.paymentDetailsAvailable && (
        <Note>
          {report.paymentSummaryAvailable
            ? "The gross USD total comes from the existing creator aggregate."
            : "Payment totals for this filter combination are unavailable."}{" "}
          Transaction, customer, product, refund, and payment-count details require server payment reporting to be
          configured.
        </Note>
      )}

      <div className="grid grid-cols-2 gap-x-4 border-y border-border-hairline lg:grid-cols-4">
        <Metric label="Gross payments" value={gross} detail={grossChange} />
        <Metric
          label="Paying members"
          value={metrics.buyers === null ? "Unavailable" : metrics.buyers.toLocaleString()}
          detail={
            metrics.buyers === null || metrics.previousBuyers === null
              ? "Requires transaction details"
              : change(metrics.buyers, metrics.previousBuyers)
          }
        />
        <Metric
          label="Average payment"
          value={metrics.average === null ? "Unavailable" : money(metrics.average, currency)}
          detail={
            metrics.payments === null
              ? "Requires transaction details"
              : `${metrics.payments.toLocaleString()} recorded payments`
          }
        />
        <Metric
          label="Payments now marked refunded"
          value={report.paymentDetailsAvailable ? metrics.refundedPayments.toLocaleString() : "Unavailable"}
          detail="From the selected payment period"
        />
      </div>

      <p className="text-content-sm text-text-muted">
        Comparison: {date(report.previous.start)} – {date(report.previous.end)}. Gross payments are recorded revenue and
        are not net proceeds.
      </p>

      {report.paymentDetailsAvailable ? (
        <div className="grid gap-9 xl:grid-cols-[minmax(0,1.8fr)_minmax(250px,1fr)]">
          <RevenueTrend report={report} />

          <Section title="Where income comes from" description="Membership and mentorship, in the selected currency.">
            <div className="divide-y divide-border-hairline border-y border-border-hairline">
              {report.products.map((product) => (
                <div key={product.product} className="py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-content-base font-medium text-text-strong">{productName(product.product)}</p>
                      <p className="mt-1 font-mono text-mono-xs text-text-muted tabular-nums">
                        {product.count.toLocaleString()} payments
                      </p>
                    </div>
                    <p className="font-mono text-content-sm text-text-strong tabular-nums">
                      {money(product.amount, currency)}
                    </p>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-sm bg-surface-sunken">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${metrics.gross ? (product.amount / metrics.gross) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="mt-2 text-content-sm text-text-muted">{change(product.amount, product.previous)}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-content-sm text-text-muted">
              {metrics.newBuyers} first-time purchasers · {metrics.returningBuyers} returning purchasers. First purchase
              is determined across all products and currencies.
            </p>
          </Section>
        </div>
      ) : (
        <Section title="Income breakdown" description="Daily trends and product splits require transaction details.">
          <Unavailable>Detailed payment reporting is not configured.</Unavailable>
        </Section>
      )}

      <Section
        title="From payments to proceeds"
        description="Only recorded amounts are shown. Missing costs are not treated as zero."
      >
        <dl className="divide-y divide-border-hairline border-y border-border-hairline">
          {proceeds.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-5 py-4 text-content-sm">
              <dt className="text-text-default">{label}</dt>
              <dd
                className={`shrink-0 text-right ${
                  value.startsWith(currency.toUpperCase())
                    ? "font-mono text-text-strong tabular-nums"
                    : "text-text-muted"
                }`}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {report.paymentDetailsAvailable && (
        <Note>
          Refund and fee syncing is not connected. Payment statuses reflect the website&rsquo;s saved records and may
          differ from the payment processor. A refunded payment&rsquo;s original value does not tell us how much was
          returned.
        </Note>
      )}

      {report.paymentDetailsAvailable && metrics.missingPaidDates > 0 && (
        <Note>
          {metrics.missingPaidDates} completed payment records have no payment date. They remain visible in Transactions
          but are excluded from gross payment totals until their dates are corrected.
        </Note>
      )}

      <Section
        title="Members behind the revenue"
        description="Highest gross payment value first. Each person is counted once."
        action={
          report.paymentDetailsAvailable ? (
            <Button variant="outline" onClick={openTransactions}>
              All transactions
              <ArrowRight size={14} />
            </Button>
          ) : undefined
        }
      >
        {report.paymentDetailsAvailable ? (
          <RevenueTable
            title="Paying members"
            filename={`revenue-members-${currency}-${report.filters.start}-${report.filters.end}`}
            columns={[
              { label: "Member" },
              { label: "Tier", numeric: true },
              { label: "Payments", numeric: true },
              { label: `Gross (${currency.toUpperCase()})`, numeric: true, format: decimal },
              { label: "Purchaser" },
              { label: "Last payment (UTC)" },
            ]}
            rows={report.customers.map((customer) => ({
              id: customer.id,
              values: [
                customer.name,
                customer.tier,
                customer.payments,
                customer.amount,
                customer.firstPurchase ? "First-time" : "Returning",
                customer.lastPayment.slice(0, 10),
              ],
              detail: (
                <>
                  <p className="break-all">Member ID: {customer.id}</p>
                  <p className="capitalize">Current membership: {customer.membership}</p>
                </>
              ),
            }))}
          />
        ) : (
          <Unavailable>Customer payment details are not configured.</Unavailable>
        )}
      </Section>

      <button
        type="button"
        className="focus-ring flex w-full items-center justify-between gap-4 rounded-lg border border-border-hairline p-5 text-left transition-colors hover:bg-surface-raised"
        onClick={openCredits}
      >
        <div>
          <p className="text-content-base font-medium text-text-strong">Member credits have their own story.</p>
          <p className="mt-1 text-content-sm text-text-muted">
            Review recorded turnover separately from payment income.
          </p>
        </div>
        <ArrowRight size={17} className="shrink-0 text-primary" />
      </button>
    </div>
  );
}

function Transactions({
  report,
  search,
  setSearch,
}: {
  report: RevenueReport;
  search: string;
  setSearch: (value: string) => void;
}) {
  if (!report.paymentDetailsAvailable) {
    return (
      <Section
        title="Payment history"
        description="Individual transaction access is not configured for this deployment."
      >
        <div className="rounded-lg border border-border-hairline p-6">
          <p className="text-content-base font-medium text-text-strong">Transaction details are unavailable</p>
          <p className="mt-2 max-w-2xl text-content-sm text-text-muted">
            Revenue totals and member credits can still load. A protected server-side payment reader is required before
            member names, transaction IDs, products, and payment statuses can be shown here.
          </p>
        </div>
      </Section>
    );
  }

  const rows = report.transactions.filter(
    (row) =>
      !search ||
      row.id.toLowerCase().includes(search.toLowerCase()) ||
      row.member.name.toLowerCase().includes(search.toLowerCase()),
  );

  const columns: RevenueColumn[] = [
    { label: "Member" },
    { label: "Product" },
    { label: "Record date (UTC)" },
    { label: "Status" },
    { label: "Source" },
    { label: `Original amount (${report.filters.currency.toUpperCase()})`, numeric: true, format: decimal },
  ];

  return (
    <div className="space-y-7">
      <Section
        title="Payment history"
        description="Payment date for paid records; creation date for unpaid records. Expand a member’s row to inspect the transaction."
      >
        <div className="mb-5 grid items-end gap-4 sm:grid-cols-[minmax(220px,1fr)_auto]">
          <Field label="Find a transaction">
            <input
              className={nativeSelectClass}
              type="search"
              placeholder="Member name or transaction ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
          <p className="pb-3 font-mono text-mono-xs text-text-muted tabular-nums">
            {report.metrics.gifts} gifts · {report.metrics.pending} pending · {report.metrics.failed} failed records
          </p>
        </div>

        <RevenueTable
          title="Payment history"
          referenceLabels={["Transaction ID", "Member ID"]}
          filename={`revenue-transactions-${report.filters.currency}-${report.filters.start}-${report.filters.end}`}
          columns={columns}
          rows={rows.map((row) => ({
            id: row.id,
            references: [row.id, row.member.id],
            values: [
              row.member.name,
              productName(row.product),
              row.date.slice(0, 10),
              statusName(row.status),
              row.source === "gifted" ? "Gifted" : "Stripe",
              row.amount,
            ],
            detail: (
              <div className="space-y-1">
                <p className="break-all">Transaction: {row.id}</p>
                <p className="break-all">Member: {row.member.id}</p>
                <p>Created: {date(row.createdAt)}</p>
                <p>Paid: {date(row.paidAt)}</p>
                {row.status === "refunded" && (
                  <>
                    <p>Marked refunded: {date(row.refundedAt)}</p>
                    <p>Actual refund amount: not recorded</p>
                  </>
                )}
                {row.source === "gifted" && (
                  <>
                    <p>Gifted by: {row.grantedBy ?? "Not recorded"}</p>
                    <p>Access duration: {row.durationMonths ?? "Not recorded"} months</p>
                  </>
                )}
                <p>Referring member: not tracked</p>
              </div>
            ),
          }))}
        />
      </Section>

      <Note>
        Gifted access is a zero-value grant. Pending and failed records are not income. Failed checkout attempts that
        were never saved cannot appear in this history.
      </Note>
    </div>
  );
}

function MemberCredits({ report, retry }: { report: RevenueReport; retry: () => void }) {
  const credits = report.credits;

  return (
    <div className="space-y-8">
      <Note>
        Available balances and withdrawal reservations are not connected yet. The table below shows saved turnover
        records; it does not establish how much a member can withdraw.
      </Note>

      <div className="grid grid-cols-2 gap-x-4 border-b border-border-hairline lg:grid-cols-4">
        <Metric
          label="Recorded turnover"
          value={!credits.available || !credits.weeks ? "—" : money(credits.total, "usd")}
          detail={
            credits.weeks ? `${credits.weeks} complete UTC weeks inside your dates` : "No complete week inside your dates"
          }
        />
        <Metric
          label="Contributors"
          value={credits.available && credits.weeks ? credits.contributors.toLocaleString() : "—"}
          detail="Members with positive recorded turnover"
        />
        <Metric label="Available member balances" value="Not connected" detail="Requires a reconciled credit ledger" />
        <Metric label="Reserved for withdrawal" value="Not connected" detail="Requires withdrawal request records" />
      </div>

      {!credits.available ? (
        <div role="alert" className="rounded-lg border border-border-hairline p-6">
          <p className="text-content-base font-medium text-text-strong">Turnover records couldn&rsquo;t load</p>
          <p className="mt-2 text-content-sm text-text-muted">
            Payment reporting is still available. Retry to load member turnover.
          </p>
          <Button variant="outline" className="mt-4" onClick={retry}>
            <RefreshCw size={15} />
            Retry turnover
          </Button>
        </div>
      ) : (
        <Section
          title="Recorded trading earnings"
          description={
            credits.start && credits.end
              ? `${date(credits.start)} – ${date(credits.end)}. Partial weeks are excluded. Product, payment status, source, and currency filters do not apply here.`
              : "Choose a date range containing at least one complete Monday–Sunday week."
          }
          action={
            <Link href="/creator/members/turnover" className={buttonVariants({ variant: "outline" })}>
              Turnover workspace
              <ArrowRight size={14} />
            </Link>
          }
        >
          <RevenueTable
            title="Recorded trading earnings"
            filename={`revenue-recorded-turnover-usd-${credits.start ?? report.filters.start}-${credits.end ?? report.filters.end}`}
            columns={[
              { label: "Member" },
              { label: "Tier", numeric: true },
              { label: "Recorded turnover (USD)", numeric: true, format: decimal },
              { label: "Lifetime recorded (USD)", numeric: true, format: decimal },
              { label: "Weeks recorded", numeric: true },
            ]}
            rows={credits.trading.map((row) => ({
              id: row.id,
              values: [row.name, row.tier, row.amount, row.lifetime, row.weeks],
              detail: (
                <>
                  <p className="mb-2 break-all">Member ID: {row.id}</p>
                  <ul className="space-y-3">
                    {row.entries.map((entry) => (
                      <li key={entry.week}>
                        <p className="text-text-default">
                          Week of {date(entry.week)} · {money(entry.amount, "usd")}
                        </p>
                        <p>
                          Last saved by {entry.updatedBy} on {date(entry.updatedAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              ),
            }))}
          />
        </Section>
      )}

      <Section title="Referral rewards" description="Not tracked yet">
        <div className="flex gap-4 border-y border-border-hairline py-5">
          <CreditCard size={22} className="mt-1 shrink-0 text-primary" />
          <div>
            <p className="text-content-base font-medium text-text-strong">$5 after the first membership payment</p>
            <p className="mt-2 max-w-2xl text-content-sm text-text-default">
              A qualifying referral adds $5 to the referrer&rsquo;s credit balance. Refunded qualifying payments reverse
              the reward. Attribution, reward entries, and balances will appear here when the referral ledger is
              connected.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Withdrawals() {
  const flow: [string, string][] = [
    ["Requested", "Reserve the requested amount from the member’s available balance."],
    ["Processing", "Authorized staff review the destination and send the crypto externally."],
    ["Paid", "Record the verified transfer, network, amount, fees, and transaction reference."],
  ];

  return (
    <section className="grid gap-10 py-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div>
        <Wallet size={28} className="text-primary" />
        <p className="mt-5 inline-flex rounded-md border border-border-hairline px-3 py-1 text-content-sm text-text-default">
          Not connected yet
        </p>
        <h2 className="mt-4 text-title-lg font-medium text-text-strong">A clear record of every crypto payout.</h2>
        <p className="mt-4 max-w-lg text-content-base text-text-default">
          Trading credits and referral rewards can be withdrawn through manual crypto payouts. This section will hold
          requests, reserved balances, and completed transfers once the credit ledger and withdrawal flow are connected.
        </p>
        <p className="mt-5 text-content-sm text-text-muted">
          There are no payout records available to report yet. That does not mean the community&rsquo;s outstanding
          balance is zero.
        </p>
      </div>

      <div className="self-center">
        <h3 className="text-title-sm font-medium text-text-strong">Planned manual payout flow</h3>
        <ol className="mt-4 divide-y divide-border-hairline border-y border-border-hairline">
          {flow.map(([title, description]) => (
            <li key={title} className="py-4">
              <p className="text-content-base font-medium text-text-strong">{title}</p>
              <p className="mt-1 text-content-sm text-text-muted">{description}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-content-sm text-text-muted">
          Crypto asset and network, withdrawal minimum, fees, and payout permissions still need to be configured. Report
          dates and payment filters do not apply to this setup state.
        </p>
      </div>
    </section>
  );
}
