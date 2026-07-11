import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: membership, error: membershipError } = await supabase.from("memberships").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (membershipError || !membership) return NextResponse.json({ error: "Membership required" }, { status: 403 });
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 80) return NextResponse.json({ error: "Search query must be 2–80 characters" }, { status: 400 });
  const escaped = query.replace(/[,%()]/g, " ");
  const pattern = `%${escaped}%`;
  const now = new Date().toISOString();
  const [lessons, events] = await Promise.all([
    supabase.from("lessons").select("id, title, description").eq("status", "published").or(`title.ilike.${pattern},description.ilike.${pattern}`).or(`release_at.is.null,release_at.lte.${now}`).limit(8),
    supabase.from("events").select("id, title, description").in("status", ["upcoming", "live"]).gte("starts_at", now).or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(8),
  ]);
  if (lessons.error || events.error) return NextResponse.json({ error: "Search unavailable" }, { status: 500 });
  return NextResponse.json({ results: [...(lessons.data ?? []).map((item) => ({ ...item, href: `/courses/lesson/${item.id}`, kind: "lesson" as const })), ...(events.data ?? []).map((item) => ({ ...item, href: "/events", kind: "event" as const }))] });
}
