import 'server-only';

import { authorizeInfluencerApi } from '@/lib/member-operations/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildRevenue, type RevenueFilters, type RevenueSource } from './model';

const DAY = 86_400_000;

async function readAll(client: Awaited<ReturnType<typeof authorizeInfluencerApi>>['supabase'], table: string, columns: string, order: readonly string[]) {
  const rows: unknown[] = [];
  for (;;) {
    let query = client.from(table).select(columns);
    for (const column of order) query = query.order(column, { ascending: true });
    const { data, error } = await query.range(rows.length, rows.length + 999);
    if (error) { console.error('[creator-revenue]', table, error.code); throw new Error('Revenue records could not be loaded'); }
    if (!data?.length) break;
    rows.push(...data);
    if (rows.length > 100_000) throw new Error('Reporting capacity exceeded');
  }
  return rows;
}

export async function loadRevenue(filters: RevenueFilters) {
  // This gate must run before constructing the privileged payment reader.
  const { supabase } = await authorizeInfluencerApi();
  // Raw payment rows remain inaccessible through the member Data API. This
  // creator-only DAL projects the fields approved for the Revenue report;
  // customer IDs, payment-intent IDs, webhook IDs and payloads are never read.
  const definitions = {
    profiles: ['profiles', 'id,full_name,is_suspended,platform_role', ['id']],
    memberships: ['memberships', 'user_id,status,expires_at', ['user_id']],
    tiers: ['member_tiers', 'user_id,current_tier,is_master', ['user_id']],
    turnover: ['member_weekly_turnover', 'user_id,week_start,amount_usd,updated_at,updated_by', ['user_id', 'week_start']],
  } as const;
  const results = await Promise.allSettled(Object.entries(definitions).map(async ([key, [table, columns, order]]) => [key, await readAll(supabase, table, columns, order)] as const));
  const keys = Object.keys(definitions);
  const entries = results.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    // A turnover failure must never hide working business-payment reporting.
    if (keys[i] === 'turnover') return ['turnover', null] as const;
    throw result.reason;
  });
  let payments: RevenueSource['payments'] = null;
  let paymentAggregate: RevenueSource['paymentAggregate'] = null;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const paymentReader = createAdminClient();
    payments = await readAll(paymentReader as typeof supabase, 'payments', 'id,user_id,product_type,amount,currency,status,source,paid_at,refunded_at,created_at,granted_by,duration_months', ['id']) as RevenueSource['payments'];
  } else {
    const aggregateCompatible = filters.currency === 'usd' && !filters.product && !filters.status && !filters.source && !filters.tier && !filters.membership && !filters.q;
    if (aggregateCompatible) {
      const endExclusive = new Date(Date.parse(`${filters.end}T00:00:00Z`) + DAY).toISOString();
      const { data, error } = await supabase.rpc('get_creator_overview_metrics', {
        period_days: 30,
        creator_timezone: 'UTC',
        metrics_start: `${filters.start}T00:00:00.000Z`,
        metrics_end: endExclusive,
        trends_start: null,
        trends_end: null,
      });
      if (error) console.error('[creator-revenue] aggregate', error.code);
      else if (data && typeof data === 'object' && 'revenue' in data && 'previousRevenue' in data) {
        paymentAggregate = { gross: data.revenue as number | string, previousGross: data.previousRevenue as number | string };
      }
    }
  }
  return buildRevenue({ ...Object.fromEntries(entries), payments, paymentAggregate } as RevenueSource, filters);
}
