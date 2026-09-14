import type { Purchase } from "@/lib/checkout/plans";

/**
 * The amount on the screen comes from the price that will be charged.
 *
 * It used to be a string in the component — "$10" beside membership, "$1,000"
 * beside mentorship, "$100" beside an annual plan that had no price id at all.
 * A figure typed into a component is a claim nothing checks: change the price
 * in Stripe and the page keeps advertising the old one until somebody notices,
 * and the first person to notice is a customer reading a receipt.
 *
 * So the figure is read from Stripe. Two consequences are handled here rather
 * than at the call site:
 *
 * - A price lookup must not put a network round trip in front of every render.
 *   Results are memoised in the module for `TTL_MS`. This is per server
 *   instance and deliberately so — there is nothing to invalidate, and a price
 *   that changed ten minutes ago is not an incident.
 * - A failed lookup must not take the page down or, worse, substitute a guess.
 *   It returns null, the offer renders without a figure, and the button still
 *   works: Stripe's own page is where the amount is confirmed before anyone
 *   pays, which is what the screen already tells the reader.
 */

const TTL_MS = 10 * 60_000;

export type Price = { amount: string; currency: string };

type Entry = { value: Price | null; expires: number };

const memo = new Map<string, Entry>();

/** Stripe amounts are in the currency's minor unit; zero-decimal ones are not. */
const ZERO_DECIMAL = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);

function format(unitAmount: number, currency: string): string {
  const code = currency.toUpperCase();
  const value = ZERO_DECIMAL.has(currency.toLowerCase()) ? unitAmount : unitAmount / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      // $10 rather than $10.00, but $10.50 keeps its cents.
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // An unknown currency code throws rather than falling back, and a thrown
    // formatter on a checkout page is a blank screen over a cosmetic problem.
    return `${value} ${code}`;
  }
}

async function fetchPrice(priceId: string, secret: string): Promise<Price | null> {
  try {
    const response = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { unit_amount?: number | null; currency?: string | null };
    if (typeof payload.unit_amount !== "number" || !payload.currency) return null;
    return { amount: format(payload.unit_amount, payload.currency), currency: payload.currency };
  } catch {
    return null;
  }
}

/**
 * The price for one purchase, or null when it is not configured or not readable.
 *
 * Null for "not configured" is what makes an unconfigured plan invisible rather
 * than broken: the caller offers what it has a price for.
 */
export async function priceFor(purchase: Purchase): Promise<Price | null> {
  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env[purchase.priceEnv];
  if (!secret || !priceId) return null;

  const cached = memo.get(priceId);
  if (cached && cached.expires > Date.now()) return cached.value;

  const value = await fetchPrice(priceId, secret);
  memo.set(priceId, { value, expires: Date.now() + TTL_MS });
  return value;
}

/** True when a price id is present, whether or not Stripe answered about it. */
export function isConfigured(purchase: Purchase): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env[purchase.priceEnv]);
}
