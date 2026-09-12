import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { MESSAGE_PAGE_SIZE, SEARCH_QUERY_LIMITS } from "@/lib/community/constants";

/**
 * Reads for the messaging model added in 20260912070000.
 *
 * Every one of these goes through an RPC rather than a table select. The
 * permission question a message list has to answer — may you see this channel,
 * may you read its history — is answered once inside the function, and the
 * shape it returns (author colour, reply excerpt, attachments, grouped
 * reactions) would otherwise be four round trips and a client-side join.
 *
 * Reads degrade to an empty page and name the migration; they never throw at
 * the page. A failed read should leave a channel looking empty, not take the
 * workspace down.
 */

export type MessageAttachment = {
  id: string;
  path: string;
  mimeType: string;
  byteSize: number | null;
  width: number | null;
  height: number | null;
};

export type MessageReaction = { emoji: string; count: number; mine: boolean };

export type ChannelMessage = {
  id: string;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  /** The highest role colour the author holds, or null to use the default. */
  authorColor: string | null;
  body: string | null;
  postType: string;
  isPinned: boolean;
  /** ISO 8601. Formatted in the client, which knows the viewer's locale. */
  createdAt: string;
  editedAt: string | null;
  /** Echoed back so an optimistic bubble is reconciled rather than duplicated. */
  clientNonce: string | null;
  replyToPostId: string | null;
  replyAuthorName: string | null;
  replyExcerpt: string | null;
  threadId: string | null;
  threadName: string | null;
  threadMessageCount: number | null;
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
};

export type MessagePage = {
  messages: ChannelMessage[];
  /** Feed this back as the cursor for the next page; null when exhausted. */
  nextCursor: { createdAt: string; id: string } | null;
  degraded: string[];
};

function toMessage(row: Record<string, unknown>): ChannelMessage {
  return {
    id: row.id as string,
    authorId: (row.author_id as string | null) ?? null,
    authorName: (row.author_name as string) ?? "Former member",
    authorAvatar: (row.author_avatar as string | null) ?? null,
    authorColor: (row.author_color as string | null) ?? null,
    body: (row.body as string | null) ?? null,
    postType: (row.post_type as string) ?? "post",
    isPinned: Boolean(row.is_pinned),
    createdAt: row.created_at as string,
    editedAt: (row.edited_at as string | null) ?? null,
    clientNonce: (row.client_nonce as string | null) ?? null,
    replyToPostId: (row.reply_to_post_id as string | null) ?? null,
    replyAuthorName: (row.reply_author_name as string | null) ?? null,
    replyExcerpt: (row.reply_excerpt as string | null) ?? null,
    threadId: (row.thread_id as string | null) ?? null,
    threadName: (row.thread_name as string | null) ?? null,
    threadMessageCount: (row.thread_message_count as number | null) ?? null,
    attachments: ((row.attachments as MessageAttachment[] | null) ?? []).map((entry) => ({
      id: entry.id,
      path: entry.path,
      mimeType: entry.mimeType,
      byteSize: entry.byteSize ?? null,
      width: entry.width ?? null,
      height: entry.height ?? null,
    })),
    reactions: (row.reactions as MessageReaction[] | null) ?? [],
  };
}

/**
 * One page of a channel, or of a thread inside it, newest first.
 *
 * The cursor is `(created_at, id)` rather than an offset: a channel only
 * grows, and an offset walk would re-read everything the member has already
 * scrolled past.
 */
export async function loadChannelMessages(
  supabase: SupabaseClient,
  channelId: string,
  options: { cursor?: { createdAt: string; id: string }; threadId?: string; pageSize?: number } = {},
): Promise<MessagePage> {
  const pageSize = options.pageSize ?? MESSAGE_PAGE_SIZE;

  const { data, error } = await supabase.rpc("community_channel_messages", {
    channel: channelId,
    before_created_at: options.cursor?.createdAt ?? null,
    before_id: options.cursor?.id ?? null,
    page_size: pageSize,
    thread: options.threadId ?? null,
  });

  if (error) {
    console.error("[community-messages]", { code: error.code ?? null });
    return {
      messages: [],
      nextCursor: null,
      degraded: ["Messages could not be read. They need migration 20260912070000."],
    };
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const messages = rows.map(toMessage);
  // A full page means there is probably another. The alternative is a count
  // query per page, which is the expensive half of pagination.
  const last = messages.length === pageSize ? messages[messages.length - 1] : null;

  return {
    messages,
    nextCursor: last ? { createdAt: last.createdAt, id: last.id } : null,
    degraded: [],
  };
}

export type PinnedMessage = { id: string; authorName: string; body: string | null; pinnedAt: string | null };

export async function loadChannelPins(
  supabase: SupabaseClient,
  channelId: string,
): Promise<{ pins: PinnedMessage[]; degraded: string[] }> {
  const { data, error } = await supabase.rpc("community_channel_pins", { channel: channelId });
  if (error) {
    console.error("[community-messages]", { code: error.code ?? null });
    return { pins: [], degraded: ["Pinned messages could not be read."] };
  }
  return {
    pins: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      authorName: (row.author_name as string) ?? "Former member",
      body: (row.body as string | null) ?? null,
      pinnedAt: (row.pinned_at as string | null) ?? null,
    })),
    degraded: [],
  };
}

export type ChannelThread = {
  id: string;
  rootPostId: string;
  name: string;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  archived: boolean;
  locked: boolean;
};

/**
 * Every thread in one channel, live first and archived below.
 *
 * Through `community_channel_threads` rather than `from("threads")`: the table
 * does carry a `view_channel` policy that would make a direct read safe today,
 * but the member path reads functions and never base tables, and one policy
 * clause away from a staff gate is exactly where that rule earns its keep.
 */
export async function loadChannelThreads(
  supabase: SupabaseClient,
  channelId: string,
): Promise<{ threads: ChannelThread[]; degraded: string[] }> {
  const { data, error } = await supabase.rpc("community_channel_threads", { channel: channelId });
  if (error) {
    console.error("[community-messages]", { code: error.code ?? null });
    return { threads: [], degraded: ["Threads could not be read. They need migration 20260912090000."] };
  }
  return {
    threads: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      rootPostId: row.root_post_id as string,
      name: (row.name as string) ?? "Thread",
      messageCount: (row.message_count as number) ?? 0,
      lastMessageAt: (row.last_message_at as string | null) ?? null,
      createdAt: row.created_at as string,
      archived: Boolean(row.archived),
      locked: Boolean(row.locked),
    })),
    degraded: [],
  };
}

export type SearchHit = {
  id: string;
  channelId: string;
  channelName: string;
  authorName: string;
  body: string | null;
  createdAt: string;
};

/**
 * Search, restricted by the RPC to channels the caller can see.
 *
 * The bounds are checked here as well as in SQL, so a too-short query is an
 * empty result rather than a raised exception the page has to translate.
 */
export async function searchMessages(
  supabase: SupabaseClient,
  query: string,
  options: { channelId?: string; before?: string } = {},
): Promise<{ hits: SearchHit[]; degraded: string[] }> {
  const cleaned = query.trim();
  if (cleaned.length < SEARCH_QUERY_LIMITS.min || cleaned.length > SEARCH_QUERY_LIMITS.max) {
    return { hits: [], degraded: [] };
  }

  const { data, error } = await supabase.rpc("community_search_messages", {
    query: cleaned,
    channel: options.channelId ?? null,
    before_created_at: options.before ?? null,
    page_size: SEARCH_QUERY_LIMITS.pageSize,
  });

  if (error) {
    console.error("[community-messages]", { code: error.code ?? null });
    return { hits: [], degraded: ["Search is unavailable."] };
  }

  return {
    hits: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      channelId: row.channel_id as string,
      channelName: row.channel_name as string,
      authorName: (row.author_name as string) ?? "Former member",
      body: (row.body as string | null) ?? null,
      createdAt: row.created_at as string,
    })),
    degraded: [],
  };
}

export type ViewerState = {
  userId: string;
  gate: string | null;
  isInfluencer: boolean;
  profile: { fullName: string; avatarUrl: string | null } | null;
  roles: { id: string; name: string; color: string | null; position: number; hoist: boolean }[];
  grants: string[];
  channelPermissions: Record<string, string[]>;
  readStates: Record<string, { lastReadAt: string; lastReadPostId: string | null; mentionCount: number }>;
  notificationSettings: Record<string, { level: string; mutedUntil: string | null }>;
};

/**
 * Everything the page shell needs, in one round trip.
 *
 * The layout renders before any channel is chosen, so splitting this would put
 * five waterfalls in front of the first paint.
 */
export async function loadViewerState(
  supabase: SupabaseClient,
): Promise<{ viewer: ViewerState | null; degraded: string[] }> {
  const { data, error } = await supabase.rpc("community_viewer_state");
  if (error) {
    console.error("[community-messages]", { code: error.code ?? null });
    return { viewer: null, degraded: ["Your community profile could not be read."] };
  }
  return { viewer: data as ViewerState, degraded: [] };
}

export type DirectoryMember = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  topRoleId: string | null;
  topRoleName: string | null;
  topRoleColor: string | null;
  hoisted: boolean;
  roles: { id: string; name: string; color: string | null }[];
};

export async function loadMemberDirectory(
  supabase: SupabaseClient,
): Promise<{ members: DirectoryMember[]; degraded: string[] }> {
  const { data, error } = await supabase.rpc("community_member_directory");
  if (error) {
    console.error("[community-messages]", { code: error.code ?? null });
    return { members: [], degraded: ["The member list could not be read."] };
  }
  return {
    members: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      fullName: (row.full_name as string) ?? "Former member",
      avatarUrl: (row.avatar_url as string | null) ?? null,
      topRoleId: (row.top_role_id as string | null) ?? null,
      topRoleName: (row.top_role_name as string | null) ?? null,
      topRoleColor: (row.top_role_color as string | null) ?? null,
      hoisted: Boolean(row.hoisted),
      roles: (row.roles as { id: string; name: string; color: string | null }[] | null) ?? [],
    })),
    degraded: [],
  };
}
