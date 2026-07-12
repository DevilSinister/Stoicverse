import { NextResponse } from "next/server";

const windows = new Map<string, { count: number; resetAt: number }>();

export function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin || !appUrl) return false;

  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

export function rejectUntrustedOrigin(request: Request) {
  return hasTrustedOrigin(request)
    ? null
    : NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
}

// The VPS runs one application process today. Move this boundary to Redis or a
// database-backed limiter before scaling the application horizontally.
export function isRateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  current.count += 1;
  return current.count > limit;
}
