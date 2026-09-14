/**
 * What can be bought, and what each purchase grants.
 *
 * Three places have to agree about this and used to agree only by coincidence:
 * the API route that creates the Stripe session, the page that renders the
 * offer, and the webhook that grants access when the payment lands. The term —
 * how long a payment buys — lived as a literal `+ 1` month inside the webhook,
 * which is why an "Annual Commitment" could be advertised at $100 while the
 * only price id in the request bought one month. The table is the fix: a plan
 * that is not here cannot be sold, and a plan that is here carries its own term.
 *
 * Everything is a one-time payment (`mode: "payment"`), not a Stripe
 * subscription. A renewal is a second purchase that extends the expiry from
 * whichever is later, today or the current expiry. That is a deliberate limit,
 * not an oversight, and it is the reason the terms page's "billed on a
 * recurring basis" is still ahead of the implementation.
 */

export type Product = "membership" | "mentorship";
export type MembershipPlan = "monthly" | "annual";

export type Purchase = {
  product: Product;
  /** Membership is sold by term; mentorship is a single purchase with none. */
  plan: MembershipPlan | null;
  /** The environment variable holding the Stripe price id. */
  priceEnv: string;
  /** How many months of membership this grants. Null for mentorship. */
  termMonths: number | null;
  name: string;
  /** Said next to the amount, so "$100" is never a bare number. */
  cadence: string;
};

export const PURCHASES: Purchase[] = [
  {
    product: "membership",
    plan: "monthly",
    priceEnv: "STRIPE_MEMBERSHIP_PRICE_ID",
    termMonths: 1,
    name: "Community Membership",
    cadence: "for one month",
  },
  {
    product: "membership",
    plan: "annual",
    priceEnv: "STRIPE_MEMBERSHIP_ANNUAL_PRICE_ID",
    termMonths: 12,
    name: "Community Membership",
    cadence: "for twelve months",
  },
  {
    product: "mentorship",
    plan: null,
    priceEnv: "STRIPE_MENTORSHIP_PRICE_ID",
    termMonths: null,
    name: "Private Mentorship",
    cadence: "one-time",
  },
];

export function isProduct(value: unknown): value is Product {
  return value === "membership" || value === "mentorship";
}

export function isMembershipPlan(value: unknown): value is MembershipPlan {
  return value === "monthly" || value === "annual";
}

/**
 * The purchase a request is asking for, or null if there is no such thing.
 *
 * Mentorship ignores the plan rather than refusing it, because the plan is a
 * property of membership and a mentorship request carries none.
 */
export function findPurchase(product: Product, plan: MembershipPlan | null): Purchase | null {
  if (product === "mentorship") return PURCHASES.find((entry) => entry.product === "mentorship") ?? null;
  return PURCHASES.find((entry) => entry.product === "membership" && entry.plan === plan) ?? null;
}

/**
 * How many months a completed membership payment buys.
 *
 * Defaults to one month when the plan is missing or unrecognised, which is the
 * correct reading of a session created before annual existed: those carry no
 * `plan` in their metadata and bought a month. A session that names an unknown
 * plan is a bug somewhere upstream, and granting the smaller term is the safe
 * direction to be wrong in.
 */
export function membershipTermMonths(plan: unknown): number {
  const purchase = isMembershipPlan(plan) ? findPurchase("membership", plan) : null;
  return purchase?.termMonths ?? 1;
}
