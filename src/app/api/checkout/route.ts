import { NextResponse } from "next/server";

import { findPurchase, isMembershipPlan, isProduct, type MembershipPlan } from "@/lib/checkout/plans";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited, rejectUntrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;

  let body: { product?: unknown; plan?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 }); }
  if (!isProduct(body.product)) return NextResponse.json({ error: "Unknown checkout product" }, { status: 400 });
  const product = body.product;

  /*
    An unrecognised plan is refused, not coerced.

    Defaulting an unknown plan to monthly is how a request for a twelve-month
    membership becomes a one-month charge that nobody can see from the receipt.
    The one default that is safe is the absent one: a client that sends no plan
    at all predates the choice and means monthly.
  */
  let plan: MembershipPlan | null = null;
  if (product === "membership") {
    if (body.plan === undefined || body.plan === null) plan = "monthly";
    else if (isMembershipPlan(body.plan)) plan = body.plan;
    else return NextResponse.json({ error: "Unknown membership plan" }, { status: 400 });
  }

  const purchase = findPurchase(product, plan);
  if (!purchase) return NextResponse.json({ error: "Unknown checkout product" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isRateLimited(`checkout:${user.id}`, 5, 10 * 60_000)) return NextResponse.json({ error: "Too many checkout attempts" }, { status: 429 });

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("is_suspended").eq("id", user.id).maybeSingle(),
    supabase.from("memberships").select("id, expires_at").eq("user_id", user.id).eq("status", "active").maybeSingle(),
  ]);
  if (profile?.is_suspended) return NextResponse.json({ error: "This account is unavailable" }, { status: 403 });
  if (product === "membership" && membership && (!membership.expires_at || new Date(membership.expires_at) > new Date())) return NextResponse.json({ error: "Membership is already active" }, { status: 409 });

  const secret = process.env.STRIPE_SECRET_KEY;
  const price = process.env[purchase.priceEnv];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  /*
    A configured product and an unconfigured plan are different failures.

    Annual can be absent while monthly works — the price has to be created in
    Stripe before it can be sold — and saying so is what stops the request being
    quietly served the monthly price instead. The page does not offer a plan it
    has no price for, so reaching this is either a stale tab or a direct caller.
  */
  if (!secret || !appUrl) return NextResponse.json({ error: "Checkout is not configured" }, { status: 503 });
  if (!price) {
    return NextResponse.json(
      { error: plan === "annual" ? "Annual membership is not available yet" : "Checkout is not configured" },
      { status: 503 },
    );
  }

  const cancelQuery = new URLSearchParams({ checkout: "cancelled" });
  if (product === "mentorship") cancelQuery.set("product", "mentorship");
  else if (plan === "annual") cancelQuery.set("plan", "annual");

  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    /*
      Success lands on /checkout/success, not /dashboard.

      /dashboard is behind requireActiveMembership and the membership is granted
      by the webhook, asynchronously. When the browser redirect won that race —
      which it does, the webhook is a second request from Stripe's side — the
      person who had just paid was redirected to /checkout and asked to pay
      again. /checkout/success is signed-in-only on purpose, so it can be the
      place that waits.
    */
    success_url: `${appUrl}/checkout/success?product=${product}`,
    cancel_url: `${appUrl}/checkout?${cancelQuery.toString()}`,
    "metadata[user_id]": user.id,
    "metadata[product_type]": product,
  });
  // Carried so the webhook grants the term that was sold rather than assuming one.
  if (plan) form.set("metadata[plan]", plan);
  if (user.email) form.set("customer_email", user.email);

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const stripePayload = await stripeResponse.json() as { url?: string; error?: { message?: string } };
  if (!stripeResponse.ok || !stripePayload.url) {
    return NextResponse.json({ error: stripePayload.error?.message ?? "Unable to start checkout" }, { status: 502 });
  }

  return NextResponse.json({ url: stripePayload.url });
}
