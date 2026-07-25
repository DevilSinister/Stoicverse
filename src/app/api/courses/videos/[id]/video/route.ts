import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getGoogleDriveDurationSeconds } from "@/lib/video/googleDrive";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await (await createClient()).rpc("get_course_video_file_id", { target_video_id: id });
  if (error || !data) return NextResponse.json({ error: "This video is locked or unavailable." }, { status: 403 });
  return NextResponse.json({ streamUrl: `/api/courses/videos/${encodeURIComponent(id)}/stream` });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: fileId, error } = await (await createClient()).rpc("get_course_video_file_id", { target_video_id: id });
  if (error || !fileId) return NextResponse.json({ error: "This video is locked or unavailable." }, { status: 403 });
  const payload = await request.json().catch(() => ({})) as { durationSeconds?: unknown };
  const browserDuration = typeof payload.durationSeconds === "number" && Number.isInteger(payload.durationSeconds) && payload.durationSeconds > 0 && payload.durationSeconds <= 86_400
    ? payload.durationSeconds
    : null;
  const durationSeconds = browserDuration ?? await getGoogleDriveDurationSeconds(fileId);
  if (!durationSeconds) return NextResponse.json({ durationSeconds: null });
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient();
    const { data: video } = await admin.from("course_videos").select("duration_seconds").eq("id", id).maybeSingle();
    if (video?.duration_seconds !== durationSeconds) {
      await admin.from("course_videos").update({ duration_seconds: durationSeconds }).eq("id", id);
      const { data: history } = await admin.from("course_video_progress").select("user_id, watched_seconds").eq("video_id", id);
      await Promise.all((history ?? []).map((entry) => {
        const watchedSeconds = Math.min(Number(entry.watched_seconds) || 0, durationSeconds);
        const completionPercentage = Math.round((watchedSeconds / durationSeconds) * 10_000) / 100;
        return admin.from("course_video_progress").update({
          watched_seconds: watchedSeconds,
          completion_percentage: completionPercentage,
          is_completed: completionPercentage >= 80,
          completed_at: completionPercentage >= 80 ? new Date().toISOString() : null,
        }).eq("video_id", id).eq("user_id", entry.user_id);
      }));
    }
  }
  return NextResponse.json({ durationSeconds });
}
