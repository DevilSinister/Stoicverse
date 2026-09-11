"use server";

import { refresh } from "next/cache";

import { isValidReactionToken, MESSAGE_MAX_CHARS } from "@/lib/community/constants";
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

export async function createStaffPost(data: FormData): Promise<Result> {
  const channelId = typeof data.get("channelId") === "string" ? String(data.get("channelId")) : "";
  const body = typeof data.get("body") === "string" ? String(data.get("body")).trim() : "";
  const attachmentPath = typeof data.get("attachmentPath") === "string" ? String(data.get("attachmentPath")) : "";
  if (!uuid(channelId) || (!body && !attachmentPath) || body.length > MESSAGE_MAX_CHARS) return { error: `Write a post or attach media (up to ${MESSAGE_MAX_CHARS.toLocaleString("en-US")} characters).` };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to post." };
  if (attachmentPath && (!attachmentPath.startsWith(`${user.id}/`) || attachmentPath.includes(".."))) return { error: "Invalid attachment." };
  const { data: profile, error: profileError } = await supabase.from("profiles").select("platform_role,is_suspended").eq("id", user.id).maybeSingle();
  if (profileError || !profile || profile.is_suspended || !["moderator", "influencer", "super_admin"].includes(profile.platform_role)) return { error: "Moderator or influencer access is required." };
  const { data: channel, error: channelError } = await supabase.from("channels").select("type").eq("id", channelId).maybeSingle();
  if (channelError || !channel) return { error: "You cannot post in this channel." };
  const { error } = await supabase.from("posts").insert({ channel_id: channelId, author_id: user.id, body: body || null, image_url: attachmentPath || null, post_type: channel.type === "announcements" ? "announcement" : "post" });
  if (error) return { error: postgresMessage(error, "That post could not be published.") };

  revalidateCommunity();
  return { success: true };
}

export async function editStaffPost(postId: string, body: string): Promise<Result> {
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
    .update({ body: body.trim(), updated_at: new Date().toISOString() })
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
  const { data: profile, error: profileError } = await supabase.from("profiles").select("platform_role,is_suspended").eq("id", user.id).maybeSingle();
  if (profileError || !profile || profile.is_suspended || !["moderator", "influencer", "super_admin"].includes(profile.platform_role)) return { error: "Moderator or influencer access is required." };
  const { data: post, error: postError } = await supabase.from("posts").select("is_pinned").eq("id", postId).eq("is_deleted", false).maybeSingle();
  if (postError || !post) return { error: "Message not found." };
  const highlighted = !post.is_pinned;
  const { error } = await supabase.from("posts").update({ is_pinned: highlighted, pinned_at: highlighted ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", postId);
  if (error) return { error: postgresMessage(error, "That message could not be updated.") };
  revalidateCommunity();
  return { success: true };
}

export async function deleteStaffPost(postId: string): Promise<Result> {
  if (!uuid(postId)) return { error: "Invalid post identifier." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to delete." };

  const { data: profile, error: profileError } = await supabase.from("profiles").select("platform_role,is_suspended").eq("id", user.id).maybeSingle();
  if (profileError || !profile || profile.is_suspended || !["moderator", "influencer", "super_admin"].includes(profile.platform_role)) {
    return { error: "Moderator or influencer access is required." };
  }

  const { data: deleted, error } = await supabase.rpc("soft_delete_post", { target_post_id: postId });
  if (error) return { error: postgresMessage(error, "That message could not be deleted.") };
  if (!deleted) return { error: "Message not found or it has already been deleted." };
  revalidateCommunity();
  refresh();
  return { success: true };
}
