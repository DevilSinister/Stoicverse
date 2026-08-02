import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LandingScreen } from "@/components/screens/LandingScreen";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Stoicverse — Master the discipline of perception",
  description:
    "A paid community learning platform where study, gated video lessons, live events, and mentorship move through one precise operating surface.",
  openGraph: {
    title: "Stoicverse — Master the discipline of perception",
    description:
      "Join one structured Stoic practice: community channels, a sequenced curriculum, live events, and a progression path. $10 per month.",
    siteName: "Stoicverse",
    type: "website",
  },
};

export default async function Home() {
  if (!hasSupabaseConfig()) {
    return <LandingScreen />;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    redirect(membership ? "/dashboard" : "/checkout");
  }

  return <LandingScreen />;
}
