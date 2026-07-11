import { BookOpen, CalendarDays, Crown, GraduationCap, LayoutDashboard, MessageSquare, type LucideIcon } from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export function buildAppNav({ isMaster }: { isMaster: boolean }): AppNavItem[] {
  return [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/courses", label: "Learning", icon: GraduationCap },
    { href: "/community", label: "Community", icon: MessageSquare },
    { href: "/events", label: "Events", icon: CalendarDays },
    ...(isMaster ? [{ href: "/master", label: "Master Zone", icon: Crown }] : []),
    { href: "/subscription", label: "Mentorship", icon: BookOpen },
  ];
}
