import { Calendar, Hash, Megaphone, ScrollText, type LucideIcon } from "lucide-react";

/** Re-exported from the model so this file stays presentation only: the list
 *  the database enforces lives in `model.ts` and the `channels_type_check`
 *  constraint, and a second copy here is a fifth type waiting to happen. */
export { CHANNEL_TYPES, type ChannelType } from "@/lib/community-settings/model";
import type { ChannelType } from "@/lib/community-settings/model";

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
  rules: {
    icon: ScrollText,
    prefix: "§",
    label: "Rules",
    // The resolver strips send_messages, send_messages_in_threads and
    // create_threads here for anyone without manage_channels, so this is
    // describing enforcement rather than promising it.
    hint: "Read-only for everyone but channel managers. Use it for the rules a member agrees to.",
    namePlaceholder: "rules",
    descriptionPlaceholder: "What a member agrees to by taking part.",
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
