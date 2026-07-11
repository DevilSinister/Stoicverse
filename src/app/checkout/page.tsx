import { redirect } from "next/navigation";

import { CheckoutScreen } from "@/components/screens/AskStoicScreens";
import { createClient } from "@/lib/supabase/server";

export default async function CheckoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/checkout");
  }

  const { data: membership, error } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to validate membership.");
  }

  if (membership) {
    redirect("/dashboard");
  }

  return <CheckoutScreen />;
}
