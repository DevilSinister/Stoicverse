"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ChannelRow } from "@/components/channels/CommunityProvider";
import { createClient } from "@/lib/supabase/client";

/**
 * Unread and mention counts for the whole sidebar.
 *
 * This lives at the layout, not in the open channel: the point of an unread
 * badge is the channel you are *not* looking at. A subscription per visible
 * channel would be dozens of sockets, so this one listens to `posts` across
 * the community and re-reads the directory — the single query that already
 * answers "unread and mentions, per channel, for me", and the one the sidebar
 * renders anyway.
 *
 * The re-read is trailing-debounced: a burst of ten messages in a busy channel
 * is one directory read, not ten.
 */

const SETTLE_MS = 400;

export function useUnread(initial: ChannelRow[]) {
  const [channels, setChannels] = useState(initial);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef<string | null>(null);

  /** The channel currently on screen never shows itself as unread. */
  const setActiveChannel = useCallback((channelId: string | null) => {
    activeRef.current = channelId;
    setChannels((current) =>
      current.map((channel) =>
        channel.id === channelId ? { ...channel, hasUnread: false, mentionCount: 0 } : channel,
      ),
    );
  }, []);

  const reread = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("community_channel_directory");
    if (!data) return;
    const rows = data as Record<string, unknown>[];
    setChannels((current) =>
      current.map((channel) => {
        const row = rows.find((entry) => entry.channel_id === channel.id);
        if (!row) return channel;
        // The open channel is being read right now. The server cannot know
        // that until the debounced mark-read lands, and showing it bold in the
        // meantime makes the badge look broken.
        const isActive = channel.id === activeRef.current;
        return {
          ...channel,
          hasUnread: isActive ? false : Boolean(row.has_unread),
          mentionCount: isActive ? 0 : ((row.mention_count as number) ?? 0),
        };
      }),
    );
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void reread(), SETTLE_MS);
    };

    const subscription = supabase
      .channel("community:unread")
      // No filter, deliberately: this is the one subscription that hears the
      // whole community, because an unread badge is about the channels this
      // person is not currently in. RLS still decides what arrives.
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_read_states" }, schedule)
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void supabase.removeChannel(subscription);
    };
  }, [reread]);

  return { channels, setActiveChannel, refreshUnread: reread };
}
