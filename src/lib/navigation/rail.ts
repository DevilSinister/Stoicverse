/**
 * The rail: every place a person can go, as one flat list.
 *
 * Two things this replaces. `buildAppNav` kept two divergent lists — the
 * creator branch hardcoded absolute paths, the member branch routed through
 * `withRouteBase`, and the same destination was labelled "Channels" for one
 * and "Communities" for the other. And the two shells that rendered it
 * (`AppShell`, `ChannelsShell`) never composed, so crossing into `/channels`
 * swapped the whole frame and the navigation vanished.
 *
 * **The hierarchy is flat.** Dashboard, Community, Courses and Events are
 * peers, each one click from anywhere. `group` exists so the rail can draw a
 * divider between clusters; it confers no nesting and no containment. A
 * future item must pick a group, not a parent.
 *
 * Zero imports on purpose — the icon is named as a string and resolved by the
 * component, so this module's branching (who sees Master Zone, who sees the
 * management cluster, where a creator's Courses actually live) is testable by
 * `node --test` without a React renderer. Same shape as `channels/shortcuts.ts`
 * and `channels/permissions.ts`.
 */

/** Lucide icon names. Resolved to components in `AppRail`, which owns that map. */
export type RailIconName =
  | "dashboard"
  | "community"
  | "courses"
  | "events"
  | "master"
  | "members"
  | "analytics"
  | "revenue"
  | "notifications"
  | "settings";

/**
 * Dividers are drawn between groups, in this order. `utility` is pinned to the
 * bottom of the rail rather than following `manage` in flow.
 */
export type RailGroup = "home" | "spaces" | "manage" | "utility";

export const RAIL_GROUP_ORDER: readonly RailGroup[] = ["home", "spaces", "manage", "utility"];

export type RailItem = {
  /** Stable across creator and member, so the active check never branches on role. */
  id: string;
  href: string;
  /** The tooltip, and the accessible name — the rail has no visible labels. */
  label: string;
  icon: RailIconName;
  group: RailGroup;
};

export type RailViewer = {
  /** `"/creator"` for the influencer workspace, `"/dashboard"` or `""` otherwise. */
  routeBase?: string;
  platformRole?: string;
  /** Master Zone is a tier gate, not a role one — a creator is not master by default. */
  isMaster?: boolean;
};

/**
 * The avatar is not in this list. It is the account-settings control and the
 * rail renders it separately at the very bottom, because it carries an image
 * rather than an icon and it is the one item whose target differs by role for
 * a reason that is not navigational: `proxy.ts` bounces an influencer off
 * `/dashboard/settings`, so the creator needs `/creator/account`.
 */
export function accountHref(viewer: RailViewer): string {
  return viewer.routeBase === "/creator" ? "/creator/account" : "/dashboard/settings";
}

export function buildRail(viewer: RailViewer = {}): RailItem[] {
  const creator = viewer.routeBase === "/creator";
  const base = creator ? "/creator" : "/dashboard";

  const items: RailItem[] = [
    // Top slot, where Discord puts home.
    { id: "dashboard", href: creator ? "/creator" : "/dashboard", label: "Dashboard", icon: "dashboard", group: "home" },

    // `/channels` is the same route for everyone — the permissions resolver
    // decides what each person may do once they are there — so it keeps one
    // label rather than the two it used to carry.
    { id: "community", href: "/channels", label: "Community", icon: "community", group: "spaces" },
    { id: "courses", href: `${base}/courses`, label: "Courses", icon: "courses", group: "spaces" },
    { id: "events", href: `${base}/events`, label: "Events", icon: "events", group: "spaces" },
  ];

  // Master Zone had no link anywhere in the product, for either role, while a
  // screen elsewhere marked it active in a nav that did not list it.
  if (viewer.isMaster) {
    items.push({ id: "master", href: creator ? "/creator/master" : "/master", label: "Master Zone", icon: "master", group: "spaces" });
  }

  if (creator) {
    items.push(
      { id: "members", href: "/creator/members", label: "Members", icon: "members", group: "manage" },
      { id: "analytics", href: "/creator/analytics", label: "Analytics", icon: "analytics", group: "manage" },
      { id: "revenue", href: "/creator/revenue", label: "Revenue", icon: "revenue", group: "manage" },
    );
  }

  items.push(
    // `/creator/notifications` is a stub with no list; both roles read the one
    // that works until that is resolved.
    { id: "notifications", href: "/dashboard/notifications", label: "Notifications", icon: "notifications", group: "utility" },
    // For a creator this is the community configuration, not an account page —
    // which is exactly why the avatar below it is a separate control.
    { id: "settings", href: creator ? "/creator/settings" : "/dashboard/settings", label: creator ? "Community settings" : "Settings", icon: "settings", group: "utility" },
  );

  return items;
}

/**
 * Which rail item a path belongs to.
 *
 * Longest href wins, so `/creator/members/turnover` resolves to Members rather
 * than to Dashboard on the `/creator` prefix. `/dashboard` and `/creator` are
 * exact-match only for the same reason — every other creator route starts with
 * `/creator`, and a prefix test would light the home icon on all of them.
 */
export function activeRailId(pathname: string, items: RailItem[]): string | null {
  let best: RailItem | null = null;

  for (const item of items) {
    const exactOnly = item.href === "/dashboard" || item.href === "/creator";
    const hit = exactOnly ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!hit) continue;
    if (!best || item.href.length > best.href.length) best = item;
  }

  return best?.id ?? null;
}
