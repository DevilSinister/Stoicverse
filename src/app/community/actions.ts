"use server";

import { refresh } from "next/cache";

import {
  CHANNEL_NOTIFICATION_LEVELS,
  FORWARD_CHANNEL_LIMIT,
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

export async function toggleMessagePin(postId: string): Promise<Result> {
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

export async function deleteMessage(postId: string, reason?: string): Promise<Result> {
  if (!uuid(postId)) return { error: "Invalid post identifier." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to delete." };

  // A reason is what turns a deletion into a moderation case: `soft_delete_post`
  // puts it in `app.moderation_reason`, which the logging trigger reads. Passing
  // nothing is how an author deleting their own message stays out of the case log.
  const clean = typeof reason === "string" ? reason.trim() : "";
  if (clean !== "" && (clean.length < 3 || clean.length > 500)) {
    return { error: "A deletion reason must be between 3 and 500 characters." };
  }

  // `soft_delete_post` re-checks author-or-manage_messages itself and raises a
  // P0001 the client can read, so there is nothing useful to pre-check here.
  const { data: deleted, error } = await supabase.rpc("soft_delete_post", {
    target_post_id: postId,
    delete_reason: clean === "" ? null : clean,
  });
  if (error) return { error: postgresMessage(error, "That message could not be deleted.") };
  if (!deleted) return { error: "Message not found or it has already been deleted." };
  revalidateCommunity();
  refresh();
  return { success: true };
}

// --------------------------------------------------------------- messaging
// The write half of the model added in 20260912070000, and since phase 9 the
// only way a message is written. The legacy `sendMessage` that inserted into
// `posts` directly and wrote `posts.image_url` is gone with the composer that
// called it, so every message now passes AutoMod before it is inserted rather
// than after.

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
  attachments?: {
    path: string;
    mimeType: string;
    byteSize: number;
    width?: number;
    height?: number;
    /** Audio and video only; the recorder's own measurement, carried for the player. */
    durationSeconds?: number;
  }[];
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

/** One channel's outcome. `postId` is set when it landed, `failure` when it did not. */
export type ForwardOutcome = { channelId: string; postId: string | null; failure: string | null };

/**
 * Forward one message into several channels at once.
 *
 * Partial success is the normal case rather than the exception — slow mode in
 * one channel, no `send_messages` in another — so this returns a row per
 * channel instead of a single error. The RPC runs each target in its own
 * sub-transaction for the same reason: one refusal must not take the others
 * down with it.
 */
export async function forwardMessage(
  sourcePostId: string,
  channelIds: string[],
  note?: string,
): Promise<Result & { outcomes?: ForwardOutcome[] }> {
  if (!uuid(sourcePostId)) return { error: "Invalid message." };
  const targets = [...new Set(channelIds)];
  if (targets.length === 0) return { error: "Choose at least one channel." };
  if (targets.length > FORWARD_CHANNEL_LIMIT) {
    return { error: `A message can be forwarded to at most ${FORWARD_CHANNEL_LIMIT} channels at once.` };
  }
  if (targets.some((id) => !uuid(id))) return { error: "Invalid channel." };
  if ((note ?? "").length > MESSAGE_MAX_CHARS) {
    return { error: `Messages are limited to ${MESSAGE_MAX_CHARS.toLocaleString("en-US")} characters.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_forward_message", {
    source_post: sourcePostId,
    targets,
    note: note?.trim() ? note.trim() : null,
  });
  if (error) return { error: postgresMessage(error, "That message could not be forwarded.") };

  const rows = (data as { channel_id: string; post_id: string | null; failure: string | null }[] | null) ?? [];
  revalidateCommunity();
  return {
    success: true,
    outcomes: rows.map((row) => ({
      channelId: row.channel_id,
      postId: row.post_id,
      failure: row.failure,
    })),
  };
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


/**
 * Accept the rules as they currently stand.
 *
 * The version is decided by the database, not sent from here: a client that
 * chose its own could accept a version that has since been replaced, and the
 * whole point of versioning the rules is that editing them asks again.
 *
 * `refresh` rather than `revalidateCommunity`: accepting changes what *this*
 * member may do, and nothing about what anybody else sees.
 */
export async function acceptRules(): Promise<Result & { version?: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_accept_rules");
  if (error) return { error: postgresMessage(error, "The rules could not be accepted.") };
  refresh();
  return { success: true, version: typeof data === "number" ? data : undefined };
}
