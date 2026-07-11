import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const ids = typeof body === "object" && body !== null && "ids" in body ? (body as { ids?: unknown }).ids : null;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || !ids.every((id) => typeof id === "string" && uuid.test(id))) return NextResponse.json({ error: "Invalid notification ids" }, { status: 400 });
  const { error } = await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("user_id", user.id).in("id", ids);
  if (error) return NextResponse.json({ error: "Unable to update notifications" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
