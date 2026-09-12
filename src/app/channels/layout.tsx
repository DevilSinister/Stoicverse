import type { ReactNode } from "react";

import { ChannelsShell } from "@/components/channels/ChannelsShell";
import { CommunityProvider, type ChannelRow } from "@/components/channels/CommunityProvider";
import { loadCustomEmojis, loadMemberDirectory, loadViewerState } from "@/lib/community/messages";
import { requireCommunityAccess } from "@/lib/supabase/access";

/**
 * The shell every channel renders inside.
 *
 * `requireCommunityAccess` rather than `requireActiveMembership`: the latter
 * sends an influencer to /creator and a super_admin to /admin, which would
 * mean the creator could never open their own community.
 *
 * The three reads run together. They are independent, and the layout cannot
 * paint until all three are in, so awaiting them in sequence would be three
 * round trips of blank screen instead of one.
 */
export default async function ChannelsLayout({ children }: { children: ReactNode }) {
  const { supabase } = await requireCommunityAccess("/channels");

  const [viewerLoad, directory, memberLoad, emojiLoad] = await Promise.all([
    loadViewerState(supabase),
    supabase.rpc("community_channel_directory"),
    loadMemberDirectory(supabase),
    loadCustomEmojis(supabase),
  ]);

  const degraded = [...viewerLoad.degraded, ...memberLoad.degraded, ...emojiLoad.degraded];
  if (directory.error) {
    console.error("[channels]", { code: directory.error.code ?? null });
    degraded.push("The channel list could not be read.");
  }

  const channels: ChannelRow[] = ((directory.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.channel_id as string,
    name: row.channel_name as string,
    type: (row.channel_type as string) ?? "text",
    description: (row.channel_description as string | null) ?? null,
    categoryId: row.category_id as string,
    categoryName: row.category_name as string,
    isLocked: Boolean(row.is_locked),
    canSend: Boolean(row.can_send),
    slowModeSeconds: (row.slow_mode_seconds as number) ?? 0,
    unlockTier: (row.unlock_tier as number | null) ?? null,
    hasUnread: Boolean(row.has_unread),
    mentionCount: (row.mention_count as number) ?? 0,
  }));

  return (
    <CommunityProvider
      viewer={viewerLoad.viewer}
      channels={channels}
      members={memberLoad.members}
      emojis={emojiLoad.emojis}
      degraded={degraded}
    >
      <ChannelsShell>{children}</ChannelsShell>
    </CommunityProvider>
  );
}
