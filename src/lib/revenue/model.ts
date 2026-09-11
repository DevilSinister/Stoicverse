export type RevenueFilters = {
  start: string;
  end: string;
  currency: string;
  product: string;
  status: string;
  source: string;
  tier: string;
  membership: string;
  q: string;
};

export type RevenuePayment = {
  id: string;
  user_id: string;
  product_type: string;
  amount: number | string;
  currency: string;
  status: string;
  source: string;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
  granted_by: string | null;
  duration_months: number | null;
};
export type RevenueProfile = { id: string; full_name: string | null; is_suspended: boolean; platform_role: string };
export type RevenueMembership = { user_id: string; status: string; expires_at: string | null };
export type RevenueTier = { user_id: string; current_tier: number; is_master: boolean };
export type RevenueTurnover = { user_id: string; week_start: string; amount_usd: number | string; updated_at: string; updated_by: string | null };
export type RevenueAggregate = { gross: number | string; previousGross: number | string };
export type RevenueSource = {
  payments: RevenuePayment[] | null;
  paymentAggregate?: RevenueAggregate | null;
  profiles: RevenueProfile[];
  memberships: RevenueMembership[];
  tiers: RevenueTier[];
  turnover: RevenueTurnover[] | null;
};

const DAY = 86_400_000;
const WEEK = 7 * DAY;
export const revenueDate = (date: Date) => date.toISOString().slice(0, 10);

export function defaultRevenueFilters(now = new Date(), days = 30): RevenueFilters {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return { start: revenueDate(new Date(today - days * DAY)), end: revenueDate(new Date(today - DAY)), currency: 'usd', product: '', status: '', source: '', tier: '', membership: '', q: '' };
}

export function parseRevenueFilters(params: URLSearchParams, now = new Date()): RevenueFilters {
  const defaults = defaultRevenueFilters(now);
  const filters = Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, params.get(key) ?? value])) as RevenueFilters;
  const start = new Date(`${filters.start}T00:00:00Z`), end = new Date(`${filters.end}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.start) || !/^\d{4}-\d{2}-\d{2}$/.test(filters.end) || !Number.isFinite(+start) || !Number.isFinite(+end) || revenueDate(start) !== filters.start || revenueDate(end) !== filters.end || +start > +end || +end + DAY > +now || +end - +start >= 366 * DAY) throw new Error('Choose up to 366 completed days, ending yesterday or earlier.');
  if (!/^[a-z]{3}$/.test(filters.currency) || !['', 'membership', 'mentorship'].includes(filters.product) || !['', 'succeeded', 'refunded', 'pending', 'failed'].includes(filters.status) || !['', 'stripe', 'gifted'].includes(filters.source) || !['', '1', '2', '3', '4', '5'].includes(filters.tier) || !['', 'active', 'expired', 'pending', 'suspended', 'cancelled', 'refunded', 'unknown'].includes(filters.membership) || filters.q.length > 100) throw new Error('One or more revenue filters are invalid.');
  return { ...filters, q: filters.q.trim() };
}

export function buildRevenue(source: RevenueSource, filters: RevenueFilters, now = new Date()) {
  const start = Date.parse(`${filters.start}T00:00:00Z`), end = Date.parse(`${filters.end}T00:00:00Z`) + DAY;
  const duration = end - start;
  const inPeriod = (value: string | null, previous = false) => !!value && Date.parse(value) >= start - (previous ? duration : 0) && Date.parse(value) < end - (previous ? duration : 0);
  const profiles = new Map(source.profiles.map(p => [p.id, p]));
  const memberships = new Map(source.memberships.map(m => [m.user_id, m]));
  const tiers = new Map(source.tiers.map(t => [t.user_id, t]));
  const member = (id: string) => {
    const profile = profiles.get(id), membership = memberships.get(id), tier = tiers.get(id);
    return {
      id,
      name: profile?.full_name?.trim() || (profile ? 'Unnamed member' : 'Unavailable member'),
      tier: profile ? tier?.is_master ? 5 : tier?.current_tier ?? 1 : null,
      membership: profile?.is_suspended ? 'suspended' : membership?.status === 'active' && membership.expires_at && Date.parse(membership.expires_at) <= +now ? 'expired' : membership?.status ?? (profile ? 'pending' : 'unknown'),
    };
  };
  const matchesMember = (m: ReturnType<typeof member>) => (!filters.tier || m.tier === Number(filters.tier)) && (!filters.membership || m.membership === filters.membership) && (!filters.q || m.name.toLowerCase().includes(filters.q.toLowerCase()) || m.id.toLowerCase() === filters.q.toLowerCase());
  const toCents = (amount: number | string) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100))) throw new Error('Invalid recorded amount');
    return Math.round(value * 100);
  };
  const sum = (rows: { amount: number }[]) => {
    const cents = rows.reduce((total, row) => total + toCents(row.amount), 0);
    if (!Number.isSafeInteger(cents)) throw new Error('Report amount exceeds safe precision');
    return cents / 100;
  };
  const paymentDetailsAvailable = source.payments !== null;
  const rows = (source.payments ?? []).map(payment => ({
    id: payment.id,
    member: member(payment.user_id),
    product: payment.product_type,
    amount: toCents(payment.amount) / 100,
    currency: payment.currency.toLowerCase(),
    status: payment.status,
    source: payment.source,
    paidAt: payment.paid_at,
    createdAt: payment.created_at,
    refundedAt: payment.refunded_at,
    date: payment.paid_at ?? payment.created_at,
    grantedBy: payment.granted_by ? member(payment.granted_by).name : null,
    durationMonths: payment.duration_months,
  }));
  // A refunded record still represents an original payment, not its refund amount.
  const isCollected = (row: typeof rows[number]) => row.source === 'stripe' && ['succeeded', 'refunded'].includes(row.status) && row.paidAt !== null && row.amount > 0;
  const firstPayment = new Map<string, string>();
  for (const row of rows.filter(isCollected).sort((a, b) => a.paidAt!.localeCompare(b.paidAt!) || a.id.localeCompare(b.id))) {
    if (!firstPayment.has(row.member.id)) firstPayment.set(row.member.id, row.id);
  }
  const scoped = rows.filter(row => matchesMember(row.member) && row.currency === filters.currency && (!filters.product || row.product === filters.product) && (!filters.source || row.source === filters.source) && (!filters.status || row.status === filters.status));
  const transactions = scoped.filter(row => inPeriod(row.date)).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const receipts = scoped.filter(row => isCollected(row) && inPeriod(row.paidAt));
  const previousReceipts = scoped.filter(row => isCollected(row) && inPeriod(row.paidAt, true));
  const buyers = Map.groupBy(receipts, row => row.member.id);
  const newBuyers = receipts.filter(row => firstPayment.get(row.member.id) === row.id).length;
  const products = ['membership', 'mentorship'].map(product => {
    const payments = receipts.filter(row => row.product === product), previous = previousReceipts.filter(row => row.product === product);
    return { product, amount: sum(payments), previous: sum(previous), count: payments.length };
  });
  const customers = [...buyers.values()].map(payments => ({
    ...payments[0].member,
    amount: sum(payments),
    payments: payments.length,
    firstPurchase: payments.some(row => firstPayment.get(row.member.id) === row.id),
    lastPayment: payments.reduce((latest, row) => row.paidAt! > latest ? row.paidAt! : latest, ''),
  })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  const bucketDays = duration > 90 * DAY ? 7 : 1;
  const trends = [];
  for (let time = start; time < end; time += bucketDays * DAY) {
    const inBucket = (value: string) => Date.parse(value) >= time && Date.parse(value) < Math.min(time + bucketDays * DAY, end);
    const payments = receipts.filter(row => inBucket(row.paidAt!));
    trends.push({ date: revenueDate(new Date(time)), amount: sum(payments), membership: sum(payments.filter(row => row.product === 'membership')), mentorship: sum(payments.filter(row => row.product === 'mentorship')), payments: payments.length });
  }
  // Trading is recorded by week, so only complete UTC weeks inside the date range count.
  const firstMonday = start + ((8 - new Date(start).getUTCDay()) % 7) * DAY;
  const completeWeekCount = Math.max(0, Math.floor((end - firstMonday) / WEEK));
  const weekEnd = firstMonday + completeWeekCount * WEEK;
  const creditRows = source.turnover?.filter(row => matchesMember(member(row.user_id))) ?? [];
  const selectedCredits = creditRows.filter(row => Date.parse(row.week_start) >= firstMonday && Date.parse(row.week_start) < weekEnd);
  const byCreditMember = Map.groupBy(creditRows, row => row.user_id);
  const trading = [...byCreditMember.entries()].map(([id, entries]) => {
    const selected = selectedCredits.filter(row => row.user_id === id);
    return { ...member(id), amount: sum(selected.map(row => ({ amount: toCents(row.amount_usd) / 100 }))), lifetime: sum(entries.map(row => ({ amount: toCents(row.amount_usd) / 100 }))), weeks: selected.length,
      entries: selected.map(row => ({ week: row.week_start, amount: toCents(row.amount_usd) / 100, updatedAt: row.updated_at, updatedBy: row.updated_by ? member(row.updated_by).name : 'Not recorded' })).sort((a, b) => b.week.localeCompare(a.week)) };
  }).filter(row => row.weeks > 0).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  const aggregateGross = source.paymentAggregate ? toCents(source.paymentAggregate.gross) / 100 : null;
  const aggregatePreviousGross = source.paymentAggregate ? toCents(source.paymentAggregate.previousGross) / 100 : null;
  const gross = paymentDetailsAvailable ? sum(receipts) : aggregateGross;
  const previousGross = paymentDetailsAvailable ? sum(previousReceipts) : aggregatePreviousGross;
  return {
    filters,
    generatedAt: now.toISOString(),
    currencies: [...new Set(['usd', filters.currency, ...rows.map(row => row.currency)])].sort(),
    previous: { start: revenueDate(new Date(start - duration)), end: revenueDate(new Date(start - DAY)) },
    paymentDetailsAvailable,
    paymentSummaryAvailable: gross !== null && previousGross !== null,
    metrics: {
      gross, previousGross, payments: paymentDetailsAvailable ? receipts.length : null, previousPayments: paymentDetailsAvailable ? previousReceipts.length : null,
      buyers: paymentDetailsAvailable ? buyers.size : null, previousBuyers: paymentDetailsAvailable ? new Set(previousReceipts.map(row => row.member.id)).size : null,
      average: paymentDetailsAvailable && receipts.length ? sum(receipts) / receipts.length : null,
      previousAverage: paymentDetailsAvailable && previousReceipts.length ? sum(previousReceipts) / previousReceipts.length : null,
      refundedPayments: receipts.filter(row => row.status === 'refunded').length,
      flaggedPaymentValue: sum(receipts.filter(row => row.status === 'refunded')),
      stillSuccessful: sum(receipts.filter(row => row.status === 'succeeded')),
      gifts: transactions.filter(row => row.source === 'gifted').length,
      failed: transactions.filter(row => row.status === 'failed').length,
      pending: transactions.filter(row => row.status === 'pending').length,
      missingPaidDates: transactions.filter(row => row.source === 'stripe' && ['succeeded', 'refunded'].includes(row.status) && !row.paidAt).length,
      newBuyers, returningBuyers: customers.filter(row => !row.firstPurchase).length,
    },
    products, customers, trends, bucketDays, transactions,
    credits: {
      available: source.turnover !== null,
      start: completeWeekCount ? revenueDate(new Date(firstMonday)) : null,
      end: completeWeekCount ? revenueDate(new Date(weekEnd - DAY)) : null,
      weeks: completeWeekCount,
      total: sum(selectedCredits.map(row => ({ amount: toCents(row.amount_usd) / 100 }))),
      contributors: trading.filter(row => row.amount > 0).length,
      trading,
    },
  };
}

export type RevenueReport = ReturnType<typeof buildRevenue>;
