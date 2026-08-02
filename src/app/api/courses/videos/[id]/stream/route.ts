import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleDriveDownloadUrl } from "@/lib/video/googleDrive";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: fileId, error } = await supabase.rpc("get_course_video_file_id", { target_video_id: id });
  if (error || !fileId) return NextResponse.json({ error: "This video is locked or unavailable." }, { status: 403 });

  try {
    const range = request.headers.get("range");
    const driveResponse = await fetch(getGoogleDriveDownloadUrl(fileId), {
      cache: "no-store",
      redirect: "follow",
      headers: range ? { Range: range } : undefined,
    });
    if (!driveResponse.ok || !driveResponse.body) {
      return NextResponse.json({ error: "The video source is currently unavailable." }, { status: 502 });
    }

    const headers = new Headers();
    for (const header of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const value = driveResponse.headers.get(header);
      if (value) headers.set(header, value);
    }
    headers.set("Content-Disposition", "inline");
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(driveResponse.body, { status: driveResponse.status, headers });
  } catch {
    return NextResponse.json({ error: "The video source is currently unavailable." }, { status: 502 });
  }
}
