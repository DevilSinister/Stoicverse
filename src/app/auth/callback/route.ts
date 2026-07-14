import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseConfig } from "@/lib/supabase/env";

function safeNextPath(next: string | null) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const destination = new URL(next ?? "/dashboard", request.url);

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
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

  const { data: exchange } = await supabase.auth.exchangeCodeForSession(code);
  if (!exchange.user || next) {
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
