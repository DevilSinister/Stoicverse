import { BarChart3, CalendarDays, CircleDollarSign, GraduationCap, LayoutDashboard, MessageSquare, Settings, Users, type LucideIcon } from "lucide-react";

import { withRouteBase } from "@/lib/navigation/paths";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export function buildAppNav({ routeBase = "" }: { routeBase?: string }): AppNavItem[] {
  if (routeBase === "/creator") {
    return [
      { href: "/creator", label: "Overview", icon: LayoutDashboard },
      { href: "/creator/events", label: "Events", icon: CalendarDays },
      { href: "/creator/courses", label: "Courses", icon: GraduationCap },
      { href: "/creator/channels", label: "Channels", icon: MessageSquare },
      { href: "/creator/members", label: "Members", icon: Users },
      { href: "/creator/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/creator/revenue", label: "Revenue", icon: CircleDollarSign },
      { href: "/creator/settings", label: "Community settings", icon: Settings },
      { href: "/creator/notifications", label: "Notifications", icon: BarChart3 },
    ];
  }

  return [
    { href: withRouteBase(routeBase, ""), label: "Dashboard", icon: LayoutDashboard },
    { href: withRouteBase(routeBase, "/events"), label: "Events", icon: CalendarDays },
    { href: withRouteBase(routeBase, "/courses"), label: "Courses", icon: GraduationCap },
    { href: withRouteBase(routeBase, "/community"), label: "Communities", icon: MessageSquare },
    { href: withRouteBase(routeBase, "/messages"), label: "Messages", icon: MessageSquare },
    { href: withRouteBase(routeBase, "/notifications"), label: "Notifications", icon: BarChart3 },
    { href: withRouteBase(routeBase, "/settings"), label: "Settings", icon: Settings },
  ];
}
