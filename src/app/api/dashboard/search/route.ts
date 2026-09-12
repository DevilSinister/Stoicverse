import { NextResponse } from "next/server";

import { normalizeSearchBase, withRouteBase } from "@/lib/navigation/paths";
import { createClient } from "@/lib/supabase/server";

type SearchKind = "course" | "video" | "lesson" | "event" | "post" | "channel" | "member";
type SearchResult = { id: string; title: string; description: string | null; href: string; kind: SearchKind };
type DirectoryRow = { channel_id: string; channel_name: string; channel_description: string | null; unlock_tier: number | null; is_locked: boolean };
type MemberRow = { id: string; full_name: string | null; platform_role: string };
type Embedded<T> = T | T[] | null;
type CourseRow = { id: string; title: string; description: string | null };
type CourseVideoRow = { id: string; course_id: string; title: string; description: string | null; courses: Embedded<{ title: string }> };

const roleName = (role: string) => role.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const firstOf = <T>(value: Embedded<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value);
const snippet = (value: string | null, limit = 120) => {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
};

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
  // Strip PostgREST filter delimiters plus the LIKE wildcards and escape character, so a
  // query can neither break out of the `or=()` list nor smuggle in its own pattern.
  const escaped = query.replace(/[\\%_,()]/g, " ");
  const needle = escaped.trim().toLowerCase();
  // A query of nothing but stripped characters ("%%", "()") survives the length check but
  // carries no term, and an empty needle would match every channel. Answer it as a miss.
  if (needle.length < 2) return NextResponse.json({ results: [] });
  const pattern = `%${escaped}%`;
  const now = new Date().toISOString();
  // Members search is creator-only: the profiles RLS policy exposes other people's rows
  // to staff alone, and /creator/members is the one page that can receive the click.
  const canSearchMembers = isStaff && base === "/creator";
  // One community surface since phase 9: the creator and the member both read
  // `/channels`, and the permissions resolver decides what each may do there.
  const communityHref = "/channels";

  const [courses, videos, lessons, events, posts, directory, members] = await Promise.all([
    // Course and video RLS policies only expose published, released curriculum the caller
    // can open. Keeping these queries on the member client preserves those access rules.
    supabase.from("courses").select("id, title, description").eq("status", "published").or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(8),
    supabase.from("course_videos").select("id, course_id, title, description, courses!course_videos_course_id_fkey(title)").or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(8),
    supabase.from("lessons").select("id, title, description").eq("status", "published").or(`title.ilike.${pattern},description.ilike.${pattern}`).or(`release_at.is.null,release_at.lte.${now}`).limit(8),
    supabase.from("events").select("id, title, description").in("status", ["upcoming", "live"]).gte("starts_at", now).or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(8),
    // `posts_read` restricts this to channels the caller can actually view, so tier-gated
    // discussion never leaks through search — no channel filter is needed here.
    supabase.from("posts").select("id, body, channel_id, created_at, channels!posts_channel_id_fkey(name), profiles!posts_author_id_fkey(full_name)").eq("is_deleted", false).ilike("body", pattern).order("created_at", { ascending: false }).limit(8),
    // The directory RPC applies the same locked/hidden disclosure rules as the sidebar, so
    // matching in memory here reveals nothing the channel list does not already show.
    supabase.rpc("community_channel_directory"),
    canSearchMembers
      ? supabase.from("profiles").select("id, full_name, platform_role").eq("is_suspended", false).ilike("full_name", pattern).limit(6)
      : Promise.resolve({ data: [] as MemberRow[], error: null }),
  ]);

  if (courses.error || videos.error || lessons.error || events.error || posts.error || directory.error || members.error) return NextResponse.json({ error: "Search unavailable" }, { status: 500 });

  const channels = ((directory.data ?? []) as DirectoryRow[])
    .filter((row) => row.channel_name.toLowerCase().includes(needle) || (row.channel_description ?? "").toLowerCase().includes(needle))
    .slice(0, 6);

  const results: SearchResult[] = [
    ...((courses.data ?? []) as CourseRow[]).map((item) => ({ id: item.id, title: item.title, description: snippet(item.description), href: withRouteBase(base, `/courses/${item.id}`), kind: "course" as const })),
    ...((videos.data ?? []) as CourseVideoRow[]).map((item) => {
      const course = firstOf(item.courses);
      return { id: item.id, title: item.title, description: course ? `Video in ${course.title}` : snippet(item.description), href: withRouteBase(base, `/courses/${item.course_id}/video/${item.id}`), kind: "video" as const };
    }),
    ...(lessons.data ?? []).map((item) => ({ id: item.id, title: item.title, description: snippet(item.description), href: withRouteBase(base, `/courses/lesson/${item.id}`), kind: "lesson" as const })),
    ...(events.data ?? []).map((item) => ({ id: item.id, title: item.title, description: snippet(item.description), href: withRouteBase(base, "/events"), kind: "event" as const })),
    ...(posts.data ?? []).map((item) => {
      const channel = firstOf(item.channels as Embedded<{ name: string }>);
      const author = firstOf(item.profiles as Embedded<{ full_name: string | null }>);
      const context = [channel ? `#${channel.name}` : null, author?.full_name?.trim() || "Community staff"].filter(Boolean).join(" · ");
      return { id: item.id, title: snippet(item.body, 90) ?? "Attachment", description: context, href: `${communityHref}/${item.channel_id}`, kind: "post" as const };
    }),
    // A locked channel links to the community root rather than deep-linking into a channel
    // the member cannot open; the tier hint is the upsell.
    ...channels.map((row) => ({ id: row.channel_id, title: `#${row.channel_name}`, description: row.is_locked && row.unlock_tier ? `Unlocks at tier ${row.unlock_tier}` : snippet(row.channel_description), href: row.is_locked ? communityHref : `${communityHref}/${row.channel_id}`, kind: "channel" as const })),
    ...((members.data ?? []) as MemberRow[]).map((item) => ({ id: item.id, title: item.full_name?.trim() || "Member", description: roleName(item.platform_role), href: "/creator/members", kind: "member" as const })),
  ];

  return NextResponse.json({ results });
}
