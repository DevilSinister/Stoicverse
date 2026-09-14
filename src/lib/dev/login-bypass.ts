import "server-only";

/**
 * Development-only sign-in as a seeded persona, for browser QA of surfaces
 * that otherwise need a real subscription to reach.
 *
 * Three independent conditions must all hold, and any one of them alone keeps
 * this off in production:
 *   1. NODE_ENV is "development" — Next inlines this at build time, so a
 *      production bundle compiles the whole branch out.
 *   2. DEV_LOGIN_BYPASS=1 — a server-only variable (never NEXT_PUBLIC_) that
 *      has to be set on purpose.
 *   3. The Supabase project host is listed in DEV_LOGIN_ALLOWED_SUPABASE_HOSTS,
 *      so the flag cannot be pointed at the production project by accident.
 *
 * A route that finds any condition false answers 404, not 403, so it is
 * indistinguishable from a route that does not exist.
 */

export const DEV_PERSONAS = ["creator", "moderator", "member", "prospect"] as const;
export type DevPersona = (typeof DEV_PERSONAS)[number];

export const DEV_PERSONA_LABELS: Record<DevPersona, { label: string; detail: string }> = {
  // There is exactly one influencer (profiles_one_influencer_idx), so this
  // signs in as whoever already holds the role rather than seeding a second.
  creator: { label: "Creator", detail: "The account that already owns the community." },
  moderator: { label: "Moderator", detail: "A member with the Moderator role." },
  member: { label: "Member", detail: "An active tier-1 subscriber." },
  /*
    Signed in, and has never paid.

    Added because every other persona holds an active membership, which put a
    whole class of screen out of reach for browser QA: `proxy.ts` sends anyone
    with a membership away from `/checkout`, and `/checkout/success` could only
    ever be seen in its already-granted state. Phase 5 shipped both without
    either having been rendered once. This is the account that opens them.
  */
  prospect: { label: "Prospect", detail: "Signed in with no membership — sees checkout." },
};

export function isDevPersona(value: unknown): value is DevPersona {
  return typeof value === "string" && (DEV_PERSONAS as readonly string[]).includes(value);
}

export const DEV_PERSONA_EMAIL: Record<DevPersona, string> = {
  creator: "dev-creator@stoicverse.local",
  moderator: "dev-moderator@stoicverse.local",
  member: "dev-member@stoicverse.local",
  prospect: "dev-prospect@stoicverse.local",
};

const MIN_SECRET_LENGTH = 16;

/** Names every unmet condition, for the development login panel. Empty means enabled. */
export function devLoginBlockers(): string[] {
  const blockers: string[] = [];
  if (process.env.NODE_ENV !== "development") blockers.push("NODE_ENV is not development");
  if (process.env.DEV_LOGIN_BYPASS !== "1") blockers.push("DEV_LOGIN_BYPASS is not 1");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) blockers.push("SUPABASE_SERVICE_ROLE_KEY is not set");
  if ((process.env.DEV_LOGIN_SECRET ?? "").length < MIN_SECRET_LENGTH) {
    blockers.push(`DEV_LOGIN_SECRET is shorter than ${MIN_SECRET_LENGTH} characters`);
  }

  const allowed = (process.env.DEV_LOGIN_ALLOWED_SUPABASE_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  let host: string | null = null;
  try {
    host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.toLowerCase();
  } catch {
    host = null;
  }
  if (!host || !allowed.includes(host)) {
    blockers.push("the Supabase host is not in DEV_LOGIN_ALLOWED_SUPABASE_HOSTS");
  }
  return blockers;
}

export function isDevLoginEnabled(): boolean {
  return devLoginBlockers().length === 0;
}
