"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PASSWORD_MIN_LENGTH } from "@/lib/auth/policy";
import { isRateLimited } from "@/lib/security/request";
import { safeNextPath } from "@/lib/security/safe-path";
import { createClient } from "@/lib/supabase/server";

type AuthActionState = {
  error?: string;
  message?: string;
};

const LOGIN_IP_LIMIT = 20;
const LOGIN_ACCOUNT_LIMIT = 8;
const SIGNUP_IP_LIMIT = 6;
const RATE_WINDOW_MS = 10 * 60 * 1000;

/** Uniform reply for signup so the response cannot be used to test whether an
 *  address is already registered. */
const SIGNUP_ACK =
  "If that email is not already registered, a confirmation link is on its way. Open it to verify your account, then log in.";

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
    // only errors surfaced are the ones the user can act on.
    const actionable = /password|username|full_name|name/i.test(error.message);
    return actionable ? { error: error.message } : { message: SIGNUP_ACK };
  }

  if (data.session) {
    redirect(next);
  }

  return { message: SIGNUP_ACK };
}
