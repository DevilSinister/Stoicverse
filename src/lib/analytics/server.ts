import 'server-only';

import { authorizeInfluencerApi } from '@/lib/member-operations/server';
import { buildAnalytics, type AnalyticsFilters, type AnalyticsSource } from './model';

// Reuse session-bound RLS. No service-role key or protected assets are involved.
export async function loadAnalytics(filters: AnalyticsFilters) {
  const { supabase } = await authorizeInfluencerApi();
  const definitions = {
    profiles: ['profiles', 'id,full_name,platform_role,is_suspended,created_at', ['id']],
    memberships: ['memberships', 'user_id,status,access_source,expires_at,joined_at', ['user_id']],
    tiers: ['member_tiers', 'user_id,current_tier,is_master', ['user_id']],
    turnover: ['member_weekly_turnover', 'user_id,week_start,amount_usd,updated_at', ['user_id', 'week_start']],
    courses: ['courses', 'id,title,status', ['id']],
    videos: ['course_videos', 'id,course_id,title,sort_order', ['id']],
    enrollments: ['course_enrollments', 'user_id,course_id,enrolled_at,first_completed_at,completion_current', ['user_id', 'course_id']],
    progress: ['course_video_progress', 'user_id,video_id,watched_seconds,is_completed,first_started_at,last_watched_at,completed_at', ['user_id', 'video_id']],
    events: ['events', 'id,title,host_name,starts_at,status', ['id']],
    eventEnrollments: ['event_enrollments', 'id,user_id,event_id,enrolled_at', ['id']],
  } as const;
  const results = await Promise.allSettled(Object.entries(definitions).map(async ([key, [table, columns, order]]) => {
    const rows: unknown[] = [];
    // Fetch every page, including when the server's configured row limit is < 1000.
    // Refuse oversized reports instead of silently returning misleading totals.
    for (;;) {
      let query = supabase.from(table).select(columns);
      for (const column of order) query = query.order(column, { ascending: true });
      const { data, error } = await query.range(rows.length, rows.length + 999);
      if (error) { console.error('[creator-analytics]', table, error.code); throw new Error('Analytics could not load all records. Please retry.'); }
      if (!data?.length) break;
      rows.push(...data);
      if (rows.length > 100_000) throw new Error('This report exceeds the current reporting capacity. Contact the platform administrator.');
    }
    return [key, rows] as const;
  }));
  const failure = results.find(result => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  const source = Object.fromEntries(results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])) as AnalyticsSource;
  return buildAnalytics(source, filters);
}
