import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath as toSafePath } from "@/lib/security/safe-path";
import { getSupabaseConfig } from "@/lib/supabase/env";

const authRoutes = ["/login", "/signup"];
const creatorRoute = "/creator";
const memberRoutes = ["/dashboard"];
// The community is the one surface every signed-in role shares: the creator
// reads the same channels their members do. Gated on access, never on role.
const communityRoutes = ["/channels"];
const creatorRoutes = ["/creator"];
const adminRoutes = ["/admin"];
const deletionPendingRoute = "/account/deletion-pending";

function isRouteMatch(path: string, routes: string[]) {
  return routes.some((route) => path === route || path.startsWith(`${route}/`));
}

const CHANNEL_PATH = /^\/channels\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Remembers the open channel, so bare `/channels` returns to it.
 *
 * This belongs in middleware rather than in the page: a Server Component
 * render may not set a cookie, and Next throws rather than ignoring it — the
 * page rendered as an error boundary, not as a channel. Middleware is the one
 * place in this request that is allowed to write to the response.
 *
 * Only a well-formed channel id is stored, because the value is read back as a
 * redirect target on the next visit to `/channels`.
 */
function rememberChannel(request: NextRequest, response: NextResponse) {
  const match = CHANNEL_PATH.exec(request.nextUrl.pathname);
  if (!match) return;
  if (request.cookies.get("sv-last-channel")?.value === match[1]) return;
  response.cookies.set("sv-last-channel", match[1], {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

function safeNextPath(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  if (next === null) return null;

  // toSafePath always returns a same-origin path; a rejected value collapses to
  // the sentinel fallback, which the callers below treat as "no destination".
  const resolved = toSafePath(next, "");
  return resolved === "" ? null : resolved;
}

function copyResponseState(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(({ name, value, path, domain, maxAge, expires, httpOnly, secure, sameSite, priority }) => {
    target.cookies.set({
      name,
      value,
      path,
      domain,
      maxAge,
      expires,
      httpOnly,
      secure,
      sameSite,
      priority,
    });
  });

  source.headers.forEach((value, key) => {
    target.headers.set(key, value);
  });
}

function redirectWithState(source: NextResponse, destination: URL) {
  const target = NextResponse.redirect(destination);
  copyResponseState(source, target);
  return target;
}

function unavailableWithState(source: NextResponse) {
  const target = new NextResponse("Unable to validate membership right now.", { status: 503 });
  copyResponseState(source, target);
  return target;
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    request.cookies.getAll().forEach(({ name }) => {
      if (name.startsWith("sb-")) {
        response.cookies.delete(name);
      }
    });
  }

  const path = request.nextUrl.pathname;
  const isCheckoutRoute = path === "/checkout";
  const isCreatorRoute = isRouteMatch(path, creatorRoutes);
  const isAdminRoute = isRouteMatch(path, adminRoutes);
  const requiresMembership = isRouteMatch(path, memberRoutes);
  const isCommunityRoute = isRouteMatch(path, communityRoutes);
  const isAuthRoute = authRoutes.includes(path);
  const isDeletionPendingRoute = path === deletionPendingRoute;
  const currentPath = `${path}${request.nextUrl.search}`;

  if ((isCheckoutRoute || requiresMembership || isCommunityRoute || isCreatorRoute || isAdminRoute || isDeletionPendingRoute) && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", currentPath);
    return redirectWithState(response, loginUrl);
  }

  if (!user) {
    return response;
  }

  const needsSubscriptionCheck = isCheckoutRoute || requiresMembership || isCommunityRoute || isAuthRoute || isCreatorRoute || isAdminRoute || isDeletionPendingRoute;
  if (!needsSubscriptionCheck) {
    return response;
  }

  const [{ data: membership, error: membershipError }, { data: profile, error: profileError }, { data: deletionRequest, error: deletionError }] = await Promise.all([
    supabase.from("memberships").select("id, expires_at").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
    supabase.from("profiles").select("is_suspended, platform_role").eq("id", user.id).maybeSingle(),
    supabase.from("account_deletion_requests").select("id").eq("user_id", user.id).in("status", ["pending", "processing", "failed"]).limit(1).maybeSingle(),
  ]);

  if (membershipError || profileError || deletionError) {
    return unavailableWithState(response);
  }

  if (deletionRequest && !isDeletionPendingRoute) {
    return redirectWithState(response, new URL(deletionPendingRoute, request.url));
  }

  const hasActiveMembership = Boolean(membership) && (!membership?.expires_at || new Date(membership.expires_at) > new Date()) && !profile?.is_suspended;

  const isInfluencer = profile?.platform_role === "influencer" && !profile?.is_suspended;
  const isAdmin = profile?.platform_role === "super_admin" && !profile?.is_suspended;
  const isModerator = profile?.platform_role === "moderator" && !profile?.is_suspended;
  const hasMemberWorkspaceAccess = hasActiveMembership || isModerator;

  if (isDeletionPendingRoute && !deletionRequest) {
    return redirectWithState(response, new URL(isAdmin ? "/admin" : isInfluencer ? creatorRoute : hasMemberWorkspaceAccess ? "/dashboard" : "/checkout", request.url));
  }

  // Every role that can reach the community reaches it here, before the
  // role-based redirects below — otherwise an influencer opening /channels
  // would be sent to /creator and could never see their own community.
  if (isCommunityRoute) {
    if (!hasMemberWorkspaceAccess && !isInfluencer && !isAdmin) {
      return redirectWithState(response, new URL("/checkout", request.url));
    }
    rememberChannel(request, response);
    return response;
  }

  if (isAdminRoute && !isAdmin) {
    return redirectWithState(response, new URL(isInfluencer ? creatorRoute : hasMemberWorkspaceAccess ? "/dashboard" : "/checkout", request.url));
  }

  if (isAdmin) {
    if (isAuthRoute || isCheckoutRoute || requiresMembership || isCreatorRoute) {
      return redirectWithState(response, new URL("/admin", request.url));
    }
    return response;
  }

  if (isCreatorRoute && !isInfluencer) {
    return redirectWithState(response, new URL(hasMemberWorkspaceAccess ? "/dashboard" : "/checkout", request.url));
  }

  if (requiresMembership && isInfluencer) {
    return redirectWithState(response, new URL(creatorRoute, request.url));
  }

  if (isCheckoutRoute && isInfluencer) {
    return redirectWithState(response, new URL(creatorRoute, request.url));
  }

  if (isCheckoutRoute && hasMemberWorkspaceAccess) {
    return redirectWithState(response, new URL("/dashboard", request.url));
  }

  if (requiresMembership && !hasMemberWorkspaceAccess) {
    return redirectWithState(response, new URL("/checkout", request.url));
  }

  if (isAuthRoute) {
    const next = safeNextPath(request);
    let destination: string;
    if (isInfluencer) {
      destination = next?.startsWith(creatorRoute) ? next : creatorRoute;
    } else if (hasActiveMembership) {
      destination = next && !next.startsWith(creatorRoute) ? next : "/dashboard";
    } else {
      destination = next === "/checkout" ? next : "/checkout";
    }
    return redirectWithState(response, new URL(destination, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg)$).*)"],
};
