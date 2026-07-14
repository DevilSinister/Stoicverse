import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { elapsedSeconds?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid progress request." }, { status: 400 }); }
  const elapsed = Number(body.elapsedSeconds);
  if (!Number.isInteger(elapsed) || elapsed < 1 || elapsed > 15) return NextResponse.json({ error: "Elapsed time must be between 1 and 15 seconds." }, { status: 400 });
  const { data, error } = await (await createClient()).rpc("record_course_video_progress", { target_video_id: id, elapsed_seconds: elapsed });
  if (error) return NextResponse.json({ error: error.message || "Unable to record progress." }, { status: 403 });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/courses");
  return NextResponse.json({ progress: data?.[0] ?? null });
}
