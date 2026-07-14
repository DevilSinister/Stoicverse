const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{10,200}$/;

export function getGoogleDriveDownloadUrl(fileId: string) {
  if (!DRIVE_FILE_ID.test(fileId)) throw new Error("Invalid Google Drive file ID.");
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
}

/**
 * Resolve the duration server-side while the creator saves a public Drive video.
 * The API-key route is the most reliable when configured; the viewer page is a
 * keyless fallback for files shared with "Anyone with the link".
 */
export async function getGoogleDriveDurationSeconds(fileId: string) {
  if (!DRIVE_FILE_ID.test(fileId)) return null;

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  const sources = apiKey
    ? [`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=videoMediaMetadata(durationMillis)&key=${encodeURIComponent(apiKey)}`]
    : [
        `https://drive.google.com/get_video_info?docid=${encodeURIComponent(fileId)}`,
        `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`,
        `https://drive.google.com/open?id=${encodeURIComponent(fileId)}`,
      ];

  for (const source of sources) {
    try {
      const response = await fetch(source, {
        cache: "no-store",
        headers: { "User-Agent": "Stoicverse course publisher" },
      });
      if (!response.ok) continue;
      const body = await response.text();

      // get_video_info is URL-encoded and exposes the playable length directly.
      // This is the most useful unauthenticated fallback for public Drive videos.
      if (source.includes("get_video_info")) {
        const seconds = Number(new URLSearchParams(body).get("length_seconds"));
        if (Number.isInteger(seconds) && seconds > 0 && seconds <= 86_400) return seconds;
      }

      const matches = [
        body.match(/"durationMillis"\s*:\s*"?(\d{3,})"?/),
        body.match(/"duration_ms"\s*:\s*"?(\d{3,})"?/),
        body.match(/"duration"\s*:\s*"?(\d{3,})"?/),
      ];
      const raw = matches.find(Boolean)?.[1];
      if (!raw) continue;

      const milliseconds = Number(raw);
      const seconds = Math.round(milliseconds / 1000);
      if (Number.isInteger(seconds) && seconds > 0 && seconds <= 86_400) return seconds;
    } catch {
      // Try the next server-side source. No Drive URL is returned to the client.
    }
  }

  return null;
}
