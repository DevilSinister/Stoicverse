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
 * It has three shapes, and two of them are bug fixes rather than flourishes.
 *
 * `variant="rail"` is the permanent 4.5rem column: icons only, each one an
 * `aria-label` plus a tooltip, which is what buys the width back. That trade
 * only works with a pointer. On a phone the rail is rendered inside a drawer,
 * where there is no hover, so every tooltip is unreachable and the entire
 * primary navigation was nine unnamed glyphs.
 *
 * `variant="drawer"` draws the same list as full-width labelled rows, for a
 * drawer that has the whole width to spend - the workspace shell's.
 *
 * `variant="stack"` is the same list again as a 5rem column of icons with the
 * label *under* each one, for `/channels`, whose drawer has to carry two levels
 * of navigation at once: this column and the channel list beside it. The label
 * is `text-chrome-xs`, the 11px floor the token layer sets, and it wraps to two
 * lines rather than shrinking below it - which is what decides the 5rem, since
 * "Notifications" is one unbreakable word.
 *
 * One `buildRail` call feeds all three, so a destination cannot exist in one
 * presentation and not another. `app-chrome.contract.mjs` asserts that count.
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

type RailVariant = "rail" | "drawer" | "stack";

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
  /** Icons-with-tooltips, labelled rows, or a labelled icon column. */
  variant?: RailVariant;
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
  variant = "rail",
  onNavigate,
}: AppRailProps) {
  const pathname = usePathname();
  const identity = useCommunityBranding(branding);
  const items = useMemo(() => buildRail({ routeBase, platformRole, isMaster }), [routeBase, platformRole, isMaster]);
  const activeId = activeRailId(pathname ?? "", items);
  const drawer = variant === "drawer";
  const stack = variant === "stack";

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
        className={
          drawer
            ? "flex h-full min-h-0 w-full flex-col gap-0.5 overflow-y-auto bg-surface-sunken p-2"
            : stack
              ? "flex h-full min-h-0 w-20 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-border-hairline bg-surface-sunken py-2"
              : "flex h-full w-[4.5rem] shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-border-hairline bg-surface-sunken py-2"
        }
      >
        {groups.map((entry, index) => (
          <div
            key={entry.group}
            className={
              // `utility` is pushed to the bottom rather than following the
              // management cluster in flow — it is where the eye looks for
              // settings and for yourself, not where the list happens to end.
              `flex w-full flex-col ${drawer ? "gap-0.5" : stack ? "items-center gap-1" : "items-center gap-1.5"}${
                entry.group === "utility" ? " mt-auto" : ""
              }`
            }
          >
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={
                  drawer ? "my-1.5 h-px bg-border-hairline" : `my-1 h-px ${stack ? "w-10" : "w-8"} bg-border-hairline`
                }
              />
            ) : null}
            {entry.items.map((item) => (
              <RailButton
                key={item.id}
                item={item}
                active={activeId === item.id}
                unreadCount={item.id === "notifications" ? unreadCount : 0}
                logoUrl={item.id === "community" ? identity.logoUrl : null}
                variant={variant}
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
        {stack ? (
          <StackTile
            href={account}
            label="Account"
            fullLabel="Account settings"
            active={accountActive}
            onNavigate={onNavigate}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-chrome-base font-semibold">{memberName[0]?.toUpperCase() || "P"}</span>
            )}
          </StackTile>
        ) : drawer ? (
          <Link
            href={account}
            onClick={onNavigate}
            aria-current={accountActive ? "page" : undefined}
            className={`focus-ring mt-1.5 flex items-center gap-3 rounded-md border-t border-border-hairline px-2.5 pt-3 pb-1 transition-colors ${
              accountActive ? "text-text-strong" : "text-text-muted hover:text-text-strong"
            }`}
          >
            <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-raised text-chrome-base font-semibold text-text-strong">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                memberName[0]?.toUpperCase() || "P"
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-content-sm text-text-strong">{memberName}</span>
              <span className="block font-mono text-mono-xs text-text-faint">Account settings</span>
            </span>
          </Link>
        ) : (
          <RailShell href={account} label={`${memberName} — account settings`} active={accountActive} onNavigate={onNavigate}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-content-sm font-semibold">{memberName[0]?.toUpperCase() || "P"}</span>
            )}
          </RailShell>
        )}
      </nav>
    </TooltipProvider>
  );
}

function RailButton({
  item,
  active,
  unreadCount,
  logoUrl,
  variant,
  onNavigate,
}: {
  item: RailItem;
  active: boolean;
  unreadCount: number;
  logoUrl: string | null;
  variant: RailVariant;
  onNavigate?: () => void;
}) {
  const Icon = ICONS[item.icon];
  const drawer = variant === "drawer";

  const glyph = logoUrl ? (
    // The community's own logo stands in for the generic icon — the point
    // of uploading one is that people see it.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="" className="size-full rounded-[inherit] object-cover" />
  ) : (
    <Icon size={drawer ? 18 : 20} aria-hidden="true" />
  );

  if (drawer) {
    return (
      <DrawerRow href={item.href} label={item.label} active={active} badge={unreadCount} onNavigate={onNavigate}>
        {logoUrl ? <span className="grid size-[18px] shrink-0 overflow-hidden rounded-sm">{glyph}</span> : glyph}
      </DrawerRow>
    );
  }

  if (variant === "stack") {
    return (
      <StackTile
        href={item.href}
        label={item.label}
        active={active}
        badge={unreadCount}
        onNavigate={onNavigate}
      >
        {glyph}
      </StackTile>
    );
  }

  return (
    <RailShell href={item.href} label={item.label} active={active} badge={unreadCount} onNavigate={onNavigate}>
      {glyph}
    </RailShell>
  );
}

/**
 * The active marker.
 *
 * Fixed height and a `scaleY`, not `h-0` growing to `h-8`. The previous version
 * ran `transition-all` across a height change, which animates layout on every
 * navigation; a transform composites instead. Shared by both variants so the
 * drawer and the rail mark the current destination the same way.
 */
function ActiveMarker({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute left-0 top-1/2 h-[18px] w-0.5 -translate-y-1/2 rounded-r-sm bg-primary transition-transform duration-150 ${
        active ? "scale-y-100" : "scale-y-0"
      }`}
    />
  );
}

/** A count that must stay legible at 9px: one red, near-black numerals on it. */
function Badge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={`grid min-w-4 shrink-0 place-items-center rounded-full bg-status-danger px-1 font-mono text-[9px] font-medium leading-4 text-surface-canvas ${className ?? ""}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** The icon pill, the marker, the tooltip and the badge — shared so the avatar matches the icons. */
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
      <ActiveMarker active={active} />
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={href}
              onClick={onNavigate}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`focus-ring relative grid size-11 place-items-center overflow-hidden rounded-md transition-colors ${
                active
                  ? "bg-surface-panel text-primary"
                  : "text-text-muted hover:bg-surface-panel hover:text-text-strong"
              }`}
            >
              {children}
              {badge > 0 ? (
                <Badge count={badge} className="absolute right-1 top-1 ring-2 ring-surface-sunken" />
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

/** The same destination as a labelled row, for a drawer that a thumb operates. */
function DrawerRow({
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
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`focus-ring relative flex h-11 items-center gap-3 rounded-md px-2.5 text-content-sm transition-colors ${
        active ? "bg-surface-panel text-primary" : "text-text-muted hover:bg-surface-panel hover:text-text-strong"
      }`}
    >
      <ActiveMarker active={active} />
      {children}
      <span className="min-w-0 truncate">{label}</span>
      {badge > 0 ? <Badge count={badge} className="ml-auto" /> : null}
    </Link>
  );
}

/**
 * The same destination as an icon with its name under it.
 *
 * For `/channels`, where the drawer already owes its width to the channel list
 * and a full-width labelled row would leave nothing for it. The label is
 * `text-chrome-xs` - 11px, the floor - and wraps to two lines rather than
 * shrinking, which is what sets the column at 5rem: "Notifications" and
 * "Analytics" are single words that cannot be broken.
 *
 * No tooltip. The name is already on screen, and a tooltip that repeats a
 * visible label is noise on a pointer and unreachable on the touch screen this
 * variant exists for.
 */
function StackTile({
  href,
  label,
  fullLabel,
  active,
  badge = 0,
  onNavigate,
  children,
}: {
  href: string;
  label: string;
  /** When the visible label is a shortening. Must contain the visible one. */
  fullLabel?: string;
  active: boolean;
  badge?: number;
  onNavigate?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex w-full justify-center">
      <ActiveMarker active={active} />
      <Link
        href={href}
        onClick={onNavigate}
        aria-label={fullLabel}
        aria-current={active ? "page" : undefined}
        className={`focus-ring relative flex min-h-11 w-[4.25rem] flex-col items-center gap-1 rounded-md px-1 py-1.5 text-center transition-colors ${
          active ? "bg-surface-panel text-primary" : "text-text-muted hover:bg-surface-panel hover:text-text-strong"
        }`}
      >
        <span className="grid size-5 shrink-0 place-items-center overflow-hidden rounded-sm">{children}</span>
        <span className="line-clamp-2 text-chrome-xs leading-[1.15]">{label}</span>
        {badge > 0 ? <Badge count={badge} className="absolute top-1 right-2 ring-2 ring-surface-sunken" /> : null}
      </Link>
    </div>
  );
}
