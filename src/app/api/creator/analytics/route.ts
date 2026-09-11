import { NextResponse } from 'next/server';
import { parseFilters } from '@/lib/analytics/model';
import { loadAnalytics } from '@/lib/analytics/server';
import { MemberDirectoryError } from '@/lib/member-operations/server';

export async function GET(request: Request) {
  let filters;
  try { filters = parseFilters(new URL(request.url).searchParams); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid filters' }, { status: 400 }); }
  try {
    const report = await loadAnalytics(filters);
    return NextResponse.json(report, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const status = error instanceof MemberDirectoryError ? error.status : 503;
    return NextResponse.json({ error: status === 401 ? 'Your session has expired. Sign in again.' : status === 403 ? 'Creator access is required.' : 'Analytics could not load all records. Please retry or contact your administrator.' }, { status, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
