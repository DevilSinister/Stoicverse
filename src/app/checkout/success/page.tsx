import { redirect } from "next/navigation";

import { CheckoutSuccessScreen } from "@/components/checkout/CheckoutSuccessScreen";
import { accessGranted } from "@/lib/checkout/granted";
import { currentProfile, currentViewer, viewerName } from "@/lib/supabase/viewer";

/**
 * Signed-in, and deliberately no further.
 *
 * `requireActiveMembership` is exactly the wrong guard here: this page exists
 * for the window in which the payment has completed and the membership has not
 * been written yet, and that guard's answer during that window is to redirect to
 * `/checkout` and ask for the money again.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const product = params.product === "mentorship" ? "mentorship" : "membership";

  const viewer = await currentViewer();
  if (!viewer) redirect("/login?next=/checkout/success");

  const [profile, granted] = await Promise.all([currentProfile(), accessGranted(product)]);

  return <CheckoutSuccessScreen product={product} granted={granted} name={viewerName(profile)} />;
}
