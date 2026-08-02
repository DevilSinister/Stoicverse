import { createClient } from "npm:@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };
const maximumAttempts = 5;

type ClaimedDeletion = {
  request_id: string;
  target_user_id: string | null;
  avatar_path: string | null;
  attempts: number;
};

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return response(405, { error: "Method not allowed" });

  const cronSecret = request.headers.get("x-cron-secret")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!cronSecret || !supabaseUrl || !serviceRoleKey) return response(401, { error: "Unauthorized" });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: secretAccepted, error: secretError } = await admin.rpc(
    "verify_account_deletion_cron_secret",
    { candidate: cronSecret },
  );
  if (secretError || secretAccepted !== true) return response(401, { error: "Unauthorized" });

  const { data, error: claimError } = await admin.rpc("claim_due_account_deletions", { max_rows: 20 });
  if (claimError) return response(500, { error: "Unable to claim deletion requests" });

  const claimed = (data ?? []) as ClaimedDeletion[];
  let completed = 0;
  let deferred = 0;

  for (const deletion of claimed) {
    try {
      const userId = deletion.target_user_id;
      if (userId && deletion.avatar_path?.startsWith(`${userId}/`)) {
        const { error: avatarError } = await admin.storage.from("member-avatars").remove([deletion.avatar_path]);
        if (avatarError && !/not found/i.test(avatarError.message)) throw new Error("avatar_cleanup_failed");
      }

      if (userId) {
        const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
        if (deleteError && !/not found/i.test(deleteError.message)) throw new Error("auth_deletion_failed");
      }

      const { error: completeError } = await admin
        .from("account_deletion_requests")
        .update({ status: "completed", completed_at: new Date().toISOString(), processing_started_at: null, last_error: null })
        .eq("id", deletion.request_id);
      if (completeError) throw new Error("completion_update_failed");
      completed += 1;
    } catch (error) {
      const errorCode = error instanceof Error && /^[a-z_]{1,64}$/.test(error.message)
        ? error.message
        : "deletion_processing_failed";
      const finalAttempt = deletion.attempts >= maximumAttempts;
      await admin
        .from("account_deletion_requests")
        .update({
          status: finalAttempt ? "failed" : "pending",
          processing_started_at: null,
          last_error: errorCode,
        })
        .eq("id", deletion.request_id);
      deferred += 1;
    }
  }

  return response(200, { claimed: claimed.length, completed, deferred });
});
