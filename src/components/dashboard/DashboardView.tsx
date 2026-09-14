"use client";

import type { Notification } from "@/components/layout/AppShell";

type Event = { id: string; title: string; description: string | null; starts_at: string; min_tier: number; status: string };

export type TierProgressDetail = {
  level: number;
  title: string;
  completedCount: number;
  totalCount: number;
  status: "locked" | "active" | "completed";
};

export type DashboardData = {
  memberName: string;
  platformRole: string;
  currentTier: number;
  isMaster: boolean;
  currentTierTitle: string;
  completedLessons: number;
  totalLessons: number;
  currentTierCompleted: number;
  currentTierTotal: number;
  activeLesson: { id: string; title: string; description: string | null; progress: number; completedVideos: number; totalVideos: number; remainingMinutes: number; isCompleted: boolean } | null;
  enrolledCourses: { id: string; title: string; description: string | null; progress: number; completedVideos: number; totalVideos: number; remainingMinutes: number; isCompleted: boolean; thumbnailVideoId: string | null }[];
  upcomingEvent: Event | null;
  notifications: Notification[];
  tierProgressDetails: TierProgressDetail[];
  turnoverThisWeek: number;
  allTimeTurnover: number;
  turnoverUpdatedAt: string | null;
};


/*
  What used to live here was a second, complete dashboard.

  `LegacyDashboardView` was ~300 lines of the pre-Monolith design with no
  importer - eslint had been reporting it as unused for long enough that the
  warning was part of the accepted baseline. It carried its own `Panel` and
  `Metric` and about a hundred deprecated token call sites, so every count of
  "how much of the product is still on the old system" was inflated by a screen
  nobody could reach. Deleted in phase 7 with the live dashboard's redesign.

  This module is now the dashboard's type surface plus the re-export that
  `app/dashboard/page.tsx` imports. The types stay here rather than moving into
  TerminalDashboard because that file imports them from this one.
*/

export { TerminalDashboard as DashboardView } from "./TerminalDashboard";
