import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CheckoutScreen } from "@/components/screens/AskStoicScreens";
import { createClient } from "@/lib/supabase/server";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const product = params.product;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/checkout");
  }

  // If we are checking out standard membership (default), check if already active
  if (product !== "mentorship" && product !== "annual") {
    const cookieStore = await cookies();
    const hasLocalActive = cookieStore.get("stoicverse_membership_active")?.value === "true";

    if (hasLocalActive) {
      redirect("/dashboard");
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
  }

  return <CheckoutScreen />;
}
