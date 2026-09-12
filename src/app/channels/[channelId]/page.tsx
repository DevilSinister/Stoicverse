import { notFound, redirect } from "next/navigation";

import { ChannelView } from "@/components/channels/ChannelView";
import type { ChannelRow } from "@/components/channels/CommunityProvider";
import { loadChannelMessages } from "@/lib/community/messages";
import { isUuid } from "@/lib/security/uuid";
import { requireCommunityAccess } from "@/lib/supabase/access";

export const dynamic = "force-dynamic";

/**
 * One channel.
 *
 * The first page of messages is rendered on the server so the conversation is
 * there on first paint; every page after that is fetched from the browser.
 *
 * `params` is a Promise in Next 16.
 */
export default async function ChannelPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  if (!isUuid(channelId)) notFound();

  const { supabase } = await requireCommunityAccess(`/channels/${channelId}`);

  const [directory, page] = await Promise.all([
    supabase.rpc("community_channel_directory"),
    loadChannelMessages(supabase, channelId),
  ]);

  const row = ((directory.data ?? []) as Record<string, unknown>[]).find((entry) => entry.channel_id === channelId);
  if (!row) notFound();

  // A locked channel is a teaser in the sidebar, not a page. Opening one
  // directly should not render an empty conversation that looks broken.
  if (row.is_locked) redirect("/channels");

  const channel: ChannelRow = {
    id: row.channel_id as string,
    name: row.channel_name as string,
    type: (row.channel_type as string) ?? "text",
    description: (row.channel_description as string | null) ?? null,
    categoryId: row.category_id as string,
    categoryName: row.category_name as string,
    isLocked: false,
    canSend: Boolean(row.can_send),
    slowModeSeconds: (row.slow_mode_seconds as number) ?? 0,
    unlockTier: (row.unlock_tier as number | null) ?? null,
    hasUnread: Boolean(row.has_unread),
    mentionCount: (row.mention_count as number) ?? 0,
  };

  // Where they were is remembered by `rememberChannel` in proxy.ts. It cannot
  // be done here: a Server Component render may not set a cookie, and Next
  // throws rather than ignoring it, so the whole channel renders as an error.

  // The bucket is public, so this is string construction rather than a signed
  // URL round trip per attachment. The storage read policy is still what
  // decides whether the object is served.
  const urls: Record<string, string> = {};
  for (const message of page.messages) {
    for (const attachment of message.attachments) {
      urls[attachment.path] = supabase.storage.from("community-posts").getPublicUrl(attachment.path).data.publicUrl;
    }
  }

  return (
    <ChannelView
      channel={channel}
      initialMessages={page.messages}
      initialCursor={page.nextCursor}
      initialUrls={urls}
    />
  );
}
