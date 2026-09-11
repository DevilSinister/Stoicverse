import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { buildRevenue, defaultRevenueFilters, parseRevenueFilters } from '../src/lib/revenue/model.ts';

const now = new Date('2026-09-08T12:00:00Z');
const filters = { ...defaultRevenueFilters(now), start: '2026-08-10', end: '2026-09-06' };
const payment = (id, patch = {}) => ({ id, user_id: 'a', product_type: 'membership', amount: '10.00', currency: 'usd', status: 'succeeded', source: 'stripe', paid_at: '2026-08-15T12:00:00Z', refunded_at: null, created_at: '2026-08-15T11:00:00Z', granted_by: null, duration_months: null, ...patch });
function fixture() {
  return {
    profiles: [{ id: 'a', full_name: 'Alice', is_suspended: false, platform_role: 'member' }, { id: 'b', full_name: 'Bob', is_suspended: false, platform_role: 'member' }],
    memberships: [{ user_id: 'a', status: 'active', expires_at: '2026-09-01' }],
    tiers: [{ user_id: 'b', current_tier: 3, is_master: true }],
    payments: [
      payment('previous', { paid_at: '2026-08-01T12:00:00Z' }),
      payment('current'),
      payment('refunded', { user_id: 'b', product_type: 'mentorship', amount: '1000', status: 'refunded', refunded_at: '2026-09-07T00:00:00Z' }),
      payment('gift', { user_id: 'b', amount: 0, source: 'gifted', duration_months: 1 }),
      payment('failed', { amount: '1000', status: 'failed', paid_at: null }),
      payment('pending', { amount: '1000', status: 'pending', paid_at: null }),
      payment('euro', { currency: 'eur', amount: '4000' }),
      payment('missing-date', { amount: '100', paid_at: null }),
    ],
    turnover: [
      { user_id: 'a', week_start: '2026-08-10', amount_usd: '0.10', updated_at: '2026-08-10', updated_by: 'b' },
      { user_id: 'a', week_start: '2026-08-17', amount_usd: '0.20', updated_at: '2026-08-17', updated_by: 'b' },
      { user_id: 'b', week_start: '2026-08-24', amount_usd: 0, updated_at: '2026-08-24', updated_by: 'a' },
    ],
  };
}

test('completed-day presets and exact prior-period boundaries', () => {
  assert.equal(defaultRevenueFilters(now).start, '2026-08-09');
  assert.equal(defaultRevenueFilters(now).end, '2026-09-07');
  const report = buildRevenue(fixture(), filters, now);
  assert.deepEqual(report.previous, { start: '2026-07-13', end: '2026-08-09' });
  assert.equal(report.trends.length, 28);
});
test('validation rejects malformed dates, current partial day and invalid filters', () => {
  for (const patch of [{ start: '2026-02-30' }, { start: '2026-09-07' }, { end: '2026-09-08' }, { start: '2024-01-01' }, { currency: 'USD' }, { product: 'unknown' }, { status: 'paid' }, { tier: '6' }, { q: 'x'.repeat(101) }]) assert.throws(() => parseRevenueFilters(new URLSearchParams({ ...filters, ...patch }), now));
  assert.deepEqual(parseRevenueFilters(new URLSearchParams(filters), new Date('2026-09-07T00:00:00Z')), filters);
});
test('gross excludes unpaid, gifted, missing dates and other currencies; refund values remain original', () => {
  const report = buildRevenue(fixture(), filters, now);
  assert.equal(report.metrics.gross, 1010);
  assert.equal(report.metrics.previousGross, 10);
  assert.equal(report.metrics.payments, 2);
  assert.equal(report.metrics.refundedPayments, 1);
  assert.equal(report.metrics.flaggedPaymentValue, 1000);
  assert.equal(report.metrics.stillSuccessful, 10);
  assert.equal(report.metrics.gifts, 1);
  assert.equal(report.metrics.failed, 1);
  assert.equal(report.metrics.pending, 1);
  assert.equal(report.metrics.missingPaidDates, 1);
  assert.equal(report.metrics.average, 505);
  assert.equal(report.trends.reduce((sum, row) => sum + row.amount, 0), 1010);
  assert.deepEqual(report.currencies, ['eur', 'usd']);
});
test('payments stay assigned to paid date even if refund date is in a later period', () => {
  const report = buildRevenue(fixture(), { ...filters, start: '2026-09-07', end: '2026-09-07' }, now);
  assert.equal(report.metrics.refundedPayments, 0);
  assert.equal(report.metrics.gross, 0);
  assert.equal(report.transactions.length, 0);
});
test('new and returning purchasers use first lifetime payment across products and currencies', () => {
  const report = buildRevenue(fixture(), filters, now);
  assert.equal(report.metrics.newBuyers, 1);
  assert.equal(report.metrics.returningBuyers, 1);
  assert.equal(report.customers.find(row => row.id === 'a').firstPurchase, false);
  assert.equal(report.customers.find(row => row.id === 'b').firstPurchase, true);
});
test('filters scope financial records, derive expired access/Master, and preserve unlinked payments', () => {
  const source = fixture();
  source.payments.push(payment('orphan', { user_id: 'unavailable' }));
  assert.equal(buildRevenue(source, filters, now).metrics.gross, 1020);
  const report = buildRevenue(source, { ...filters, q: 'Alice', membership: 'expired' }, now);
  assert.equal(report.metrics.gross, 10);
  assert.equal(report.credits.total, 0.3);
  assert.equal(buildRevenue(source, { ...filters, tier: '5' }, now).metrics.gross, 1000);
  assert.equal(buildRevenue(source, { ...filters, currency: 'eur' }, now).metrics.gross, 4000);
  assert.equal(buildRevenue(source, { ...filters, product: 'membership', status: 'succeeded', source: 'gifted' }, now).metrics.gross, 0);
});
test('turnover uses only complete contained weeks and ignores payment-specific filters', () => {
  const report = buildRevenue(fixture(), { ...filters, start: '2026-08-11', end: '2026-08-25', currency: 'eur', product: 'mentorship', source: 'gifted', status: 'failed' }, now);
  assert.equal(report.credits.start, '2026-08-17');
  assert.equal(report.credits.end, '2026-08-23');
  assert.equal(report.credits.total, 0.2);
  assert.equal(report.credits.trading[0].lifetime, 0.3);
  assert.equal(report.credits.weeks, 1);
  const partial = buildRevenue(fixture(), { ...filters, start: '2026-08-12', end: '2026-08-13' }, now);
  assert.equal(partial.credits.weeks, 0); assert.equal(partial.credits.start, null);
});
test('turnover load failure is unavailable, not zero balance; zero saved entries remain visible', () => {
  const unavailable = buildRevenue({ ...fixture(), turnover: null }, filters, now);
  assert.equal(unavailable.credits.available, false);
  const report = buildRevenue(fixture(), filters, now);
  assert.equal(report.credits.trading.find(row => row.id === 'b').amount, 0);
  assert.equal(report.credits.contributors, 1);
});
test('currency sums preserve cents; empty average is undefined rather than fabricated zero', () => {
  const source = { ...fixture(), payments: [payment('c1', { amount: '0.10' }), payment('c2', { amount: '0.20' })] };
  assert.equal(buildRevenue(source, filters, now).metrics.gross, 0.3);
  const empty = buildRevenue({ ...source, payments: [] }, filters, now);
  assert.equal(empty.metrics.gross, 0); assert.equal(empty.metrics.average, null);
});

async function serverWithMocks({ authorized = true, failedTable = '', pageLimit = 1000, payments = fixture().payments, serviceRole = true, aggregate = { revenue: 321.45, previousRevenue: 210 } } = {}) {
  const code = await readFile(new URL('../src/lib/revenue/server.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const calls = [];
  const tables = { profiles: fixture().profiles, memberships: fixture().memberships, member_tiers: fixture().tiers, payments, member_weekly_turnover: fixture().turnover };
  const client = role => ({ async rpc(name, args) { calls.push({ role, rpc: name, args }); return { data: aggregate, error: null }; }, from(table) {
    calls.push({ role, table });
    const query = { select(columns) { calls.push({ columns }); return query; }, order() { return query; }, async range(from, to) { return table === failedTable ? { data: null, error: { code: 'test-error' } } : { data: tables[table].slice(from, Math.min(to + 1, from + pageLimit)), error: null }; } };
    return query;
  } });
  const exports = {};
  const context = { exports, process: { env: serviceRole ? { SUPABASE_SERVICE_ROLE_KEY: 'test-only' } : {} }, console: { error() {} }, require(name) {
    if (name === 'server-only') return {};
    if (name === '@/lib/member-operations/server') return { async authorizeInfluencerApi() { calls.push({ auth: true }); if (!authorized) throw new Error('denied'); return { supabase: client('session') }; } };
    if (name === '@/lib/supabase/admin') return { createAdminClient() { calls.push({ privileged: true }); return client('admin'); } };
    if (name === './model') return { buildRevenue: (source, params) => buildRevenue(source, params, now) };
    throw new Error(`Unexpected dependency ${name}`);
  } };
  vm.runInNewContext(output, context);
  return { load: exports.loadRevenue, calls };
}
test('unauthorized requests never construct a privileged client or query any table', async () => {
  const server = await serverWithMocks({ authorized: false });
  await assert.rejects(() => server.load(filters), /denied/);
  assert.deepEqual(server.calls, [{ auth: true }]);
});
test('server loads all pages beyond 1000 and limits privileged reads to the payment projection', async () => {
  const server = await serverWithMocks({ pageLimit: 257, payments: Array.from({ length: 1001 }, (_, i) => payment(`payment-${i}`, { amount: '0.01' })) });
  const result = await server.load(filters);
  assert.equal(result.metrics.payments, 1001); assert.equal(result.metrics.gross, 10.01);
  assert.equal(server.calls[0].auth, true);
  assert.ok(server.calls.filter(call => call.role === 'admin').every(call => call.table === 'payments'));
  assert.ok(server.calls.filter(call => call.columns).every(call => !/stripe_|customer|payload/.test(call.columns)));
});
test('missing service role falls back to the authorized aggregate without exposing transactions', async () => {
  const server = await serverWithMocks({ serviceRole: false });
  const report = await server.load(filters);
  assert.equal(report.paymentDetailsAvailable, false);
  assert.equal(report.paymentSummaryAvailable, true);
  assert.equal(report.metrics.gross, 321.45);
  assert.equal(report.metrics.previousGross, 210);
  assert.equal(report.metrics.payments, null);
  assert.equal(report.transactions.length, 0);
  assert.equal(server.calls.some(call => call.privileged), false);
  assert.equal(server.calls.filter(call => call.rpc === 'get_creator_overview_metrics').length, 1);
});
test('payment load errors fail closed while turnover failure preserves income reporting', async () => {
  const paymentsFailed = await serverWithMocks({ failedTable: 'payments' });
  await assert.rejects(() => paymentsFailed.load(filters));
  const turnoverFailed = await serverWithMocks({ failedTable: 'member_weekly_turnover' });
  const report = await turnoverFailed.load(filters);
  assert.equal(report.metrics.gross, 1010); assert.equal(report.credits.available, false);
});
