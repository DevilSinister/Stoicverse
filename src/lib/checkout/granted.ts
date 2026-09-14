import type { Product } from "@/lib/checkout/plans";
import { createClient } from "@/lib/supabase/server";

/**
 * Has the thing that was paid for actually been granted yet?
 *
 * Payment and access are two events, not one. Stripe redirects the browser back
 * the instant the card clears; the webhook that writes the membership row is a
 * separate request from Stripe's side, and it can lose that race. Every surface
 * that asks "can this person in yet" during those seconds has to ask the
 * database rather than assume, which is what this is for.
 *
 * Read by both the success page's first render and the action it polls with, so
 * the two cannot answer the question differently. It deliberately does not go
 * through `membershipState` in `lib/supabase/access.ts`: that one is wrapped in
 * React's `cache`, which is exactly right for a guard answering once per request
 * and exactly wrong for a poll, which needs a fresh answer each time it asks.
 */
export async function accessGranted(product: Product): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  if (product === "mentorship") {
    const { data } = await supabase
      .from("mentorships")
      .select("status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    return Boolean(data);
  }

  const { data } = await supabase
    .from("memberships")
    .select("expires_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!data) return false;
  // A row with no expiry is a membership that does not lapse — the same reading
  // requireActiveMembership uses, so the two cannot disagree about one account.
  return !data.expires_at || new Date(data.expires_at) > new Date();
}
