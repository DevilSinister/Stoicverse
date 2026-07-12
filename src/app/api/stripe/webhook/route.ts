import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { sendTransactionalEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type StripeEvent = {
  id: string;
  type: string;
  data: { object: { id: string; payment_intent?: string | null; payment_status?: string; amount_total?: number | null; currency?: string | null; customer_details?: { email?: string | null }; metadata?: { user_id?: string; product_type?: string } } };
};

function verifiedEvent(payload: string, signature: string | null, secret: string) {
  if (!signature) return null;
  const values = new Map(signature.split(",").map((part) => part.split("=", 2) as [string, string]));
  const timestamp = values.get("t");
  const signatureV1 = values.get("v1");
  if (!timestamp || !signatureV1 || !/^\d+$/.test(timestamp)) return null;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return null;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  const actualBuffer = Buffer.from(signatureV1, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer) ? JSON.parse(payload) as StripeEvent : null;
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });

  const payload = await request.text();
  let event: StripeEvent | null;
  try { event = verifiedEvent(payload, request.headers.get("stripe-signature"), secret); } catch { event = null; }
  if (!event) return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });

  const admin = createAdminClient();
  const { error: receivedError } = await admin.from("stripe_webhook_events").insert({ stripe_event_id: event.id, event_type: event.type, payload: event, processed: false });
  if (receivedError?.code === "23505") return NextResponse.json({ received: true });
  if (receivedError) return NextResponse.json({ error: "Unable to record webhook" }, { status: 500 });

  try {
    if (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const productType = session.metadata?.product_type;
      if (!userId || (productType !== "membership" && productType !== "mentorship")) throw new Error("Checkout metadata is invalid.");

      const paymentIntent = session.payment_intent ?? session.id;
      const amount = (session.amount_total ?? 0) / 100;
      const currency = (session.currency ?? "usd").toLowerCase();
      const { error: paymentError } = await admin.from("payments").upsert({
        user_id: userId, product_type: productType, amount, currency, stripe_payment_intent: paymentIntent,
        stripe_event_id: event.id, status: "succeeded", paid_at: new Date().toISOString(),
      }, { onConflict: "stripe_event_id" });
      if (paymentError) throw paymentError;

      if (productType === "membership") {
        const { error } = await admin.from("memberships").upsert({ user_id: userId, status: "active", stripe_payment_intent: paymentIntent, amount_paid: amount, joined_at: new Date().toISOString() }, { onConflict: "user_id" });
        if (error) throw error;
      } else {
        const { error } = await admin.from("mentorships").upsert({ user_id: userId, stripe_payment_intent: paymentIntent, amount_paid: amount, status: "active" }, { onConflict: "stripe_payment_intent" });
        if (error) throw error;
      }

      await admin.from("notifications").insert({ user_id: userId, type: productType === "membership" ? "payment_confirmed" : "mentorship_confirmed", title: productType === "membership" ? "Membership activated" : "Mentorship activated", body: "Your payment has been confirmed.", action_url: productType === "membership" ? "/dashboard" : "/mentorship" });
      if (session.customer_details?.email) {
        await sendTransactionalEmail({ to: session.customer_details.email, subject: "Stoicverse payment confirmed", html: "<p>Your Stoicverse payment has been confirmed.</p>" });
      }
    }
    await admin.from("stripe_webhook_events").update({ processed: true, processed_at: new Date().toISOString(), error_message: null }).eq("stripe_event_id", event.id);
  } catch (error) {
    await admin.from("stripe_webhook_events").update({ error_message: error instanceof Error ? error.message : "Unknown processing error" }).eq("stripe_event_id", event.id);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
