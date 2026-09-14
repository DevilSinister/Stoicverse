"use server";

import { accessGranted } from "@/lib/checkout/granted";
import { isProduct } from "@/lib/checkout/plans";

/**
 * Ask again whether the webhook has landed.
 *
 * This module exports exactly one thing and it is an async function. That is
 * not style: a `"use server"` file may only export async functions, and a single
 * exported string is enough to compile the whole module to no exports at all —
 * every action in it then reports missing at runtime, with a clean typecheck.
 * That happened in `auth/actions.ts` during phase 4a. Constants belong in
 * `lib/checkout/plans.ts`, which is where the product union lives.
 */
export async function confirmAccess(product: string): Promise<boolean> {
  if (!isProduct(product)) return false;
  return accessGranted(product);
}
