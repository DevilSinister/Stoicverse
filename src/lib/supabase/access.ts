import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function requireActiveMembership(nextPath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const cookieStore = await cookies();
  const hasLocalActive = cookieStore.get("stoicverse_membership_active")?.value === "true";

  if (hasLocalActive) {
    return { supabase, user };
  }

  const { data: membership, error } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error("Unable to validate membership.");
  }

  if (!membership) {
    redirect("/checkout");
  }

  return { supabase, user };
}

export async function requireMasterMembership(nextPath: string) {
  const { supabase, user } = await requireActiveMembership(nextPath);
  const { data: tier, error } = await supabase
    .from("member_tiers")
    .select("is_master")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to validate master access.");
  }

  if (!tier?.is_master) {
    redirect("/dashboard");
  }

  return { supabase, user };
}

export async function requirePlatformRole(requiredRole: "super_admin" | "influencer") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("platform_role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to validate admin access.");
  }

  if (profile?.platform_role !== requiredRole) {
    redirect("/");
  }

  return { supabase, user };
}
