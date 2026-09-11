export type Profile = { id: string; full_name: string | null; platform_role: string; is_suspended: boolean; created_at: string };
export type Membership = { user_id: string; status: string; access_source: string; expires_at: string | null; joined_at: string | null };
export type Tier = { user_id: string; current_tier: number; is_master: boolean };
export type Turnover = { user_id: string; week_start: string; amount_usd: number | string; updated_at: string };
export type Course = { id: string; title: string; status: string };
export type Video = { id: string; course_id: string; title: string; sort_order: number };
export type Enrollment = { user_id: string; course_id: string; enrolled_at: string; first_completed_at: string | null; completion_current: boolean };
export type Progress = { user_id: string; video_id: string; watched_seconds: number; is_completed: boolean; first_started_at: string | null; last_watched_at: string | null; completed_at: string | null };
export type Event = { id: string; title: string; host_name: string; starts_at: string; status: string };
export type EventEnrollment = { id: string; user_id: string; event_id: string; enrolled_at: string };
export type AnalyticsSource = { profiles: Profile[]; memberships: Membership[]; tiers: Tier[]; turnover: Turnover[]; courses: Course[]; videos: Video[]; enrollments: Enrollment[]; progress: Progress[]; events: Event[]; eventEnrollments: EventEnrollment[] };
export type AnalyticsFilters = { start: string; end: string; tier: string; status: string; source: string; q: string };
const DAY = 86_400_000;
export const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function defaultFilters(now = new Date(), weeks = 4): AnalyticsFilters {
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  return { start: isoDate(new Date(+monday - weeks * 7 * DAY)), end: isoDate(new Date(+monday - DAY)), tier: "", status: "", source: "", q: "" };
}

export function parseFilters(params: URLSearchParams, now = new Date()): AnalyticsFilters {
  const defaults = defaultFilters(now);
  const result = Object.fromEntries(Object.keys(defaults).map(key => [key, params.get(key) ?? defaults[key as keyof AnalyticsFilters]])) as AnalyticsFilters;
  const start = new Date(`${result.start}T00:00:00Z`), end = new Date(`${result.end}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.start) || !/^\d{4}-\d{2}-\d{2}$/.test(result.end) || !Number.isFinite(+start) || !Number.isFinite(+end) || isoDate(start) !== result.start || isoDate(end) !== result.end || start.getUTCDay() !== 1 || end.getUTCDay() !== 0 || +end < +start || +end - +start >= 366 * DAY || +end + DAY > +now) throw new Error("Choose a Monday through Sunday range of up to 52 completed weeks.");
  if (!['', '1', '2', '3', '4', '5'].includes(result.tier) || !['', 'active', 'expired', 'pending', 'suspended', 'cancelled', 'refunded'].includes(result.status) || !['', 'stripe', 'gifted'].includes(result.source) || result.q.length > 100) throw new Error("Invalid member filters.");
  return { ...result, q: result.q.trim() };
}

export function buildAnalytics(source: AnalyticsSource, filters: AnalyticsFilters, now = new Date()) {
  const start = Date.parse(`${filters.start}T00:00:00Z`), end = Date.parse(`${filters.end}T00:00:00Z`) + DAY;
  const duration = end - start;
  const within = (value: string | null, previous = false) => !!value && Date.parse(value) >= start - (previous ? duration : 0) && Date.parse(value) < end - (previous ? duration : 0);
  const memberships = new Map(source.memberships.map(row => [row.user_id, row]));
  const tiers = new Map(source.tiers.map(row => [row.user_id, row]));
  const members = source.profiles.filter(p => ['member', 'moderator'].includes(p.platform_role)).map(p => {
    const membership = memberships.get(p.id);
    const status = p.is_suspended ? 'suspended' : membership?.status === 'active' && membership.expires_at && Date.parse(membership.expires_at) <= +now ? 'expired' : membership?.status ?? 'pending';
    return { id: p.id, name: p.full_name?.trim() || 'Unnamed member', tier: tiers.get(p.id)?.is_master ? 5 : tiers.get(p.id)?.current_tier ?? 1, status, source: membership?.access_source ?? '', joined: membership?.joined_at ?? p.created_at };
  }).filter(m => (!filters.tier || m.tier === Number(filters.tier)) && (!filters.status || m.status === filters.status) && (!filters.source || m.source === filters.source) && (!filters.q || m.name.toLowerCase().includes(filters.q.toLowerCase()) || m.id.toLowerCase() === filters.q.toLowerCase()));
  const memberIds = new Set(members.map(m => m.id));
  const turnover = source.turnover.filter(t => memberIds.has(t.user_id));
  const progress = source.progress.filter(p => memberIds.has(p.user_id));
  const enrollments = source.enrollments.filter(e => memberIds.has(e.user_id));
  const eventIds = new Set(source.events.filter(e => e.status !== 'cancelled' && e.status !== 'draft').map(e => e.id));
  const eventEnrollments = source.eventEnrollments.filter(e => memberIds.has(e.user_id) && eventIds.has(e.event_id));
  const cents = (rows: Turnover[]) => rows.reduce((sum, row) => sum + Math.round(Number(row.amount_usd) * 100), 0) / 100;
  const currentTurnover = turnover.filter(t => within(t.week_start)), previousTurnover = turnover.filter(t => within(t.week_start, true));
  const total = cents(currentTurnover);
  const turnoverByMember = Map.groupBy(turnover, row => row.user_id);
  const trading = members.map(m => {
    const rows = turnoverByMember.get(m.id) ?? [], selected = rows.filter(t => within(t.week_start));
    const amount = cents(selected);
    return { ...m, amount, previous: cents(rows.filter(t => within(t.week_start, true))), lifetime: cents(rows), recordedWeeks: selected.length, share: total ? amount / total * 100 : 0, updated: rows.reduce((latest, row) => row.updated_at > latest ? row.updated_at : latest, '') };
  }).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const positive = trading.filter(t => t.amount > 0).map(t => t.amount).sort((a, b) => a - b);
  const median = !positive.length ? 0 : positive.length % 2 ? positive[Math.floor(positive.length / 2)] : (positive[positive.length / 2 - 1] + positive[positive.length / 2]) / 2;
  const videoMap = new Map(source.videos.map(v => [v.id, v]));
  const progressByCourse = Map.groupBy(progress, p => videoMap.get(p.video_id)?.course_id ?? '');
  const enrollmentsByCourse = Map.groupBy(enrollments, e => e.course_id);
  const courses = source.courses.map(course => {
    const rows = progressByCourse.get(course.id) ?? [], enrolled = enrollmentsByCourse.get(course.id) ?? [];
    const cohort = enrolled.filter(e => within(e.enrolled_at));
    const viewers = new Set(rows.filter(p => p.watched_seconds > 0).map(p => p.user_id)).size;
    return { ...course, viewers, hours: rows.reduce((n, p) => n + p.watched_seconds, 0) / 3600, enrollments: cohort.length, completions: enrolled.filter(e => within(e.first_completed_at)).length, cohortCompleted: cohort.filter(e => e.completion_current).length, cohortRate: cohort.length ? cohort.filter(e => e.completion_current).length / cohort.length * 100 : null,
      lessons: source.videos.filter(v => v.course_id === course.id).sort((a, b) => a.sort_order - b.sort_order).map(v => { const watched = rows.filter(p => p.video_id === v.id); return { id: v.id, title: v.title, viewers: watched.filter(p => p.watched_seconds > 0).length, completed: watched.filter(p => p.is_completed).length }; }) };
  }).sort((a, b) => b.viewers - a.viewers || a.title.localeCompare(b.title));
  const progressByMember = Map.groupBy(progress, p => p.user_id), enrollmentsByMember = Map.groupBy(enrollments, e => e.user_id);
  const learners = members.map(m => {
    const rows = progressByMember.get(m.id) ?? [], enrolled = enrollmentsByMember.get(m.id) ?? [];
    return { ...m, courses: enrolled.filter(e => within(e.first_completed_at)).length, lessons: rows.filter(p => within(p.completed_at)).length, hours: rows.reduce((n, p) => n + p.watched_seconds, 0) / 3600, lastWatched: rows.reduce((latest, row) => (row.last_watched_at ?? '') > latest ? row.last_watched_at! : latest, '') };
  }).filter(m => m.hours > 0 || m.courses > 0 || m.lessons > 0).sort((a, b) => b.courses - a.courses || b.lessons - a.lessons || a.name.localeCompare(b.name));
  const events = source.events.filter(e => eventIds.has(e.id)).map(event => {
    const rows = eventEnrollments.filter(e => e.event_id === event.id);
    return { ...event, enrollments: rows.filter(e => within(e.enrolled_at)).length, previous: rows.filter(e => within(e.enrolled_at, true)).length, lifetime: rows.length };
  }).sort((a, b) => b.enrollments - a.enrollments || a.title.localeCompare(b.title));
  const selectedEvents = eventEnrollments.filter(e => within(e.enrolled_at));
  const eventCounts = Map.groupBy(selectedEvents, e => e.user_id);
  const trends = [];
  for (let time = start; time < end; time += 7 * DAY) {
    const date = isoDate(new Date(time)), weekEnd = time + 7 * DAY;
    const inWeek = (value: string | null) => !!value && Date.parse(value) >= time && Date.parse(value) < weekEnd;
    trends.push({ date, turnover: cents(currentTurnover.filter(t => t.week_start === date)), newMembers: members.filter(m => inWeek(m.joined)).length, completions: enrollments.filter(e => inWeek(e.first_completed_at)).length, enrollments: selectedEvents.filter(e => inWeek(e.enrolled_at)).length });
  }
  return { filters, generatedAt: now.toISOString(), previous: { start: isoDate(new Date(start - duration)), end: isoDate(new Date(start - DAY)) },
    metrics: { members: members.length, activeMemberships: members.filter(m => m.status === 'active').length, newMembers: members.filter(m => within(m.joined)).length, previousNewMembers: members.filter(m => within(m.joined, true)).length, turnover: total, previousTurnover: cents(previousTurnover), contributors: positive.length, median, missingMembers: trading.filter(m => !m.recordedWeeks).length, completions: enrollments.filter(e => within(e.first_completed_at)).length, previousCompletions: enrollments.filter(e => within(e.first_completed_at, true)).length, eventEnrollments: selectedEvents.length, previousEventEnrollments: eventEnrollments.filter(e => within(e.enrolled_at, true)).length, uniqueEnrollees: eventCounts.size, repeatEnrollees: [...eventCounts.values()].filter(rows => rows.length > 1).length, lifetimeViewers: new Set(progress.filter(p => p.watched_seconds > 0).map(p => p.user_id)).size },
    tiers: [1, 2, 3, 4, 5].map(tier => ({ tier, count: members.filter(m => m.tier === tier).length })), trends, trading, courses, learners, events };
}

export type AnalyticsReport = ReturnType<typeof buildAnalytics>;

export function csvText(headers: string[], rows: (string | number | null)[][]) {
  const cell = (value: string | number | null) => {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
}
