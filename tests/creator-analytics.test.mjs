import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAnalytics, csvText, defaultFilters, parseFilters } from '../src/lib/analytics/model.ts';

const now = new Date('2026-09-08T12:00:00Z');
const filters = defaultFilters(now, 4);
const person = (id, name = id, platform_role = 'member') => ({ id, full_name: name, platform_role, is_suspended: false, created_at: '2026-08-15T00:00:00Z' });
function fixture() {
  return {
    profiles: [person('a', 'Alice'), person('b', 'Bob'), person('c', 'Carol'), person('staff', 'Creator', 'influencer')],
    memberships: [{ user_id: 'a', status: 'active', access_source: 'stripe', expires_at: '2026-09-01', joined_at: '2026-08-15' }, { user_id: 'b', status: 'active', access_source: 'gifted', expires_at: null, joined_at: '2026-07-20' }],
    tiers: [{ user_id: 'b', current_tier: 3, is_master: true }],
    turnover: [
      { user_id: 'a', week_start: '2026-08-10', amount_usd: '0.10', updated_at: '2026-08-10' },
      { user_id: 'a', week_start: '2026-08-17', amount_usd: '0.20', updated_at: '2026-08-17' },
      { user_id: 'b', week_start: '2026-08-24', amount_usd: '0', updated_at: '2026-08-24' },
      { user_id: 'a', week_start: '2026-08-03', amount_usd: '10', updated_at: '2026-08-03' },
      { user_id: 'a', week_start: '2026-09-07', amount_usd: '500', updated_at: '2026-09-07' },
      { user_id: 'staff', week_start: '2026-08-10', amount_usd: '1000', updated_at: '2026-08-10' },
    ],
    courses: [{ id: 'course', title: 'Foundations', status: 'published' }],
    videos: [{ id: 'v1', course_id: 'course', title: 'One', sort_order: 0 }, { id: 'v2', course_id: 'course', title: 'Two', sort_order: 1 }],
    enrollments: [{ user_id: 'a', course_id: 'course', enrolled_at: '2026-08-12', first_completed_at: '2026-08-20', completion_current: false }, { user_id: 'b', course_id: 'course', enrolled_at: '2026-08-12', first_completed_at: null, completion_current: false }],
    progress: ['v1', 'v2'].map(video_id => ({ user_id: 'a', video_id, watched_seconds: 1800, is_completed: true, first_started_at: '2026-07-01', last_watched_at: '2026-09-07', completed_at: '2026-08-20' })),
    events: [{ id: 'e1', title: 'Event one', host_name: 'Team', starts_at: '2026-10-01', status: 'upcoming' }, { id: 'e2', title: 'Event two', host_name: 'Team', starts_at: '2026-08-15', status: 'completed' }, { id: 'cancelled', title: 'Cancelled', host_name: 'Team', starts_at: '2026-08-15', status: 'cancelled' }],
    eventEnrollments: [{ id: '1', user_id: 'a', event_id: 'e1', enrolled_at: '2026-08-20' }, { id: '2', user_id: 'a', event_id: 'e2', enrolled_at: '2026-08-20' }, { id: '3', user_id: 'b', event_id: 'cancelled', enrolled_at: '2026-08-20' }],
  };
}

test('completed UTC weeks and equally sized comparison cross month boundaries', () => {
  assert.equal(filters.start, '2026-08-10'); assert.equal(filters.end, '2026-09-06');
  const r = buildAnalytics(fixture(), filters, now);
  assert.deepEqual(r.previous, { start: '2026-07-13', end: '2026-08-09' });
  assert.equal(r.trends.length, 4);
  assert.equal(r.metrics.turnover, 0.3); assert.equal(r.metrics.previousTurnover, 10);
  assert.equal(r.trading[0].lifetime, 510.3);
});
test('reject invalid dates, partial weeks, future dates, excessive ranges and filters', () => {
  for (const patch of [{ start: '2026-02-30' }, { start: '2026-08-11' }, { end: '2026-09-13' }, { start: '2025-01-06' }, { tier: '6' }, { status: 'unknown' }]) assert.throws(() => parseFilters(new URLSearchParams({ ...filters, ...patch }), now));
  assert.deepEqual(parseFilters(new URLSearchParams(filters), now), filters);
  assert.throws(() => parseFilters(new URLSearchParams(filters), new Date('2026-09-06T23:59:59Z')));
  assert.deepEqual(parseFilters(new URLSearchParams(filters), new Date('2026-09-07T00:00:00Z')), filters);
});
test('zero turnover is recorded; missing entry is different; staff excluded', () => {
  const r = buildAnalytics(fixture(), filters, now);
  assert.equal(r.metrics.members, 3); assert.equal(r.metrics.missingMembers, 1);
  assert.equal(r.trading.find(t => t.id === 'b').recordedWeeks, 1);
  assert.equal(r.metrics.contributors, 1); assert.equal(r.metrics.median, 0.3);
});
test('member filters scope every source and derive expiry and Master tier correctly', () => {
  const r = buildAnalytics(fixture(), { ...filters, status: 'expired', source: 'stripe', q: 'Alice' }, now);
  assert.equal(r.metrics.members, 1); assert.equal(r.metrics.eventEnrollments, 2);
  const master = buildAnalytics(fixture(), { ...filters, tier: '5' }, now);
  assert.equal(master.metrics.members, 1); assert.equal(master.courses[0].viewers, 0);
  assert.equal(master.metrics.turnover, 0);
});
test('unique viewers are deduplicated and cohort completion differs from first completions', () => {
  const r = buildAnalytics(fixture(), filters, now);
  assert.equal(r.courses[0].viewers, 1); assert.equal(r.courses[0].hours, 1);
  assert.equal(r.courses[0].completions, 1); assert.equal(r.courses[0].cohortRate, 0);
  assert.equal(r.learners[0].lessons, 2);
});
test('events use enrolment dates and exclude cancelled events; repeat users are distinct', () => {
  const r = buildAnalytics(fixture(), filters, now);
  assert.equal(r.metrics.eventEnrollments, 2); assert.equal(r.metrics.uniqueEnrollees, 1);
  assert.equal(r.metrics.repeatEnrollees, 1); assert.equal(r.events.length, 2);
  assert.equal(r.events.find(e => e.id === 'e1').enrollments, 1);
});
test('empty reports have defined zero totals, null denominators and complete empty weeks', () => {
  const r = buildAnalytics({ ...fixture(), profiles: [] }, filters, now);
  assert.equal(r.metrics.turnover, 0); assert.equal(r.metrics.median, 0);
  assert.equal(r.courses[0].cohortRate, null); assert.equal(r.trends.length, 4);
});
test('CSV quotes commas and quotes, neutralizes spreadsheet formulas and preserves numeric negatives', () => {
  const csv = csvText(['Name', 'Amount'], [['=CMD()', -5], ['A,"B"', null], [' \t+SUM(1)', 1]]);
  assert.ok(csv.includes('"\'=CMD()","-5"'));
  assert.ok(csv.includes('"A,""B""",""'));
  assert.ok(csv.includes('"\' \t+SUM(1)"'));
});
