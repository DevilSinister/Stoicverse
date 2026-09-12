"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { activeTypists, onlineIdsFrom, TYPING_TTL_MS, type TypingEntry } from "@/lib/channels/presence";
import { createClient } from "@/lib/supabase/client";

/**
 * Presence and typing, on one realtime channel for the whole community.
 *
 * Neither touches the database. Presence is Supabase's own tracking, and
 * typing is a broadcast — a write per keystroke per member, for a value that
 * expires in six seconds, is not something a table should ever see.
 *
 * One channel rather than one per text channel: a member is online in the
 * community, not in a room, and a typing payload names its own channel, so a
 * single subscription serves every open view.
 */

/** However fast somebody types, they say so at most this often. */
const THROTTLE_MS = 2500;

type TypingPayload = { channelId: string; userId: string; name: string };

export function useCommunityLive(viewer: { userId: string; name: string } | null) {
  const [onlineIds, setOnlineIds] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [typing, setTyping] = useState<TypingEntry[]>([]);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const lastSentRef = useRef(0);

  const viewerId = viewer?.userId ?? null;
  const viewerName = viewer?.name ?? null;

  useEffect(() => {
    if (!viewerId) return;
    const supabase = createClient();
    const channel = supabase.channel("community:live", {
      config: {
        // Keyed by user, so two tabs collapse to one person and the member
        // list does not show somebody twice for owning a second window.
        presence: { key: viewerId },
        // Your own keystrokes are not news to you.
        broadcast: { self: false },
      },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        setOnlineIds(onlineIdsFrom(channel.presenceState() as Record<string, { userId?: string }[]>));
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const typed = payload as TypingPayload;
        if (!typed?.userId || !typed?.channelId) return;
        setTyping((current) => [
          ...current.filter((entry) => !(entry.userId === typed.userId && entry.channelId === typed.channelId)),
          { userId: typed.userId, channelId: typed.channelId, name: typed.name, at: Date.now() },
        ]);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ userId: viewerId });
      });

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [viewerId]);

  // Expired entries have to leave on their own: nothing ever arrives to say
  // somebody *stopped* typing, so without a tick the sentence would sit there
  // until the next keystroke from anybody.
  useEffect(() => {
    if (typing.length === 0) return;
    const timer = setInterval(
      () => setTyping((current) => current.filter((entry) => Date.now() - entry.at < TYPING_TTL_MS)),
      1000,
    );
    return () => clearInterval(timer);
  }, [typing.length]);

  /** Says "still typing", throttled however fast the keys come. */
  const announceTyping = useCallback(
    (channelId: string) => {
      const channel = channelRef.current;
      if (!channel || !viewerId) return;
      const now = Date.now();
      if (now - lastSentRef.current < THROTTLE_MS) return;
      lastSentRef.current = now;
      void channel.send({
        type: "broadcast",
        event: "typing",
        payload: { channelId, userId: viewerId, name: viewerName ?? "Someone" } satisfies TypingPayload,
      });
    },
    [viewerId, viewerName],
  );

  /** The names of everyone typing in one channel, right now. */
  const typistsIn = useCallback(
    (channelId: string): string[] =>
      activeTypists(
        typing.filter((entry) => entry.channelId === channelId),
        Date.now(),
        viewerId,
      ).map((entry) => entry.name),
    [typing, viewerId],
  );

  return { onlineIds, announceTyping, typistsIn };
}
