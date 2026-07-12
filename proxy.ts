import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseConfig } from "@/lib/supabase/env";

const authRoutes = ["/login", "/signup"];
const memberRoutes = ["/dashboard", "/community", "/courses", "/events", "/master", "/subscription"];

function isRouteMatch(path: string, routes: string[]) {
  return routes.some((route) => path === route || path.startsWith(`${route}/`));
}

function safeNextPath(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");

  return next?.startsWith("/") && !next.startsWith("//") ? next : null;
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
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isCheckoutRoute = path === "/checkout";
  const requiresMembership = isRouteMatch(path, memberRoutes);
  const isAuthRoute = authRoutes.includes(path);
  const currentPath = `${path}${request.nextUrl.search}`;

  if ((isCheckoutRoute || requiresMembership) && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", currentPath);
    return redirectWithState(response, loginUrl);
  }

  if (!user) {
    return response;
  }

  const needsSubscriptionCheck = isCheckoutRoute || requiresMembership || isAuthRoute;
  if (!needsSubscriptionCheck) {
    return response;
  }

  const [{ data: membership, error: membershipError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from("memberships").select("id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
    supabase.from("profiles").select("is_suspended").eq("id", user.id).maybeSingle(),
  ]);

  if (membershipError || profileError) {
    return unavailableWithState(response);
  }

  const hasActiveMembership = Boolean(membership) && !profile?.is_suspended;

  if (isCheckoutRoute && hasActiveMembership) {
    return redirectWithState(response, new URL("/dashboard", request.url));
  }

  if (requiresMembership && !hasActiveMembership) {
    return redirectWithState(response, new URL("/checkout", request.url));
  }

  if (isAuthRoute) {
    const next = safeNextPath(request);
    const destination = hasActiveMembership ? "/dashboard" : next === "/checkout" ? next : "/checkout";
    return redirectWithState(response, new URL(destination, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg)$).*)"],
};
