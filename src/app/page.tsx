import { redirect } from "next/navigation";

import { LandingScreen } from "@/components/screens/AskStoicScreens";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    redirect(membership ? "/dashboard" : "/checkout");
  }

  return <LandingScreen />;
}
