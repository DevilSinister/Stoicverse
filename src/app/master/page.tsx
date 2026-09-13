import { FeedScreen } from "@/components/screens/AskStoicScreens";
import { signAttachmentUrls } from "@/lib/channels/attachment-urls";
import { requireInfluencerMasterWorkspace, requireMasterMembership } from "@/lib/supabase/access";
import { profileRow } from "@/lib/supabase/viewer";

type MasterPageOptions = {
  nextPath?: string;
  routeBase?: string;
  creatorWorkspace?: boolean;
  defaultPlatformRole?: string;
};

type AttachmentRow = { path: string; position: number };

export async function renderMasterPage({
  nextPath = "/master",
  routeBase = "",
  creatorWorkspace = false,
  defaultPlatformRole = "member",
}: MasterPageOptions = {}) {
  const { supabase, user } = creatorWorkspace
    ? await requireInfluencerMasterWorkspace(nextPath)
    : await requireMasterMembership(nextPath);
  const [profileResult, tierResult, channelsResult, postsResult, notificationsResult] = await Promise.all([
    profileRow(),
    supabase.from("member_tiers").select("current_tier").eq("user_id", user.id).maybeSingle(),
    supabase.from("channels").select("id, name, type, description").eq("is_active", true).eq("type", "master").order("sort_order"),
    // `post_attachments` since phase 9, which dropped `posts.image_url`. The old
    // column held a bare storage path rendered straight into a link, and
    // `community-posts` is private — so that link answered 400 for every object
    // it ever pointed at. Signing is what makes it openable.
    supabase.from("posts").select("id, body, is_pinned, created_at, channels!posts_channel_id_fkey(name, type), profiles!posts_author_id_fkey(full_name), post_attachments(path, position), reactions(id)").eq("is_deleted", false).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(50),
    supabase.from("notifications").select("id, type, title, body, action_url, is_read, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
  ]);

  if ([profileResult, tierResult, channelsResult, postsResult, notificationsResult].some((result) => result.error)) {
    throw new Error("Unable to load master community data.");
  }

  // The master feed is one channel type, so filter before signing: a page that
  // shows no master posts should not be minting URLs for the events channel.
  const rows = (postsResult.data ?? []).filter((post) => (post.channels?.[0]?.type ?? "text") === "master");
  const firstAttachmentOf = (post: { post_attachments?: AttachmentRow[] | null }) =>
    [...(post.post_attachments ?? [])].sort((a, b) => a.position - b.position)[0] ?? null;
  const signed = await signAttachmentUrls(
    supabase,
    rows.map((post) => firstAttachmentOf(post)?.path).filter((path): path is string => Boolean(path)),
  );

  const posts = rows.map((post) => {
    const channel = post.channels?.[0];
    const author = post.profiles?.[0];
    const attachment = firstAttachmentOf(post);
    return {
      id: post.id,
      authorName: author?.full_name?.trim() || "Community member",
      body: post.body,
      imageUrl: attachment ? signed.get(attachment.path) ?? null : null,
      createdAt: post.created_at,
      isPinned: post.is_pinned,
      reactionCount: post.reactions?.length ?? 0,
      channelName: channel?.name ?? "master-zone",
      channelType: channel?.type ?? "text",
    };
  });

  return <FeedScreen master isMaster memberName={profileResult.data?.full_name?.trim() || "Practitioner"} platformRole={profileResult.data?.platform_role ?? defaultPlatformRole} currentTier={tierResult.data?.current_tier ?? 5} notifications={notificationsResult.data ?? []} channels={channelsResult.data ?? []} posts={posts} routeBase={routeBase} />;
}

export default async function MasterPage() {
  return renderMasterPage();
}
