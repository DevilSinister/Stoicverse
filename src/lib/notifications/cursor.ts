import "server-only";

import type { NotificationItem } from "@/lib/notifications/model";

export function encodeNotificationCursor(item: Pick<NotificationItem, "created_at" | "id">) {
  return Buffer.from(JSON.stringify({ createdAt: item.created_at, id: item.id }), "utf8").toString("base64url");
}

export function decodeNotificationCursor(value: string | null) {
  if (!value || value.length > 256) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { createdAt?: unknown; id?: unknown };
    if (typeof parsed.createdAt !== "string" || Number.isNaN(Date.parse(parsed.createdAt))) return null;
    if (typeof parsed.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(parsed.id)) return null;
    return { createdAt: new Date(parsed.createdAt).toISOString(), id: parsed.id };
  } catch {
    return null;
  }
}
