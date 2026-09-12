"use server";

import { refresh } from "next/cache";

import {
  CHANNEL_NOTIFICATION_LEVELS,
  isValidReactionToken,
  MESSAGE_MAX_CHARS,
  THREAD_NAME_LIMITS,
  type ChannelNotificationLevel,
} from "@/lib/community/constants";
import { revalidateCommunity } from "@/lib/community-settings/revalidate";
import { isUuid as uuid } from "@/lib/security/uuid";
import { postgresMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; success?: true; reactionAdded?: boolean };

export async function toggleReaction(postId: string, emoji: string): Promise<Result> {
  // Any Unicode emoji or a custom-emoji token is a valid reaction. The same
  // format check lives in `community_reaction_token_is_valid`, which the
  // `reactions_own_write` policy applies; this only saves a round trip.
  if (!uuid(postId) || !isValidReactionToken(emoji)) return { error: "Invalid reaction." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to react." };
  const { data: existing, error: readError } = await supabase.from("reactions").select("id").eq("post_id", postId).eq("user_id", user.id).eq("emoji", emoji).maybeSingle();
  if (readError) return { error: postgresMessage(readError, "That reaction could not be read.") };
  const { error } = existing
    ? await supabase.from("reactions").delete().eq("id", existing.id)
    : await supabase.from("reactions").insert({ post_id: postId, user_id: user.id, emoji });
  // 42501 is the policy refusing the insert: the token failed the format check,
  // or the post is no longer visible to this member.
  if (error) {
    const fallback = error.code === "42501" ? "That reaction cannot be added here." : "That reaction could not be saved.";
    return { error: postgresMessage(error, fallback) };
  }
  revalidateCommunity();
  return { success: true, reactionAdded: !existing };
}

/**
 * Post a message.
 *
 * Renamed from `createStaffPost` because it is no longer a staff action: the
 * `posts_member_insert` policy asks `community_has('send_messages', channel)`,
 * so anyone the community has granted that may post. This checks the same
 * question first only to turn a policy refusal into a sentence.
 */
export async function sendMessage(data: FormData): Promise<Result> {
  const channelId = typeof data.get("channelId") === "string" ? String(data.get("channelId")) : "";
  const body = typeof data.get("body") === "string" ? String(data.get("body")).trim() : "";
  const attachmentPath = typeof data.get("attachmentPath") === "string" ? String(data.get("attachmentPath")) : "";
  if (!uuid(channelId) || (!body && !attachmentPath) || body.length > MESSAGE_MAX_CHARS) return { error: `Write a post or attach media (up to ${MESSAGE_MAX_CHARS.toLocaleString("en-US")} characters).` };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to post." };
  // The upload policy reads the channel out of the path, so the path has to
  // carry it: {uid}/{channelId}/{file}.
  if (attachmentPath && (!attachmentPath.startsWith(`${user.id}/${channelId}/`) || attachmentPath.includes(".."))) return { error: "Invalid attachment." };

  const { data: allowed, error: permissionError } = await supabase.rpc("community_has", { permission: "send_messages", channel: channelId });
  if (permissionError) return { error: postgresMessage(permissionError, "Your permissions could not be checked.") };
  if (allowed !== true) return { error: "You do not have permission to post in this channel." };

  const { data: channel, error: channelError } = await supabase.from("channels").select("type").eq("id", channelId).maybeSingle();
  if (channelError || !channel) return { error: "You cannot post in this channel." };
  const { error } = await supabase.from("posts").insert({ channel_id: channelId, author_id: user.id, body: body || null, image_url: attachmentPath || null, post_type: channel.type === "announcements" ? "announcement" : "post" });
  if (error) return { error: postgresMessage(error, "That post could not be published.") };

  revalidateCommunity();
  return { success: true };
}

export async function editMessage(postId: string, body: string): Promise<Result> {
  if (!uuid(postId) || !body.trim() || body.length > 10_000) return { error: "Write a valid post body (up to 10,000 characters)." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to edit." };

  // Content belongs to its author. A moderator may hide a post but never rewrite
  // one, so the author predicate is on the update itself and again in the
  // posts_guard_update trigger. Filtering here turns the common case into a
  // clean zero-row result instead of a raised database exception.
  const { data: updated, error } = await supabase
    .from("posts")
    .update({ body: body.trim(), edited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("author_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return { error: postgresMessage(error, "That message could not be updated.") };
  if (!updated) return { error: "Only the author can edit this message." };
  revalidateCommunity();
  return { success: true };
}

export async function togglePostHighlight(postId: string): Promise<Result> {
  if (!uuid(postId)) return { error: "Invalid post identifier." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to manage messages." };
  const { data: post, error: postError } = await supabase.from("posts").select("is_pinned,channel_id").eq("id", postId).eq("is_deleted", false).maybeSingle();
  if (postError || !post) return { error: "Message not found." };
  // `pin_messages` on that channel — the same question posts_guard_update asks.
  const { data: allowed, error: permissionError } = await supabase.rpc("community_has", { permission: "pin_messages", channel: post.channel_id });
  if (permissionError) return { error: postgresMessage(permissionError, "Your permissions could not be checked.") };
  if (allowed !== true) return { error: "You do not have permission to pin messages here." };
  const highlighted = !post.is_pinned;
  const { error } = await supabase.from("posts").update({ is_pinned: highlighted, pinned_at: highlighted ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", postId);
  if (error) return { error: postgresMessage(error, "That message could not be updated.") };
  revalidateCommunity();
  return { success: true };
}

export async function deleteMessage(postId: string): Promise<Result> {
  if (!uuid(postId)) return { error: "Invalid post identifier." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to delete." };

  // `soft_delete_post` re-checks author-or-manage_messages itself and raises a
  // P0001 the client can read, so there is nothing useful to pre-check here.
  const { data: deleted, error } = await supabase.rpc("soft_delete_post", { target_post_id: postId });
  if (error) return { error: postgresMessage(error, "That message could not be deleted.") };
  if (!deleted) return { error: "Message not found or it has already been deleted." };
  revalidateCommunity();
  refresh();
  return { success: true };
}

// --------------------------------------------------------------- messaging
// The write half of the model added in 20260912070000.
//
// `sendMessage` above is deliberately untouched. It inserts directly and
// writes `posts.image_url`, which is what the legacy `MessageStream` reads;
// routing it through the RPC would stop images rendering in the only working
// community UI. Phase P1 deletes that composer and this becomes the only path.

/**
 * Send through `community_send_message`.
 *
 * The RPC evaluates AutoMod *before* it inserts, which is why a blocked
 * message can come back as a reason instead of an exception: the alert and any
 * timeout have already been recorded by the time this returns.
 */
export async function sendChannelMessage(input: {
  channelId: string;
  body?: string;
  replyToPostId?: string;
  threadId?: string;
  attachments?: { path: string; mimeType: string; byteSize: number; width?: number; height?: number }[];
  clientNonce?: string;
}): Promise<Result & { postId?: string; blocked?: string }> {
  if (!uuid(input.channelId)) return { error: "Invalid channel." };
  if (input.replyToPostId && !uuid(input.replyToPostId)) return { error: "Invalid message." };
  if (input.threadId && !uuid(input.threadId)) return { error: "Invalid thread." };
  if ((input.body ?? "").length > MESSAGE_MAX_CHARS) {
    return { error: `Messages are limited to ${MESSAGE_MAX_CHARS.toLocaleString("en-US")} characters.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_send_message", {
    channel: input.channelId,
    body: input.body ?? null,
    reply_to: input.replyToPostId ?? null,
    thread: input.threadId ?? null,
    attachments: input.attachments ?? [],
    client_nonce: input.clientNonce ?? null,
  });
  if (error) return { error: postgresMessage(error, "That message could not be sent.") };

  const row = (data as { post_id: string | null; blocked_reason: string | null }[] | null)?.[0];
  // A block is not an error: the member's message was read, judged and
  // refused, and the interface says so rather than showing a failure.
  if (row?.blocked_reason) return { success: true, blocked: row.blocked_reason };

  revalidateCommunity();
  return { success: true, postId: row?.post_id ?? undefined };
}

export async function createThread(postId: string, name: string): Promise<Result & { threadId?: string }> {
  if (!uuid(postId)) return { error: "Invalid message." };
  const trimmed = name.trim();
  if (trimmed.length < THREAD_NAME_LIMITS.min || trimmed.length > THREAD_NAME_LIMITS.max) {
    return { error: `A thread name must be between ${THREAD_NAME_LIMITS.min} and ${THREAD_NAME_LIMITS.max} characters.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_thread_create", { root_post: postId, thread_name: trimmed });
  if (error) return { error: postgresMessage(error, "That thread could not be started.") };

  revalidateCommunity();
  return { success: true, threadId: data as string };
}

export async function setThreadState(
  threadId: string,
  state: { archived?: boolean; locked?: boolean },
): Promise<Result> {
  if (!uuid(threadId)) return { error: "Invalid thread." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("community_thread_set", {
    thread: threadId,
    archived: state.archived ?? null,
    is_locked: state.locked ?? null,
  });
  if (error) return { error: postgresMessage(error, "That thread could not be updated.") };

  revalidateCommunity();
  return { success: true };
}

/**
 * Mark a channel read.
 *
 * Deliberately does not revalidate: phase P3 calls this from the browser on a
 * debounce as the member scrolls, and revalidating the route on every scroll
 * stop would re-render the whole page against the server.
 */
export async function markChannelRead(channelId: string, lastPostId?: string): Promise<Result> {
  if (!uuid(channelId)) return { error: "Invalid channel." };
  if (lastPostId && !uuid(lastPostId)) return { error: "Invalid message." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("community_mark_read", {
    channel: channelId,
    last_post: lastPostId ?? null,
  });
  if (error) return { error: postgresMessage(error, "That channel could not be marked read.") };
  return { success: true };
}

export async function setChannelNotificationLevel(
  channelId: string,
  level: ChannelNotificationLevel,
  mutedUntil?: string,
): Promise<Result> {
  if (!uuid(channelId)) return { error: "Invalid channel." };
  if (!(CHANNEL_NOTIFICATION_LEVELS as readonly string[]).includes(level)) {
    return { error: "That is not a notification level." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("community_set_channel_notification", {
    channel: channelId,
    notification_level: level,
    mute_until: mutedUntil ?? null,
  });
  if (error) return { error: postgresMessage(error, "That preference could not be saved.") };

  revalidateCommunity();
  return { success: true };
}
