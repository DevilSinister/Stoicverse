import { FeedScreen } from "@/components/screens/AskStoicScreens";
import { requireInfluencerWorkspace } from "@/lib/supabase/access";

export default async function CreatorPage() {
  const { supabase, user } = await requireInfluencerWorkspace("/creator");
  const [profileResult, tierResult, channelsResult, postsResult, notificationsResult] = await Promise.all([
    supabase.from("profiles").select("full_name, platform_role").eq("id", user.id).maybeSingle(),
    supabase.from("member_tiers").select("current_tier, is_master").eq("user_id", user.id).maybeSingle(),
    supabase.from("channels").select("id, name, type, description").eq("is_active", true).order("sort_order"),
    supabase.from("posts").select("id, body, image_url, post_type, is_pinned, created_at, channels!posts_channel_id_fkey(name, type), profiles!posts_author_id_fkey(full_name), reactions(id)").eq("is_deleted", false).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(50),
    supabase.from("notifications").select("id, type, title, body, action_url, is_read, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
  ]);

  if ([profileResult, tierResult, channelsResult, postsResult, notificationsResult].some((result) => result.error)) {
    throw new Error("Unable to load creator community data.");
  }

  const isMaster = tierResult.data?.is_master ?? false;
  const channels = (channelsResult.data ?? []).filter((channel) => isMaster || channel.type !== "master");
  const posts = (postsResult.data ?? [])
    .map((post) => {
      const channel = post.channels?.[0];
      const author = post.profiles?.[0];
      return {
        id: post.id,
        authorName: author?.full_name?.trim() || "Community member",
        body: post.body,
        imageUrl: post.image_url,
        createdAt: post.created_at,
        isPinned: post.is_pinned,
        reactionCount: post.reactions?.length ?? 0,
        channelName: channel?.name ?? "community",
        channelType: channel?.type ?? "text",
      };
    })
    .filter((post) => isMaster || post.channelType !== "master");

  return <FeedScreen memberName={profileResult.data?.full_name?.trim() || "Practitioner"} platformRole={profileResult.data?.platform_role ?? "influencer"} currentTier={tierResult.data?.current_tier ?? 1} isMaster={isMaster} notifications={notificationsResult.data ?? []} channels={channels} posts={posts} routeBase="/creator" />;
}
