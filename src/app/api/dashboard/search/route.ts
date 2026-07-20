import { NextResponse } from "next/server";

import { normalizeSearchBase, withRouteBase } from "@/lib/navigation/paths";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const searchParams = new URL(request.url).searchParams;
  const base = normalizeSearchBase(searchParams.get("base"));
  const [{ data: membership, error: membershipError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from("memberships").select("id, expires_at").eq("user_id", user.id).eq("status", "active").maybeSingle(),
    supabase.from("profiles").select("platform_role, is_suspended").eq("id", user.id).maybeSingle(),
  ]);
  const isStaff = ["moderator", "influencer", "super_admin"].includes(profile?.platform_role ?? "") && !profile?.is_suspended;
  const hasActiveMembership = Boolean(membership) && (!membership?.expires_at || new Date(membership.expires_at) > new Date());
  if (membershipError || profileError || (!hasActiveMembership && !isStaff)) return NextResponse.json({ error: "Membership required" }, { status: 403 });
  const query = searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 80) return NextResponse.json({ error: "Search query must be 2–80 characters" }, { status: 400 });
  const escaped = query.replace(/[,%()]/g, " ");
  const pattern = `%${escaped}%`;
  const now = new Date().toISOString();
  const [lessons, events] = await Promise.all([
    supabase.from("lessons").select("id, title, description").eq("status", "published").or(`title.ilike.${pattern},description.ilike.${pattern}`).or(`release_at.is.null,release_at.lte.${now}`).limit(8),
    supabase.from("events").select("id, title, description").in("status", ["upcoming", "live"]).gte("starts_at", now).or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(8),
  ]);
  if (lessons.error || events.error) return NextResponse.json({ error: "Search unavailable" }, { status: 500 });
  return NextResponse.json({ results: [...(lessons.data ?? []).map((item) => ({ ...item, href: withRouteBase(base, `/courses/lesson/${item.id}`), kind: "lesson" as const })), ...(events.data ?? []).map((item) => ({ ...item, href: withRouteBase(base, "/events"), kind: "event" as const }))] });
}
