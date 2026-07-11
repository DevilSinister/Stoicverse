import { FeedScreen } from "@/components/screens/AskStoicScreens";
import { requireMasterMembership } from "@/lib/supabase/access";

export default async function MasterPage() {
  await requireMasterMembership("/master");

  return <FeedScreen master isMaster />;
}
