"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type AuthActionState = {
  error?: string;
  message?: string;
};

function safeNextPath(candidate: FormDataEntryValue | null) {
  if (typeof candidate !== "string") {
    return "/dashboard";
  }

  return candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/dashboard";
}

function appOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function loginAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState | never> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect(next);
}

export async function signupAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState | never> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!fullName || !email || !password) {
    return { error: "Enter a username, email, and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { full_name: fullName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.session) {
    redirect(next);
  }

  return {
    message: "Check your inbox to confirm your account, then come back to log in.",
  };
}
