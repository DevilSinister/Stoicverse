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

  const [{ data: membership, error: membershipError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from("memberships").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle(),
    supabase.from("profiles").select("is_suspended, platform_role").eq("id", user.id).maybeSingle(),
  ]);

  if (membershipError || profileError) {
    console.error("Membership Error:", membershipError);
    console.error("Profile Error:", profileError);
    throw new Error("Unable to validate membership.");
  }

  if (profile?.platform_role === "influencer" && !profile.is_suspended) {
    redirect("/creator");
  }

  if (profile?.platform_role === "super_admin" && !profile.is_suspended) {
    redirect("/admin");
  }

  if (!membership || profile?.is_suspended) {
    redirect("/checkout");
  }

  return { supabase, user };
}

export async function requireInfluencerWorkspace(nextPath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_suspended, platform_role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to validate influencer access.");
  }

  if (profile?.is_suspended) {
    redirect("/login");
  }

  if (profile?.platform_role !== "influencer") {
    redirect(profile?.platform_role === "super_admin" ? "/admin" : "/dashboard");
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

export async function requireInfluencerMasterWorkspace(nextPath: string) {
  const { supabase, user } = await requireInfluencerWorkspace(nextPath);
  const { data: tier, error } = await supabase
    .from("member_tiers")
    .select("is_master")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to validate master access.");
  }

  if (!tier?.is_master) {
    redirect("/creator/dashboard");
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
    .select("platform_role, is_suspended")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to validate admin access.");
  }

  if (profile?.is_suspended || profile?.platform_role !== requiredRole) {
    redirect("/");
  }

  return { supabase, user };
}

/** Re-authorize every influencer mutation. Proxy redirects are never an access boundary. */
export async function requireInfluencer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("platform_role, is_suspended")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile || profile.is_suspended || profile.platform_role !== "influencer") {
    throw new Error("Influencer access is required.");
  }
  return { supabase, user };
}
