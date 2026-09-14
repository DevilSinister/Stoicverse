import { redirect } from "next/navigation";

import { CheckoutScreen, type PlanOffer } from "@/components/checkout/CheckoutScreen";
import { PURCHASES, isMembershipPlan } from "@/lib/checkout/plans";
import { isConfigured, priceFor } from "@/lib/stripe/prices";
import { createClient } from "@/lib/supabase/server";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const product = params.product === "mentorship" ? "mentorship" : "membership";
  const cancelled = params.checkout === "cancelled";
  const requestedPlan = isMembershipPlan(params.plan) ? params.plan : null;

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

  /*
    Offer only what can actually be bought.

    A plan with no price id in the environment is filtered out here rather than
    rendered and refused at the last step — that is the difference between a
    term that has not been set up yet and a button that fails after the reader
    has committed to pressing it. The amount comes from Stripe, so the figure on
    the screen is the figure on the receipt.
  */
  const offers = await Promise.all(
    PURCHASES.filter((purchase) => purchase.product === product && isConfigured(purchase)).map(
      async (purchase): Promise<PlanOffer> => ({
        plan: purchase.plan,
        cadence: purchase.cadence,
        amount: (await priceFor(purchase))?.amount ?? null,
      }),
    ),
  );

  const initialPlan = offers.some((offer) => offer.plan === requestedPlan)
    ? requestedPlan
    : (offers[0]?.plan ?? null);

  return (
    <CheckoutScreen
      product={product}
      plans={offers}
      initialPlan={initialPlan}
      email={user.email}
      cancelled={cancelled}
    />
  );
}
