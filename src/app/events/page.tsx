import { EventsScreen } from "@/components/screens/AskStoicScreens";
import { requireActiveMembership } from "@/lib/supabase/access";

export default async function EventsPage() {
  const { supabase, user } = await requireActiveMembership("/events");
  const { data: tier, error } = await supabase
    .from("member_tiers")
    .select("is_master")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load event access.");
  }

  return <EventsScreen isMaster={tier?.is_master ?? false} />;
}
