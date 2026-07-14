import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await (await createClient()).rpc("get_course_video_file_id", { target_video_id: id });
  if (error || !data) return NextResponse.json({ error: "This video is locked or unavailable." }, { status: 403 });
  return NextResponse.json({ streamUrl: `/api/courses/videos/${encodeURIComponent(id)}/stream` });
}
