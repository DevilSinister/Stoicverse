import { CommunitySurface, type CommunityCategory, type CommunityChannel, type CommunityPost } from "@/components/community/CommunitySurface";
import { requireActiveMembership, requireInfluencerWorkspace } from "@/lib/supabase/access";

export type CommunityWorkspace = "member" | "creator";

type CommunityWorkspaceOptions = { nextPath: string; workspace: CommunityWorkspace; selectedChannelId?: string };
type DirectoryRow = { category_id: string; category_name: string; category_description: string | null; category_sort_order: number; channel_id: string; channel_name: string; channel_type: string; channel_description: string | null; channel_sort_order: number; min_tier: number; is_locked: boolean };
type CategoryRow = { id: string; name: string; description: string | null; sort_order: number; default_min_tier: number; default_allowed_roles: string[]; default_visibility_mode: string; is_archived: boolean };
type ChannelRow = { id: string; category_id: string; name: string; type: string; description: string | null; sort_order: number; min_tier: number; allowed_roles: string[]; visibility_mode: string; is_archived: boolean };
type QueryResult<T> = { data: T[] | null; error: { message: string } | null };

const capabilities = {
  member: { routeBase: "/dashboard", activeNavigationLabel: "Communities" },
  creator: { routeBase: "/creator", activeNavigationLabel: "Channels" },
} as const;

/** Shared member/creator loader. Creator receives structure controls; members receive only the safe directory RPC. */
export async function renderCommunityWorkspace({ nextPath, workspace, selectedChannelId }: CommunityWorkspaceOptions) {
  const { supabase, user } = workspace === "creator" ? await requireInfluencerWorkspace(nextPath) : await requireActiveMembership(nextPath);
  const capability = capabilities[workspace];
  const [profileResult, tierResult, notificationResult] = await Promise.all([
    supabase.from("profiles").select("full_name, platform_role").eq("id", user.id).maybeSingle(),
    supabase.from("member_tiers").select("current_tier, is_master").eq("user_id", user.id).maybeSingle(),
    supabase.from("notifications").select("id, type, title, body, action_url, is_read, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
  ]);

  if (profileResult.error || tierResult.error || notificationResult.error) throw new Error("Unable to load community data.");
  let categories: CommunityCategory[] = [];
  let channels: CommunityChannel[] = [];
  if (workspace === "creator") {
    const [categoryResult, channelResult] = await Promise.all([
      supabase.from("channel_categories").select("id,name,description,sort_order,default_min_tier,default_allowed_roles,default_visibility_mode,is_archived").order("sort_order"),
      supabase.from("channels").select("id,category_id,name,type,description,sort_order,min_tier,allowed_roles,visibility_mode,is_archived").order("sort_order"),
    ]);
    if (categoryResult.error || channelResult.error) throw new Error("Unable to load channel structure.");
    categories = (categoryResult.data ?? []).map((category) => ({ id: category.id, name: category.name, description: category.description, sortOrder: category.sort_order, minTier: category.default_min_tier, allowedRoles: category.default_allowed_roles, visibilityMode: category.default_visibility_mode as "locked" | "hidden", isArchived: category.is_archived }));
    channels = (channelResult.data ?? []).map((channel) => ({ id: channel.id, categoryId: channel.category_id, name: channel.name, type: channel.type, description: channel.description, sortOrder: channel.sort_order, minTier: channel.min_tier, allowedRoles: channel.allowed_roles, visibilityMode: channel.visibility_mode as "locked" | "hidden", isArchived: channel.is_archived, isLocked: false }));
  } else {
    const directory = await supabase.rpc("community_channel_directory");
    if (directory.error) throw new Error("Unable to load channel directory.");
    const categoryById = new Map<string, CommunityCategory>();
    for (const row of directory.data ?? []) {
      if (!categoryById.has(row.category_id)) categoryById.set(row.category_id, { id: row.category_id, name: row.category_name, description: row.category_description, sortOrder: row.category_sort_order, minTier: 1, allowedRoles: ["member"], visibilityMode: "locked", isArchived: false });
      channels.push({ id: row.channel_id, categoryId: row.category_id, name: row.channel_name, type: row.channel_type, description: row.channel_description, sortOrder: row.channel_sort_order, minTier: row.min_tier, allowedRoles: [], visibilityMode: "locked", isArchived: false, isLocked: row.is_locked });
    }
    categories = [...categoryById.values()];
  }
  const permittedChannelIds = channels.filter((channel) => !channel.isLocked && !channel.isArchived).map((channel) => channel.id);
  const { data: postRows, error: postError } = permittedChannelIds.length
    ? await supabase.from("posts").select("id,channel_id,body,image_url,is_pinned,created_at,profiles!posts_author_id_fkey(full_name),reactions(emoji,user_id)").in("channel_id", permittedChannelIds).eq("is_deleted", false).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(100)
    : { data: [], error: null };
  if (postError) throw new Error("Unable to load channel posts.");
  const rawPosts = postRows ?? [];
  const attachmentPaths = rawPosts.map((post) => post.image_url).filter((path): path is string => Boolean(path && !path.startsWith("http")));
  const { data: signedAttachments } = attachmentPaths.length ? await supabase.storage.from("community-posts").createSignedUrls(attachmentPaths, 60 * 60) : { data: [] };
  const signedAttachmentByPath = new Map((signedAttachments ?? []).map((attachment, index) => [attachmentPaths[index], attachment.signedUrl]));
  const posts: CommunityPost[] = rawPosts.map((post) => {
    const authorProfile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
    
    const rawReactions = (post.reactions as { emoji: string; user_id: string }[]) ?? [];
    const reactionMap = new Map<string, { count: number; userReacted: boolean }>();
    rawReactions.forEach((r) => {
      const current = reactionMap.get(r.emoji) ?? { count: 0, userReacted: false };
      reactionMap.set(r.emoji, {
        count: current.count + 1,
        userReacted: current.userReacted || r.user_id === user.id,
      });
    });
    const postReactions = [...reactionMap.entries()].map(([emoji, data]) => ({
      emoji,
      count: data.count,
      userReacted: data.userReacted,
    }));

    return {
      id: post.id,
      channelId: post.channel_id,
      authorName: authorProfile?.full_name?.trim() || "Community staff",
      body: post.body,
      imageUrl: post.image_url ? (post.image_url.startsWith("http") ? post.image_url : signedAttachmentByPath.get(post.image_url) ?? null) : null,
      createdAt: post.created_at,
      isPinned: post.is_pinned,
      reactions: postReactions,
    };
  });
  const platformRole = profileResult.data?.platform_role ?? "member";
  return <CommunitySurface workspace={workspace} currentUserId={user.id} memberName={profileResult.data?.full_name?.trim() || "Practitioner"} platformRole={platformRole} currentTier={tierResult.data?.current_tier ?? 1} isMaster={tierResult.data?.is_master ?? false} canModeratePosts={["moderator", "influencer", "super_admin"].includes(platformRole)} notifications={notificationResult.data ?? []} routeBase={capability.routeBase} activeNavigationLabel={capability.activeNavigationLabel} selectedChannelId={selectedChannelId} categories={categories} channels={channels} posts={posts} />;
}
