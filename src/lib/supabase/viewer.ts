import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * Who is asking, and what the app knows about them — read at most once per
 * request.
 *
 * Before this, a single creator page cost three serial round trips to Supabase
 * before it began loading anything it actually wanted to render:
 *
 *   1. `auth.getUser()`, which is an HTTP call to the auth server
 *   2. the guard's `profiles` read
 *   3. the page's own `profiles` read — of the same row, for `full_name`
 *
 * Each is ~180ms from a developer machine, so ~540ms went on establishing
 * facts that cannot change within one render. Both functions here are wrapped
 * in React's `cache`, which is per-request: the first caller pays, every
 * caller after it in the same render is free. That is what lets a guard and
 * the page it guards read the same profile without asking twice.
 */

export type Viewer = {
  id: string;
  email: string | null;
};

export type ViewerProfile = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  platformRole: string | null;
  isSuspended: boolean;
};

/**
 * The signed-in user, from the access token, verified in process.
 *
 * `getClaims()` rather than `getUser()`. The project signs tokens with ES256
 * and publishes a JWKS, so the signature is checked here against a key set the
 * client caches process-wide — no network, where `getUser()` was a full round
 * trip on every single request in the app.
 *
 * What that gives up is the one thing the auth server can answer and a
 * signature cannot: whether the session has since been revoked. Worth being
 * exact about why that is acceptable rather than waving at it. RLS is the
 * boundary that matters, and PostgREST admits this same token on its signature
 * alone — so the database was already granting what a revoked session
 * presents, and `getUser()` never stood between them. A suspension is still
 * immediate, because every guard reads `is_suspended` from the table on every
 * request. What remains is that a signed-out session keeps read access until
 * its access token expires.
 *
 * Returns null rather than redirecting. Where an anonymous visitor belongs is
 * the caller's decision — `/login?next=` for a page, a thrown error for a
 * mutation — and both call this.
 */
export const currentViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || typeof sub !== "string" || !sub) return null;
  const email = data?.claims?.email;
  return { id: sub, email: typeof email === "string" ? email : null };
});

/**
 * The viewer's profile row.
 *
 * One column list covering every caller. The app reads `profiles` from about
 * thirty places with six different overlapping selects; the row is a few
 * hundred bytes, so asking for the union once is cheaper than asking for a
 * subset twice.
 */
export const currentProfile = cache(async (): Promise<ViewerProfile | null> => {
  const viewer = await currentViewer();
  if (!viewer) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,avatar_url,platform_role,is_suspended")
    .eq("id", viewer.id)
    .maybeSingle();

  if (error) {
    console.error("[viewer]", { code: error.code ?? null });
    throw new Error("Unable to read your profile.");
  }
  if (!data) return null;

  return {
    id: data.id as string,
    fullName: (data.full_name as string | null) ?? null,
    avatarUrl: (data.avatar_url as string | null) ?? null,
    platformRole: (data.platform_role as string | null) ?? null,
    isSuspended: Boolean(data.is_suspended),
  };
});

/**
 * Whether this viewer holds the master tier.
 *
 * Its own cached read because only the rail and two guards want it, and it is
 * a different table. Cached for the same reason as the rest: the workspace
 * layout asks so the rail can offer Master Zone, and the guard on `/master`
 * asks again to enforce it.
 */
export const currentIsMaster = cache(async (): Promise<boolean> => {
  const viewer = await currentViewer();
  if (!viewer) return false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_tiers")
    .select("is_master")
    .eq("user_id", viewer.id)
    .maybeSingle();

  if (error) {
    console.error("[viewer]", { code: error.code ?? null });
    return false;
  }
  return Boolean(data?.is_master);
});

/**
 * The same row, in the shape PostgREST returns it.
 *
 * Nineteen pages read their own `profiles` row immediately after a guard has
 * already read it — a second ~180ms round trip for a row that is still in
 * memory. Each of those call sites destructures `{ data }` or checks `.error`,
 * so handing back `{ data, error }` lets the query expression be swapped for
 * this one and nothing downstream move. Prefer `currentProfile()` in new code;
 * this exists so the existing call sites did not have to be rewritten to get
 * the round trip back.
 */
export const profileRow = cache(async () => {
  const viewer = await currentViewer();
  if (!viewer) return { data: null, error: null } as const;

  const supabase = await createClient();
  return await supabase
    .from("profiles")
    .select("id,full_name,avatar_url,platform_role,is_suspended")
    .eq("id", viewer.id)
    .maybeSingle();
});

/**
 * How many unread notifications the bell should show.
 *
 * A count, not the rows. The chrome is mounted by the layout now, and the
 * layout renders once per hard load rather than once per navigation, so this
 * is paid once. It is a head request — PostgREST returns the count in a header
 * and no body — and the badge keeps itself current after that from the
 * realtime subscription the shell already holds open.
 */
export const unreadNotificationCount = cache(async (): Promise<number> => {
  const viewer = await currentViewer();
  if (!viewer) return 0;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", viewer.id)
    .eq("is_read", false);

  if (error) {
    console.error("[viewer]", { code: error.code ?? null });
    return 0;
  }
  return count ?? 0;
});

/** The display name every shell falls back on, so the fallback is written once. */
export function viewerName(profile: ViewerProfile | null, fallback = "Practitioner") {
  return profile?.fullName?.trim() || fallback;
}
