import { CommitmentScreen } from "@/components/screens/AskStoicScreens";
import { requireActiveMembership } from "@/lib/supabase/access";

export default async function CommitmentPage() {
  await requireActiveMembership("/subscription/commitment");

  return <CommitmentScreen />;
}
