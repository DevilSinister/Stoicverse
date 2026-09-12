"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  CircleDollarSign,
  Crown,
  GraduationCap,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { accountHref, activeRailId, buildRail, RAIL_GROUP_ORDER, type RailIconName, type RailItem } from "@/lib/navigation/rail";
import { useCommunityBranding, type CommunityBranding } from "@/lib/navigation/use-community-branding";

/**
 * The one navigation surface, mounted by both shells.
 *
 * Before this there were two chromes that could not compose: `AppShell`, which
 * ~19 page components each wrapped themselves in, and `ChannelsShell`. Crossing
 * into `/channels` swapped the entire frame and the navigation disappeared —
 * exactly the seam a rail exists to remove. The rail is the same component in
 * both, so it survives the crossing.
 *
 * It carries no labels. Every control is an icon with a tooltip and an
 * `aria-label`, which is what buys the width back; `buildRail` holds the names
 * so they are written once and read by both the tooltip and the screen reader.
 */

const ICONS: Record<RailIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  community: MessagesSquare,
  courses: GraduationCap,
  events: CalendarDays,
  master: Crown,
  members: Users,
  analytics: BarChart3,
  revenue: CircleDollarSign,
  notifications: Bell,
  settings: Settings,
};

export type AppRailProps = {
  routeBase?: string;
  platformRole?: string;
  isMaster?: boolean;
  memberName?: string;
  /** Already signed or absolute. Absent falls back to the initial disc. */
  avatarUrl?: string | null;
  unreadCount?: number;
  /** Supplied by a shell that already loaded it; otherwise the hook fetches. */
  branding?: CommunityBranding | null;
  /** Closes a mobile drawer that is rendering the rail inside itself. */
  onNavigate?: () => void;
};

export function AppRail({
  routeBase = "",
  platformRole = "member",
  isMaster = false,
  memberName = "Practitioner",
  avatarUrl = null,
  unreadCount = 0,
  branding = null,
  onNavigate,
}: AppRailProps) {
  const pathname = usePathname();
  const identity = useCommunityBranding(branding);
  const items = useMemo(() => buildRail({ routeBase, platformRole, isMaster }), [routeBase, platformRole, isMaster]);
  const activeId = activeRailId(pathname ?? "", items);

  // Only groups that actually have members draw a divider, so a member's rail
  // does not carry an empty gap where the creator's management cluster sits.
  const groups = RAIL_GROUP_ORDER.map((group) => ({ group, items: items.filter((item) => item.group === group) })).filter(
    (entry) => entry.items.length > 0,
  );

  const account = accountHref({ routeBase });
  const accountActive = pathname === account;

  return (
    <TooltipProvider delay={200}>
      <nav
        aria-label="Primary"
        className="flex h-full w-[4.5rem] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-sidebar-border bg-surface-container-lowest py-3"
      >
        {groups.map((entry, index) => (
          <div
            key={entry.group}
            className={
              // `utility` is pushed to the bottom rather than following the
              // management cluster in flow — it is where the eye looks for
              // settings and for yourself, not where the list happens to end.
              entry.group === "utility" ? "mt-auto flex w-full flex-col items-center gap-2" : "flex w-full flex-col items-center gap-2"
            }
          >
            {index > 0 ? <span aria-hidden="true" className="my-1 h-px w-8 bg-sidebar-border" /> : null}
            {entry.items.map((item) => (
              <RailButton
                key={item.id}
                item={item}
                active={activeId === item.id}
                unreadCount={item.id === "notifications" ? unreadCount : 0}
                logoUrl={item.id === "community" ? identity.logoUrl : null}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}

        {/*
          The avatar is the account-settings control, not a menu that contains
          one — a picture of you is the most direct thing to point at "your
          account". Sign-out lives on that page, which is where the only
          logoutAction in the product already is. For a creator this is the
          only route to either: `proxy.ts` bounces an influencer off
          /dashboard/settings, and their Settings icon opens the *community*
          configuration instead.
        */}
        <RailShell href={account} label={`${memberName} — account settings`} active={accountActive} onNavigate={onNavigate}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="size-full rounded-full object-cover" />
          ) : (
            <span className="text-sm font-bold">{memberName[0]?.toUpperCase() || "P"}</span>
          )}
        </RailShell>
      </nav>
    </TooltipProvider>
  );
}

function RailButton({
  item,
  active,
  unreadCount,
  logoUrl,
  onNavigate,
}: {
  item: RailItem;
  active: boolean;
  unreadCount: number;
  logoUrl: string | null;
  onNavigate?: () => void;
}) {
  const Icon = ICONS[item.icon];

  return (
    <RailShell href={item.href} label={item.label} active={active} badge={unreadCount} onNavigate={onNavigate}>
      {logoUrl ? (
        // The community's own logo stands in for the generic icon — the point
        // of uploading one is that people see it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="size-full rounded-[inherit] object-cover" />
      ) : (
        <Icon size={20} aria-hidden="true" />
      )}
    </RailShell>
  );
}

/** The pill, the active marker, the tooltip and the badge — shared so the avatar matches the icons. */
function RailShell({
  href,
  label,
  active,
  badge = 0,
  onNavigate,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  badge?: number;
  onNavigate?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex w-full justify-center">
      {/*
        Discord's active marker: a bar on the container edge rather than a
        background on the icon, so the shape stays legible when the icon is a
        logo somebody uploaded.
      */}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-primary-container transition-all ${active ? "h-8" : "h-0"}`}
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={href}
              onClick={onNavigate}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`focus-ring relative grid size-11 place-items-center overflow-hidden transition-all ${
                active
                  ? "rounded-2xl bg-primary-container/15 text-primary-container"
                  : "rounded-full bg-surface-container-low text-on-surface-variant hover:rounded-2xl hover:bg-primary-container/10 hover:text-primary-container"
              }`}
            >
              {children}
              {badge > 0 ? (
                <span className="absolute -bottom-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full border-2 border-surface-container-lowest bg-red-500 px-1 text-[9px] font-bold leading-4 text-white">
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </Link>
          }
        />
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
