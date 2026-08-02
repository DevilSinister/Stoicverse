import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited, rejectUntrustedOrigin } from "@/lib/security/request";
import { decodeNotificationCursor, encodeNotificationCursor } from "@/lib/notifications/cursor";
import { notificationView, type NotificationItem } from "@/lib/notifications/model";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isRateLimited(`notifications:read:${user.id}`, 120, 60_000)) return NextResponse.json({ error: "Too many notification requests" }, { status: 429 });

  const url = new URL(request.url);
  const view = notificationView(url.searchParams.get("view"));
  const requestedLimit = Number(url.searchParams.get("limit") ?? 30);
  const limit = requestedLimit === 5 ? 5 : 30;
  const rawCursor = url.searchParams.get("cursor");
  const cursor = decodeNotificationCursor(rawCursor);
  if (rawCursor && !cursor) return NextResponse.json({ error: "Invalid notification cursor" }, { status: 400 });

  let query = supabase
    .from("notifications")
    .select("id,type,title,body,action_url,is_read,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (view === "unread") query = query.eq("is_read", false);
  if (view === "mentions") query = query.eq("type", "community_mention");
  if (cursor) {
    query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  }

  const [feedResult, unreadResult] = await Promise.all([
    query,
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false),
  ]);

  if (feedResult.error || unreadResult.error) {
    return NextResponse.json({ error: "Unable to load notifications" }, { status: 500 });
  }

  const rows = (feedResult.data ?? []) as NotificationItem[];
  const hasMore = rows.length > limit;
  const notifications = rows.slice(0, limit);
  const last = notifications.at(-1);
  return NextResponse.json({
    notifications,
    unreadCount: unreadResult.count ?? 0,
    nextCursor: hasMore && last ? encodeNotificationCursor(last) : null,
  });
}

export async function PATCH(request: Request) {
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isRateLimited(`notifications:${user.id}`, 30, 60_000)) return NextResponse.json({ error: "Too many notification updates" }, { status: 429 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body !== "object" || body === null) return NextResponse.json({ error: "Invalid notification update" }, { status: 400 });
  const action = "action" in body ? (body as { action?: unknown }).action : "mark_read";
  const readAt = new Date().toISOString();
  let error: { message: string } | null = null;

  if (action === "mark_all_read") {
    ({ error } = await supabase.from("notifications").update({ is_read: true, read_at: readAt }).eq("user_id", user.id).eq("is_read", false));
  } else if (action === "mark_read") {
    const ids = "ids" in body ? (body as { ids?: unknown }).ids : null;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || !ids.every((id) => typeof id === "string" && uuid.test(id))) return NextResponse.json({ error: "Invalid notification ids" }, { status: 400 });
    ({ error } = await supabase.from("notifications").update({ is_read: true, read_at: readAt }).eq("user_id", user.id).in("id", ids));
  } else {
    return NextResponse.json({ error: "Invalid notification action" }, { status: 400 });
  }
  if (error) return NextResponse.json({ error: "Unable to update notifications" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
