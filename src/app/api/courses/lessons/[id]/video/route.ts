import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/security/request";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!uuid.test(id)) return NextResponse.json({ error: "Invalid lesson" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isRateLimited(`lesson-video:${user.id}`, 60, 60_000)) return NextResponse.json({ error: "Too many video requests" }, { status: 429 });

  const { data, error } = await supabase.rpc("get_lesson_video_file_id", { target_lesson_id: id });
  if (error || !data) return NextResponse.json({ error: "This lesson is unavailable." }, { status: 403 });
  return NextResponse.json({ previewUrl: `https://drive.google.com/file/d/${encodeURIComponent(data)}/preview` });
}
