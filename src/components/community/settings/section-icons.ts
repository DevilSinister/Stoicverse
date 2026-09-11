"use client";

import {
  Ban,
  Bot,
  Flag,
  Hash,
  ScrollText,
  ShieldCheck,
  Smile,
  Sparkles,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { SettingsSectionId } from "@/lib/community-settings/sections";

/** Icons live apart from the registry so the registry stays importable by node tests. */
export const SECTION_ICONS: Record<SettingsSectionId, LucideIcon> = {
  overview: Sparkles,
  roles: Users,
  emoji: Smile,
  channels: Hash,
  members: UserRound,
  bans: Ban,
  automod: Bot,
  safety: ShieldCheck,
  reports: Flag,
  audit: ScrollText,
};
