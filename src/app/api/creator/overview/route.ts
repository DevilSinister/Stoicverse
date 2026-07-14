import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const PERIODS = new Set([7, 30, 90]);

export async function GET(request: NextRequest) {
  const periodParam = request.nextUrl.searchParams.get("period");
  const periodDays = periodParam ? Number(periodParam) : 30;
  const timezone = request.nextUrl.searchParams.get("timezone") ?? "UTC";
  
  const metricsStart = request.nextUrl.searchParams.get("metricsStart");
  const metricsEnd = request.nextUrl.searchParams.get("metricsEnd");
  const trendsStart = request.nextUrl.searchParams.get("trendsStart");
  const trendsEnd = request.nextUrl.searchParams.get("trendsEnd");

  const isCustomRange = !!(metricsStart && metricsEnd);
  if ((!isCustomRange && !PERIODS.has(periodDays)) || timezone.length > 64) {
    return NextResponse.json({ error: "Invalid overview request." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: profile, error: profileError } = await supabase.from("profiles").select("platform_role, is_suspended").eq("id", user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: "Unable to authorize overview access." }, { status: 500 });
  if (profile?.is_suspended || !["influencer", "super_admin"].includes(profile?.platform_role ?? "")) return NextResponse.json({ error: "Creator overview access is required." }, { status: 403 });

  const [overview, attention] = await Promise.all([
    supabase.rpc("get_creator_overview_metrics", {
      period_days: periodDays,
      creator_timezone: timezone,
      metrics_start: metricsStart || null,
      metrics_end: metricsEnd || null,
      trends_start: trendsStart || null,
      trends_end: trendsEnd || null,
    }),
    supabase.rpc("get_creator_event_attention"),
  ]);

  if (overview.error || attention.error) {
    const error = overview.error ?? attention.error!;
    console.error("Creator overview query failed:", error.code, error.message);
    if (["PGRST202", "42883"].includes(error.code ?? "")) {
      return NextResponse.json({ error: "Creator overview is still being provisioned. Apply the latest Supabase migration, then refresh this page." }, { status: 503 });
    }
    return NextResponse.json({ error: "Unable to load creator overview." }, { status: error.code === "22023" ? 400 : error.code === "42501" ? 403 : 500 });
  }

  const data = { ...(overview.data as Record<string, unknown>), attention: { ...((overview.data as { attention?: object })?.attention ?? {}), draftEventCount: attention.data ?? 0 } };
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}

