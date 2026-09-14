import { timingSafeEqual } from "node:crypto";

import { createServerClient } from "@supabase/ssr";
import { notFound } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";

import { DEV_PERSONA_EMAIL, isDevLoginEnabled, isDevPersona, type DevPersona } from "@/lib/dev/login-bypass";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/env";

/**
 * Signs the browser in as a seeded development persona. See
 * `src/lib/dev/login-bypass.ts` for the three conditions that gate it; when
 * any is unmet this route does not exist (404), and a production build has the
 * `NODE_ENV === "development"` branch compiled out entirely.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function secretMatches(candidate: string) {
  const expected = process.env.DEV_LOGIN_SECRET ?? "";
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function isLocalRequest(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").replace(/:\d+$/, "").toLowerCase();
  return LOCAL_HOSTS.has(host);
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Mints a sign-in token for the community owner.
 *
 * `profiles_one_influencer_idx` allows exactly one influencer, so there is no
 * such thing as a throwaway creator: seeding one fails on the unique index for
 * as long as a real owner exists. "Sign in as the creator" can therefore only
 * mean the account that already is one.
 *
 * Nothing about that account is written — not the role, not the name. The
 * earlier version updated `full_name`, which would have renamed a real
 * person's profile to "Dev Creator" as a side effect of a QA login.
 */
async function adoptOwner(admin: ReturnType<typeof createAdminClient>) {
  const owner = await admin.from("profiles").select("id").eq("platform_role", "influencer").maybeSingle();
  if (owner.error) throw new Error(`Could not find the community owner: ${owner.error.message}`);
  if (!owner.data) return null;

  const user = await admin.auth.admin.getUserById(owner.data.id as string);
  if (user.error || !user.data.user?.email) {
    throw new Error(`The community owner has no sign-in address: ${user.error?.message ?? "no email"}`);
  }
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: user.data.user.email });
  if (link.error || !link.data.properties?.hashed_token) {
    throw new Error(`Could not mint a sign-in token for the owner: ${link.error?.message ?? "no token"}`);
  }
  return { tokenHash: link.data.properties.hashed_token };
}

async function seedPersona(persona: DevPersona) {
  const admin = createAdminClient();

  if (persona === "creator") {
    const adopted = await adoptOwner(admin);
    // No owner yet: fall through and promote the seeded account into the role,
    // which the unique index permits precisely because it is still vacant.
    if (adopted) return adopted;
  }

  const email = DEV_PERSONA_EMAIL[persona];
  const fullName = `Dev ${persona[0].toUpperCase()}${persona.slice(1)}`;

  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: crypto.randomUUID(),
    user_metadata: { full_name: fullName },
  });
  if (created.error && !/already|exists|registered/i.test(created.error.message)) {
    throw new Error(`Could not create ${persona}: ${created.error.message}`);
  }

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error || !link.data.user || !link.data.properties?.hashed_token) {
    throw new Error(`Could not mint a sign-in token for ${persona}: ${link.error?.message ?? "no token"}`);
  }
  const userId = link.data.user.id;

  const platformRole = persona === "creator" ? "influencer" : persona === "moderator" ? "moderator" : "member";
  const profile = await admin
    .from("profiles")
    .update({ platform_role: platformRole, is_suspended: false, full_name: fullName })
    .eq("id", userId);
  if (profile.error) throw new Error(`Could not set the ${persona} profile: ${profile.error.message}`);

  /*
    The prospect is the persona that has not paid, and that is its whole point.

    Every other seeded account carries an active membership, which is why the
    pre-purchase half of the product could not be opened at all: `proxy.ts`
    redirects anyone holding a membership away from `/checkout`, and
    `/checkout/success` could only be caught in its already-granted state.

    Any membership row is *removed* rather than merely not written. This account
    is seeded repeatedly across sessions, and a prospect that silently stops
    being one is worse than no persona at all - the screen it exists to reach
    would quietly redirect again, which is the failure it was added to end.
  */
  if (persona === "prospect") {
    const cleared = await admin.from("memberships").delete().eq("user_id", userId);
    if (cleared.error) throw new Error(`Could not clear the prospect membership: ${cleared.error.message}`);
  } else if (persona !== "creator") {
    const now = new Date();
    const membership = await admin.from("memberships").upsert(
      {
        user_id: userId,
        status: "active",
        joined_at: now.toISOString(),
        expires_at: new Date(now.getTime() + ONE_YEAR_MS).toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (membership.error) throw new Error(`Could not activate the ${persona} membership: ${membership.error.message}`);
  }

  return { tokenHash: link.data.properties.hashed_token };
}

export async function GET() {
  notFound();
}

export async function POST(request: NextRequest) {
  if (!isDevLoginEnabled() || !isLocalRequest(request)) notFound();

  const form = await request.formData();
  const persona = form.get("as");
  const secret = String(form.get("secret") ?? "");
  if (!isDevPersona(persona) || !secretMatches(secret)) notFound();

  let tokenHash: string;
  try {
    ({ tokenHash } = await seedPersona(persona));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Seeding failed.";
    return new NextResponse(message, { status: 500 });
  }

  // The prospect cannot open /channels - no membership - and `proxy.ts` would
  // bounce them to /checkout anyway. Landing there directly says so honestly.
  const destination = new URL(
    persona === "creator" ? "/creator" : persona === "prospect" ? "/checkout" : "/channels",
    request.url,
  );
  const response = NextResponse.redirect(destination, 303);
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error) {
    return new NextResponse(`Sign-in failed: ${error.message}`, { status: 500 });
  }
  return response;
}
