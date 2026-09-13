import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { currentIsMaster, currentProfile, currentViewer, type Viewer } from "@/lib/supabase/viewer";

/**
 * The access guards.
 *
 * Every one of these returns `{ supabase, user }` and every caller reads only
 * `user.id` and `user.email`, so `user` is the claims-derived `Viewer` rather
 * than the auth server's `User` object. That is the whole of the change: the
 * identity now comes from verifying the token's ES256 signature in process
 * instead of asking the auth server over the network, and the profile read
 * behind it is request-cached so a guard and the page it guards share one.
 *
 * A page that calls a guard and then reads its own `profiles` row now costs
 * one round trip where it used to cost three.
 */

/** Anonymous visitors go to the login page; the guards differ only in where back. */
async function requireViewer(nextPath: string): Promise<Viewer> {
  const viewer = await currentViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return viewer;
}

/**
 * The membership facts that are not on the profile.
 *
 * Cached alongside the profile so `requireActiveMembership` and
 * `requireCommunityAccess` — which ask the same three questions and differ
 * only in what they conclude — read the database once between them.
 */
const membershipState = cache(async () => {
  const viewer = await currentViewer();
  if (!viewer) return { hasActiveMembership: false, deletionPending: false };

  const supabase = await createClient();
  const [{ data: membership, error: membershipError }, { data: deletionRequest, error: deletionError }] =
    await Promise.all([
      supabase.from("memberships").select("id, expires_at").eq("user_id", viewer.id).eq("status", "active").maybeSingle(),
      supabase
        .from("account_deletion_requests")
        .select("id")
        .eq("user_id", viewer.id)
        .in("status", ["pending", "processing", "failed"])
        .limit(1)
        .maybeSingle(),
    ]);

  if (membershipError || deletionError) {
    console.error("Membership Error:", membershipError);
    console.error("Deletion Error:", deletionError);
    throw new Error("Unable to validate membership.");
  }

  const expiresAt = membership?.expires_at as string | null | undefined;
  return {
    hasActiveMembership: Boolean(membership) && (!expiresAt || new Date(expiresAt) > new Date()),
    deletionPending: Boolean(deletionRequest),
  };
});

export async function requireActiveMembership(nextPath: string) {
  const user = await requireViewer(nextPath);
  const [profile, membership] = await Promise.all([currentProfile(), membershipState()]);
  const supabase = await createClient();

  if (membership.deletionPending) redirect("/account/deletion-pending");

  if (profile?.platformRole === "influencer" && !profile.isSuspended) {
    redirect("/creator");
  }

  if (profile?.platformRole === "super_admin" && !profile.isSuspended) {
    redirect("/admin");
  }

  const isModerator = profile?.platformRole === "moderator" && !profile.isSuspended;
  if ((!membership.hasActiveMembership && !isModerator) || profile?.isSuspended) {
    redirect("/checkout");
  }

  return { supabase, user };
}

export async function requireInfluencerWorkspace(nextPath: string) {
  const user = await requireViewer(nextPath);
  const profile = await currentProfile();
  const supabase = await createClient();

  if (profile?.isSuspended) {
    redirect("/login");
  }

  if (profile?.platformRole !== "influencer") {
    redirect(profile?.platformRole === "super_admin" ? "/admin" : "/dashboard");
  }

  return { supabase, user };
}

export async function requireMasterMembership(nextPath: string) {
  const { supabase, user } = await requireActiveMembership(nextPath);
  if (!(await currentIsMaster())) {
    redirect("/dashboard");
  }
  return { supabase, user };
}

export async function requireInfluencerMasterWorkspace(nextPath: string) {
  const { supabase, user } = await requireInfluencerWorkspace(nextPath);
  if (!(await currentIsMaster())) {
    redirect("/creator/dashboard");
  }
  return { supabase, user };
}

export async function requirePlatformRole(requiredRole: "super_admin" | "influencer") {
  const user = await requireViewer("/");
  const profile = await currentProfile();
  const supabase = await createClient();

  if (profile?.isSuspended || profile?.platformRole !== requiredRole) {
    redirect("/");
  }

  return { supabase, user };
}

/** Re-authorize every influencer mutation. Proxy redirects are never an access boundary. */
export async function requireInfluencer() {
  const user = await currentViewer();
  if (!user) throw new Error("Authentication required.");

  const profile = await currentProfile();
  if (!profile || profile.isSuspended || profile.platformRole !== "influencer") {
    throw new Error("Influencer access is required.");
  }
  return { supabase: await createClient(), user };
}

/**
 * Re-authorize one community mutation against the permission resolver.
 *
 * `community_has` is the same function the RLS policies read, so this check and
 * the database's check cannot disagree. It is not the boundary — the RPC is —
 * it exists so a moderator without the grant gets a sentence instead of a
 * policy error, and so the action fails before it writes anything.
 */
export async function requireCommunityPermission(permission: string, channelId?: string) {
  const user = await currentViewer();
  if (!user) throw new Error("Authentication required.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_has", {
    permission,
    channel: channelId ?? null,
  });

  if (error) {
    console.error("[community]", { code: error.code ?? null });
    throw new Error("Your permissions could not be checked. Try again in a moment.");
  }
  if (data !== true) throw new Error("You do not have permission to do that.");

  return { supabase, user };
}

/**
 * Access to the community itself, for `/channels`.
 *
 * Deliberately not `requireActiveMembership`, which redirects an influencer to
 * `/creator` and a super_admin to `/admin`. The community is the one surface
 * every signed-in role shares: the creator reads the same channels their
 * members do, and sending them somewhere else would mean they could never see
 * their own community.
 *
 * A sanction is not handled here. `community_viewer_state` reports the gate
 * and the page renders the reason, because "you are timed out until 4pm" is a
 * different thing from "you do not have an account".
 */
export async function requireCommunityAccess(nextPath: string) {
  const user = await requireViewer(nextPath);
  const [profile, membership] = await Promise.all([currentProfile(), membershipState()]);
  const supabase = await createClient();

  if (membership.deletionPending) redirect("/account/deletion-pending");
  if (profile?.isSuspended) redirect("/checkout");

  const isStaff =
    profile?.platformRole === "moderator" ||
    profile?.platformRole === "influencer" ||
    profile?.platformRole === "super_admin";

  if (!membership.hasActiveMembership && !isStaff) redirect("/checkout");

  return { supabase, user, isStaff };
}
