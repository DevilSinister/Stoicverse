"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { PASSWORD_MIN_LENGTH } from "@/lib/auth/policy";
import { isRateLimited } from "@/lib/security/request";
import { safeNextPath } from "@/lib/security/safe-path";
import { createClient } from "@/lib/supabase/server";
import { currentViewer } from "@/lib/supabase/viewer";

type AuthActionState = {
  error?: string;
  message?: string;
};

const LOGIN_IP_LIMIT = 20;
const RESET_IP_LIMIT = 6;
const RESET_ACCOUNT_LIMIT = 4;
const LOGIN_ACCOUNT_LIMIT = 8;
const SIGNUP_IP_LIMIT = 6;
const RATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Where the confirmation screen reads the address it names.
 *
 * A cookie rather than a query parameter. `/signup/confirm?email=...` would put
 * somebody's address in their browser history, in the referrer of anything that
 * page loads, and in every access log between here and them - for a string that
 * is only ever read by the next screen, once.
 *
 * httpOnly, because nothing in the browser needs to read it either.
 */
const PENDING_EMAIL_COOKIE = "sv_pending_email";

async function rememberPendingEmail(email: string) {
  const jar = await cookies();
  jar.set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 15 * 60,
  });
}

/** Read once by the confirmation screen, which clears it on the way out. */
export async function takePendingEmail(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(PENDING_EMAIL_COOKIE)?.value ?? null;
}

async function clientKey() {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
  return ip;
}

function appOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      return null;
    }
  }

  // Only fall back in development. In production a wrong origin would send
  // every confirmation email to an unreachable link, silently breaking the
  // email-verification step of the identity chain.
  return process.env.NODE_ENV === "production" ? null : "http://localhost:3000";
}

export async function loginAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState | never> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const ip = await clientKey();
  if (
    isRateLimited(`login:ip:${ip}`, LOGIN_IP_LIMIT, RATE_WINDOW_MS) ||
    isRateLimited(`login:account:${email}`, LOGIN_ACCOUNT_LIMIT, RATE_WINDOW_MS)
  ) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "That email and password combination is not correct." };
  }

  redirect(next);
}

export async function signupAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState | never> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!fullName || !email || !password) {
    return { error: "Enter a username, email, and password." };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return { error: `Use a password of at least ${PASSWORD_MIN_LENGTH} characters.` };
  }

  const origin = appOrigin();
  if (!origin) {
    return { error: "Sign up is unavailable right now. Please try again later." };
  }

  const ip = await clientKey();
  if (isRateLimited(`signup:ip:${ip}`, SIGNUP_IP_LIMIT, RATE_WINDOW_MS)) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { full_name: fullName },
    },
  });

  if (error) {
    // A duplicate address must not be distinguishable from a fresh one, so the
    // only errors surfaced are the ones the user can act on. Everything else
    // takes the same exit as a successful signup, including this redirect.
    const actionable = /password|username|full_name|name/i.test(error.message);
    if (actionable) return { error: error.message };
    await rememberPendingEmail(email);
    redirect("/signup/confirm");
  }

  if (data.session) {
    redirect(next);
  }

  /*
    A route, not a panel that replaces the form in place.

    The previous version returned `{ message }` and `AuthForm` swapped itself
    for a confirmation card. That card had no URL: a reload lost it, the back
    button went to a form with the fields already cleared, and nothing could
    link anybody back to it. SIGNUP_ACK is still the copy of record - the
    screen renders it when there is no remembered address to name.
  */
  await rememberPendingEmail(email);
  redirect("/signup/confirm");
}

/**
 * Ask for a password-reset link.
 *
 * The product had no reset at all: a forgotten password was a lost account.
 *
 * The reply is the same whether or not the address matched, and the redirect
 * below is taken on every path including the rate-limited one. A reset form
 * that answers differently for a registered address is an oracle for "does
 * this person have an account here", which is exactly the question an address
 * list is bought to answer.
 */
export async function requestPasswordResetAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState | never> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return { error: "Enter the email address on your account." };
  }

  const origin = appOrigin();
  if (!origin) {
    return { error: "Password reset is unavailable right now. Please try again later." };
  }

  const ip = await clientKey();
  const limited =
    isRateLimited(`reset:ip:${ip}`, RESET_IP_LIMIT, RATE_WINDOW_MS) ||
    isRateLimited(`reset:account:${email}`, RESET_ACCOUNT_LIMIT, RATE_WINDOW_MS);

  if (!limited) {
    const supabase = await createClient();
    // The result is deliberately not read. Supabase already answers the same
    // way for an unknown address, and branching on it here would undo that.
    await supabase.auth.resetPasswordForEmail(email, {
      // Through the existing callback, which exchanges the code for a session
      // and already sends a dead link to /login?error=link_expired.
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/auth/reset/confirm")}`,
    });
  }

  redirect("/auth/reset?sent=1");
}

/**
 * Set a new password on the session the reset link established.
 *
 * There is no "current password" field because there is no current password in
 * hand - proving control of the mailbox is what the link did. The session this
 * runs against is the one `/auth/callback` created, so an expired or reused
 * link never reaches here: it fails at the exchange.
 */
export async function setPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState | never> {
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (password.length < PASSWORD_MIN_LENGTH) {
    return { error: `Use a password of at least ${PASSWORD_MIN_LENGTH} characters.` };
  }

  // `currentViewer` verifies the token in process against the published JWKS,
  // which is the same check every guard in the app makes.
  if (!(await currentViewer())) {
    return { error: "That link has expired or was already used. Ask for a new one." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  redirect(next);
}
