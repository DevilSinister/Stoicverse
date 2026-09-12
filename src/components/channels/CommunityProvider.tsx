"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { MentionDictionary } from "@/lib/channels/mentions";
import { deriveAffordances, type Affordances } from "@/lib/channels/permissions";
import type { ChannelMessage, DirectoryMember, ViewerState } from "@/lib/community/messages";
import type { MentionResolvers } from "@/lib/markdown/render";
import { createClient } from "@/lib/supabase/client";

/**
 * Everything the channels page knows about the person looking at it.
 *
 * One context rather than prop drilling through eight levels, because the
 * composer at the bottom and the channel row in the sidebar need the same
 * answer to the same question — what may this person do here — and that answer
 * comes from one place, `community_viewer_state`.
 */

export type ChannelRow = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  isLocked: boolean;
  canSend: boolean;
  slowModeSeconds: number;
  unlockTier: number | null;
  hasUnread: boolean;
  mentionCount: number;
};

type CommunityValue = {
  viewer: ViewerState | null;
  channels: ChannelRow[];
  members: DirectoryMember[];
  /** What the viewer may do in one channel. */
  affordances: (channelId: string) => Affordances;
  /** Names for the mention autocomplete and for encoding on send. */
  dictionary: MentionDictionary;
  /** Id-to-name lookups the markdown renderer needs. */
  resolvers: MentionResolvers;
  degraded: string[];
};

const CommunityContext = createContext<CommunityValue | null>(null);

export function useCommunity(): CommunityValue {
  const value = useContext(CommunityContext);
  if (!value) throw new Error("useCommunity must be used inside CommunityProvider");
  return value;
}

export function CommunityProvider({
  viewer,
  channels,
  members,
  degraded,
  children,
}: {
  viewer: ViewerState | null;
  channels: ChannelRow[];
  members: DirectoryMember[];
  degraded: string[];
  children: ReactNode;
}) {
  const value = useMemo<CommunityValue>(() => {
    const channelById = new Map(channels.map((channel) => [channel.id, channel]));
    const memberById = new Map(members.map((member) => [member.id, member.fullName]));
    const roleById = new Map((viewer?.roles ?? []).map((role) => [role.id, { name: role.name, color: role.color }]));
    // A role the viewer does not hold still has to render inside somebody
    // else's message, so the member directory contributes its roles too.
    for (const member of members) {
      for (const role of member.roles) {
        if (!roleById.has(role.id)) roleById.set(role.id, { name: role.name, color: role.color });
      }
    }

    return {
      viewer,
      channels,
      members,
      affordances: (channelId: string) =>
        deriveAffordances({
          permissions: viewer?.channelPermissions?.[channelId] ?? [],
          channelType: channelById.get(channelId)?.type ?? "text",
          gate: viewer?.gate ?? null,
        }),
      dictionary: {
        users: members.map((member) => ({ id: member.id, name: member.fullName })),
        roles: [...roleById.entries()].map(([id, role]) => ({ id, name: role.name })),
        channels: channels.map((channel) => ({ id: channel.id, name: channel.name })),
      },
      resolvers: {
        user: (id) => memberById.get(id),
        role: (id) => roleById.get(id),
        channel: (id) => channelById.get(id)?.name,
      },
      degraded,
    };
  }, [viewer, channels, members, degraded]);

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
}

/**
 * Live messages and reactions for one channel.
 *
 * Both subscriptions filter on `channel_id` — which is why phase 8 put that
 * column on `reactions`. Without the filter every open channel would wake for
 * every reaction anywhere in the community.
 */
export function useChannelLive(
  channelId: string,
  onInsert: (row: Record<string, unknown>) => void,
  onReaction: () => void,
) {
  const insertRef = useRef(onInsert);
  const reactionRef = useRef(onReaction);
  // Assigned in an effect, not during render: the subscription below reads
  // `.current` only from a callback that fires long after this has run, so the
  // handlers stay current without the component re-subscribing on every
  // render.
  useEffect(() => {
    insertRef.current = onInsert;
    reactionRef.current = onReaction;
  });

  const [connected, setConnected] = useState(true);

  useEffect(() => {
    if (!channelId) return;
    const supabase = createClient();
    const subscription = supabase
      .channel(`channel:${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts", filter: `channel_id=eq.${channelId}` },
        (payload) => insertRef.current(payload.new as Record<string, unknown>),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reactions", filter: `channel_id=eq.${channelId}` },
        () => reactionRef.current(),
      )
      .subscribe((status) => {
        // A dropped socket is worth saying out loud: the alternative is a
        // channel that looks quiet when it is actually disconnected.
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      void supabase.removeChannel(subscription);
    };
  }, [channelId]);

  return { connected };
}

/**
 * Live messages inside one thread.
 *
 * Filtered on `thread_id`, not on the channel: a busy channel would otherwise
 * wake an open thread panel for every message posted outside it, and the panel
 * would refetch each time to discover nothing had changed. A realtime filter
 * takes one column, so this is the column worth spending it on.
 */
export function useThreadLive(threadId: string | null, onChange: () => void) {
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  });

  const [connected, setConnected] = useState(true);

  useEffect(() => {
    if (!threadId) return;
    const supabase = createClient();
    const subscription = supabase
      .channel(`thread:${threadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts", filter: `thread_id=eq.${threadId}` },
        () => changeRef.current(),
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(subscription);
    };
  }, [threadId]);

  return { connected };
}

/**
 * Merge one message into a list.
 *
 * An optimistic bubble the composer already rendered carries the same
 * `client_nonce` as the row that comes back over realtime, and matching on it
 * is what stops the message appearing twice.
 */
export function mergeMessage(messages: ChannelMessage[], incoming: ChannelMessage): ChannelMessage[] {
  const byId = messages.findIndex((message) => message.id === incoming.id);
  if (byId !== -1) {
    const next = [...messages];
    next[byId] = incoming;
    return next;
  }

  if (incoming.clientNonce) {
    const byNonce = messages.findIndex(
      (message) => message.clientNonce !== null && message.clientNonce === incoming.clientNonce,
    );
    if (byNonce !== -1) {
      const next = [...messages];
      next[byNonce] = incoming;
      return next;
    }
  }

  return [...messages, incoming];
}
