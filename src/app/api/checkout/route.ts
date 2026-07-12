import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isRateLimited, rejectUntrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";

const products = {
  membership: "STRIPE_MEMBERSHIP_PRICE_ID",
  mentorship: "STRIPE_MENTORSHIP_PRICE_ID",
} as const;

export async function POST(request: Request) {
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;

  let body: { product?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 }); }
  const product = body.product === "membership" || body.product === "mentorship" ? body.product : null;
  if (!product) return NextResponse.json({ error: "Unknown checkout product" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isRateLimited(`checkout:${user.id}`, 5, 10 * 60_000)) return NextResponse.json({ error: "Too many checkout attempts" }, { status: 429 });

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("is_suspended").eq("id", user.id).maybeSingle(),
    supabase.from("memberships").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle(),
  ]);
  if (profile?.is_suspended) return NextResponse.json({ error: "This account is unavailable" }, { status: 403 });
  if (product === "membership" && membership) return NextResponse.json({ error: "Membership is already active" }, { status: 409 });

  const secret = process.env.STRIPE_SECRET_KEY;
  const price = process.env[products[product]];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!secret || !price || !appUrl) return NextResponse.json({ error: "Checkout is not configured" }, { status: 503 });

  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/checkout?checkout=cancelled${product === "mentorship" ? "&product=mentorship" : ""}`,
    "metadata[user_id]": user.id,
    "metadata[product_type]": product,
  });
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
