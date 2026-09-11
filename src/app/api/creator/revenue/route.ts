import { NextResponse } from 'next/server';
import { parseRevenueFilters } from '@/lib/revenue/model';
import { loadRevenue } from '@/lib/revenue/server';
import { MemberDirectoryError } from '@/lib/member-operations/server';

const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  let filters;
  try { filters = parseRevenueFilters(new URL(request.url).searchParams); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid filters' }, { status: 400, headers }); }
  try { return NextResponse.json(await loadRevenue(filters), { headers }); }
  catch (error) {
    const status = error instanceof MemberDirectoryError ? error.status : 503;
    return NextResponse.json({ error: status === 401 ? 'Your session has expired. Sign in again.' : status === 403 ? 'Creator access is required.' : 'Revenue could not load all payment records. Retry or contact your administrator.' }, { status, headers });
  }
}
