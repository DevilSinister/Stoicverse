import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/security/safe-path";
import { getSupabaseConfig } from "@/lib/supabase/env";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next");
  // Distinguish "no next supplied" from "next supplied but rejected", so a
  // rejected value falls back to the default instead of skipping the role
  // routing below.
  const validated = requestedNext === null ? null : safeNextPath(requestedNext, "/dashboard");
  const next = validated === "/dashboard" ? null : validated;
  const destination = new URL(next ?? "/dashboard", request.url);

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=link_expired", request.url));
  }

  const response = NextResponse.redirect(destination);
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

  const { data: exchange, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  // A failed exchange must not still perform the caller-supplied redirect —
  // that turned this route into an unauthenticated redirector.
  if (exchangeError || !exchange.user) {
    return NextResponse.redirect(new URL("/login?error=link_expired", request.url));
  }

  if (next) {
    return response;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("platform_role, is_suspended")
    .eq("id", exchange.user.id)
    .maybeSingle();

  if (profile?.platform_role === "influencer" && !profile.is_suspended) {
    return NextResponse.redirect(new URL("/creator", request.url), { headers: response.headers });
  }

  if (profile?.platform_role === "super_admin" && !profile.is_suspended) {
    return NextResponse.redirect(new URL("/admin", request.url), { headers: response.headers });
  }

  return response;
}
