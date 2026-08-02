import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./env";

export function createAdminClient() {
  const { supabaseUrl } = getSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-service-role-key-for-build";


  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
