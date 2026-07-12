import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isRateLimited, rejectUntrustedOrigin } from "@/lib/security/request";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;
  const { id } = await context.params;
  if (!uuid.test(id)) return NextResponse.json({ error: "Invalid lesson" }, { status: 400 });

  let body: { elapsedSeconds?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid progress request" }, { status: 400 }); }
  const elapsedSeconds = body.elapsedSeconds;
  if (typeof elapsedSeconds !== "number" || !Number.isInteger(elapsedSeconds) || elapsedSeconds < 1 || elapsedSeconds > 15) return NextResponse.json({ error: "Invalid elapsed watch time" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isRateLimited(`lesson-progress:${user.id}:${id}`, 8, 60_000)) return NextResponse.json({ error: "Progress is being recorded too quickly" }, { status: 429 });

  const { data, error } = await supabase.rpc("record_lesson_progress", { target_lesson_id: id, elapsed_seconds: elapsedSeconds });
  if (error) return NextResponse.json({ error: "Unable to record progress" }, { status: 403 });
  return NextResponse.json({ progress: data?.[0] ?? null });
}
