import { SubscriptionScreen } from "@/components/screens/AskStoicScreens";
import { requireActiveMembership } from "@/lib/supabase/access";

export default async function SubscriptionPage() {
  await requireActiveMembership("/subscription");

  return <SubscriptionScreen />;
}
