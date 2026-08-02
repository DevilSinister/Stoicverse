import { safeNextPath } from "@/lib/security/safe-path";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
};

export type NotificationView = "all" | "unread" | "mentions";

export function notificationView(value: unknown): NotificationView {
  return value === "unread" || value === "mentions" ? value : "all";
}

export function safeNotificationHref(candidate: string | null | undefined, fallback = "/dashboard/notifications") {
  return safeNextPath(candidate, fallback);
}
