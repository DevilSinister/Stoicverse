import { BookOpen, CalendarDays, Crown, GraduationCap, LayoutDashboard, MessageSquare, type LucideIcon } from "lucide-react";

import { withRouteBase } from "@/lib/navigation/paths";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export function buildAppNav({ isMaster, routeBase = "" }: { isMaster: boolean; routeBase?: string }): AppNavItem[] {
  return [
    { href: withRouteBase(routeBase, "/dashboard"), label: "Dashboard", icon: LayoutDashboard },
    { href: withRouteBase(routeBase, "/courses"), label: "Learning", icon: GraduationCap },
    { href: withRouteBase(routeBase, "/community"), label: "Community", icon: MessageSquare },
    { href: withRouteBase(routeBase, "/events"), label: "Events", icon: CalendarDays },
    ...(isMaster ? [{ href: withRouteBase(routeBase, "/master"), label: "Master Zone", icon: Crown }] : []),
    { href: withRouteBase(routeBase, "/mentorship"), label: "Mentorship", icon: BookOpen },
  ];
}
