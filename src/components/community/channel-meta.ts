import { Calendar, Crown, Hash, Megaphone, type LucideIcon } from "lucide-react";

/** The four channel types `saveChannel` accepts. Keep this list and the server
 *  validation in `src/app/creator/channels/actions.ts` in step. */
export const CHANNEL_TYPES = ["text", "announcements", "events", "master"] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

type ChannelTypeMeta = {
  icon: LucideIcon;
  /** Rendered before the name everywhere a channel is named, so the sidebar,
   *  the feed header and the manage flow all read the same. */
  prefix: string;
  label: string;
  /** Creator-facing sentence explaining what the type changes. */
  hint: string;
  namePlaceholder: string;
  descriptionPlaceholder: string;
};

const META: Record<ChannelType, ChannelTypeMeta> = {
  text: {
    icon: Hash,
    prefix: "#",
    label: "Discussion",
    hint: "An open study channel. Staff publish prompts; members react.",
    namePlaceholder: "daily-reflections",
    descriptionPlaceholder: "What this channel is for, in one line.",
  },
  announcements: {
    icon: Megaphone,
    prefix: "!",
    label: "Announcement",
    hint: "Posts here are marked as announcements and carry more weight in the feed.",
    namePlaceholder: "community-notices",
    descriptionPlaceholder: "Who should read this and how often it changes.",
  },
  events: {
    icon: Calendar,
    prefix: "@",
    label: "Event",
    hint: "Pairs with the events calendar. Use it for session logistics and recaps.",
    namePlaceholder: "live-sessions",
    descriptionPlaceholder: "When sessions run and how members join.",
  },
  master: {
    icon: Crown,
    prefix: "^",
    label: "Master",
    hint: "Reserved for members who have reached Master. Set the minimum tier to match.",
    namePlaceholder: "master-circle",
    descriptionPlaceholder: "What Master members discuss here.",
  },
};

export function channelMeta(type: string): ChannelTypeMeta {
  return META[type as ChannelType] ?? META.text;
}

export function tierName(tier: number) {
  return tier === 5 ? "Master" : `Tier ${tier}`;
}

/** Discord-style handle preview shown live while a creator types a channel name.
 *  Display only — the stored name keeps the creator's own capitalization. */
export function channelSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function channelHref(routeBase: string, creator: boolean, channelId: string) {
  return `${routeBase}${creator ? "/channels" : "/community"}?channel=${channelId}`;
}
