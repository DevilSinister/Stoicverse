import { redirect } from "next/navigation";

import { CheckoutScreen } from "@/components/checkout/CheckoutScreen";
import { createClient } from "@/lib/supabase/server";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const product = params.product === "mentorship" ? "mentorship" : "membership";
  const cancelled = params.checkout === "cancelled";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/checkout");
  }

  // Only the recurring membership can already be owned; mentorship is a
  // separate purchase and is not gated on an existing membership.
  if (product === "membership") {
    const { data: membership, error } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Membership Error in checkout:", error);
      throw new Error("Unable to validate membership.");
    }

    if (membership) {
      redirect("/dashboard");
    }
  }

  return <CheckoutScreen product={product} email={user.email} cancelled={cancelled} />;
}
