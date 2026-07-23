"use server";

import { refresh, revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; success?: true; reactionAdded?: boolean };
const uuid = (candidate: string) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(candidate);

export async function toggleReaction(postId: string, emoji: string): Promise<Result> {
  if (!uuid(postId) || !["👍", "❤️", "🔥", "💡", "👏", "🎉", "🚀", "👀", "😮", "😢", "💯", "🙏"].includes(emoji)) return { error: "Invalid reaction." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to react." };
  const { data: existing, error: readError } = await supabase.from("reactions").select("id").eq("post_id", postId).eq("user_id", user.id).eq("emoji", emoji).maybeSingle();
  if (readError) return { error: readError.message };
  const { error } = existing
    ? await supabase.from("reactions").delete().eq("id", existing.id)
    : await supabase.from("reactions").insert({ post_id: postId, user_id: user.id, emoji });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/community");
  revalidatePath("/creator/channels");
  revalidatePath("/creator/community");
  return { success: true, reactionAdded: !existing };
}

export async function createStaffPost(data: FormData): Promise<Result> {
  const channelId = typeof data.get("channelId") === "string" ? String(data.get("channelId")) : "";
  const body = typeof data.get("body") === "string" ? String(data.get("body")).trim() : "";
  const attachmentPath = typeof data.get("attachmentPath") === "string" ? String(data.get("attachmentPath")) : "";
  if (!uuid(channelId) || (!body && !attachmentPath) || body.length > 10_000) return { error: "Write a post or attach media (up to 10,000 characters)." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to post." };
  if (attachmentPath && (!attachmentPath.startsWith(`${user.id}/`) || attachmentPath.includes(".."))) return { error: "Invalid attachment." };
  const { data: profile, error: profileError } = await supabase.from("profiles").select("full_name,platform_role,is_suspended").eq("id", user.id).maybeSingle();
  if (profileError || !profile || profile.is_suspended || !["moderator", "influencer", "super_admin"].includes(profile.platform_role)) return { error: "Moderator or influencer access is required." };
  const { data: channel, error: channelError } = await supabase.from("channels").select("name,type").eq("id", channelId).maybeSingle();
  if (channelError || !channel) return { error: "You cannot post in this channel." };
  const { data: newPost, error } = await supabase.from("posts").insert({ channel_id: channelId, author_id: user.id, body: body || null, image_url: attachmentPath || null, post_type: channel.type === "announcements" ? "announcement" : "post" }).select("id").maybeSingle();
  if (error) return { error: error.message };

  // Dispatch mention notifications if body contains @
  if (body.includes("@")) {
    const authorName = profile.full_name?.trim() || "Community Staff";
    const postSnippet = body.length > 80 ? `${body.slice(0, 80)}…` : body;

    // Check for @all or @tier-X
    const lowerBody = body.toLowerCase();
    const hasAll = lowerBody.includes("@all");
    const tierMatches = lowerBody.match(/@tier-(\d+)/g);
    const targetTiers = tierMatches ? tierMatches.map((t) => parseInt(t.replace("@tier-", ""), 10)).filter((num) => !isNaN(num) && num >= 1 && num <= 5) : [];

    let targetUserIds: string[] = [];

    if (hasAll) {
      const { data: allProfiles } = await supabase.from("profiles").select("id").neq("id", user.id).limit(200);
      if (allProfiles) targetUserIds = allProfiles.map((p) => p.id);
    } else if (targetTiers.length > 0) {
      const minTier = Math.min(...targetTiers);
      const { data: tierMembers } = await supabase.from("member_tiers").select("user_id").gte("current_tier", minTier).neq("user_id", user.id).limit(200);
      if (tierMembers) targetUserIds = tierMembers.map((m) => m.user_id);
    }

    if (targetUserIds.length > 0) {
      const notificationRows = targetUserIds.map((targetId) => ({
        user_id: targetId,
        type: "community_mention",
        title: `Mentioned in #${channel.name}`,
        body: `${authorName}: "${postSnippet}"`,
        action_url: `/dashboard/community?channel=${channelId}`,
      }));
      await supabase.from("notifications").insert(notificationRows);
    }
  }

  revalidatePath("/dashboard/community");
  revalidatePath("/creator/channels");
  revalidatePath("/creator/community");
  revalidatePath("/creator/community");
  return { success: true };
}

export async function editStaffPost(postId: string, body: string): Promise<Result> {
  if (!uuid(postId) || !body.trim() || body.length > 10_000) return { error: "Write a valid post body (up to 10,000 characters)." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to edit." };
  
  const { data: profile, error: profileError } = await supabase.from("profiles").select("platform_role,is_suspended").eq("id", user.id).maybeSingle();
  if (profileError || !profile || profile.is_suspended || !["moderator", "influencer", "super_admin"].includes(profile.platform_role)) {
    return { error: "Moderator or influencer access is required." };
  }

  const { error } = await supabase.from("posts").update({ body: body.trim(), updated_at: new Date().toISOString() }).eq("id", postId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/community");
  revalidatePath("/creator/channels");
  revalidatePath("/creator/community");
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
  if (error) return { error: error.message };
  revalidatePath("/dashboard/community");
  revalidatePath("/creator/channels");
  revalidatePath("/creator/community");
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
  if (error) return { error: error.message };
  if (!deleted) return { error: "Message not found or it has already been deleted." };
  revalidatePath("/dashboard/community");
  revalidatePath("/creator/channels");
  revalidatePath("/creator/community");
  refresh();
  return { success: true };
}
