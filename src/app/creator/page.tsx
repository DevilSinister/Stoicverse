import { CreatorScreen } from "@/components/screens/AskStoicScreens";
import { requirePlatformRole } from "@/lib/supabase/access";

export default async function CreatorPage() {
  await requirePlatformRole("influencer");

  return <CreatorScreen />;
}
