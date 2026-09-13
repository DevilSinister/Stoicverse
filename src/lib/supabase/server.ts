import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { getSupabaseConfig } from "./env";

/**
 * One client per request, not one per caller.
 *
 * A single page render used to build four or five of these — the guard, the
 * page, and every loader it called each reached for its own. Each re-reads the
 * cookie jar and re-parses the session, and each carries its own JWKS cache,
 * so `getClaims()` could not reuse a verified key set across them. React's
 * `cache` is request-scoped: the first caller constructs, the rest share.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server components cannot always write cookies; middleware refreshes the session.
          }
        },
      },
    },
  );
});
