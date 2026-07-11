import { FeedScreen } from "@/components/screens/AskStoicScreens";
import { requireActiveMembership } from "@/lib/supabase/access";

export default async function CommunityPage() {
  const { supabase, user } = await requireActiveMembership("/community");
  const [profileResult, tierResult] = await Promise.all([
    supabase.from("profiles").select("platform_role").eq("id", user.id).maybeSingle(),
    supabase.from("member_tiers").select("is_master").eq("user_id", user.id).maybeSingle(),
  ]);

  if (profileResult.error || tierResult.error) {
    throw new Error("Unable to load role access.");
  }

  const profile = profileResult.data;
  const canCreateChannels = profile?.platform_role === "influencer";
  const canPost = canCreateChannels || profile?.platform_role === "moderator";
  const isMaster = tierResult.data?.is_master ?? false;

  return <FeedScreen isMaster={isMaster} canCreateChannels={canCreateChannels} canPost={canPost} />;
}
