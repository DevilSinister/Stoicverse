"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { ArrowRight, LogIn, Shield } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

function Field({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block group">
      <span className="font-label-sm text-label-sm uppercase tracking-[0.14em] text-fog-muted group-focus-within:text-primary-container transition-colors duration-200">
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-12 w-full rounded border border-surgical-steel bg-surface-container-lowest px-5 text-on-surface outline-none placeholder:text-fog-muted focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all duration-200 hover:border-primary-container/70"
      />
    </label>
  );
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const searchParams = useSearchParams();
  const isSignup = mode === "signup";
  const requestedNext = searchParams.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/dashboard";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const supabase = createClient();
    const result = isSignup
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            data: fullName.trim() ? { full_name: fullName.trim() } : undefined,
          },
        })
      : await supabase.auth.signInWithPassword({
          email,
          password,
        });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    if (isSignup && !result.data.session) {
      setMessage("Check your inbox to confirm your account, then come back to log in.");
      setLoading(false);
      return;
    }

    // Let the browser send the new Supabase cookie before the server validates membership.
    window.location.assign(next);
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface lg:grid lg:grid-cols-[1fr_30rem]">
      {/* Editorial Panel */}
      <section className="hidden border-r border-surgical-steel p-12 lg:flex lg:flex-col lg:justify-between relative overflow-hidden bg-surface-container-low">
        <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(#334155_1px,transparent_1px),linear-gradient(90deg,#334155_1px,transparent_1px)] [background-size:60px_60px]" />
        
        <div className="relative z-10">
          <Link
            href="/"
            className="font-headline-sm text-headline-sm text-primary-container tracking-wider font-bold"
          >
            Stoicverse
          </Link>
        </div>

        <div className="relative z-10 my-auto max-w-2xl border-l-2 border-primary-container pl-8 py-6">
          <h1 className="font-display text-4xl font-extrabold text-white leading-tight">
            Enter the operating surface for disciplined study.
          </h1>
          <p className="mt-6 max-w-xl font-body text-base text-on-surface-variant leading-relaxed">
            Membership unlocks community channels, tier-one lessons, and the path toward Master access.
          </p>
        </div>

        <div className="relative z-10 text-xs text-fog-muted font-label uppercase tracking-[0.2em]">
          system_entry // secure_access_portal
        </div>
      </section>

      {/* Form Panel */}
      <section className="relative flex items-center justify-center p-6 md:p-12 overflow-hidden bg-surface">
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(#334155_1px,transparent_1px),linear-gradient(90deg,#334155_1px,transparent_1px)] [background-size:60px_60px]" />

        <form
          onSubmit={handleSubmit}
          className="relative z-10 w-full max-w-md border-t-2 border-t-primary-container border-x border-b border-surgical-steel bg-monolith-surface p-8 md:p-10 rounded-lg shadow-xl hover:shadow-primary-container/5 transition-all duration-300"
        >
          <div className="mb-8 flex items-center gap-3 text-primary-container">
            {isSignup ? <Shield size={24} className="animate-pulse" /> : <LogIn size={24} />}
            <h1 className="font-headline text-xl font-bold tracking-wide">
              {isSignup ? "Sign up" : "Log in"}
            </h1>
          </div>

          <div className="space-y-5">
            {isSignup && (
              <Field
                label="Full name"
                placeholder="Marcus North"
                value={fullName}
                onChange={setFullName}
              />
            )}

            <Field
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={setEmail}
            />

            <Field
              label="Password"
              placeholder="Minimum 8 characters"
              type="password"
              value={password}
              onChange={setPassword}
            />
          </div>

          <button
            className="mt-8 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-container font-label-md text-label-md text-on-primary-fixed uppercase tracking-wider hover:brightness-105 active:scale-[0.98] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-70 emerald-glow"
            type="submit"
            disabled={loading}
          >
            {loading ? "Working..." : isSignup ? "Create account" : "Enter platform"}
            {!loading && <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />}
          </button>

          {error && (
            <p className="mt-4 text-sm text-red-400 font-body">
              {error}
            </p>
          )}

          {message && (
            <p className="mt-4 text-sm text-primary-container font-body">
              {message}
            </p>
          )}

          <p className="mt-6 text-center text-sm text-fog-muted font-body">
            {isSignup ? "Already registered?" : "Need access?"}{" "}
            <Link
              href={isSignup ? "/login" : "/signup"}
              className="text-primary-container hover:underline transition-all font-semibold"
            >
              {isSignup ? "Log in" : "Sign up"}
            </Link>
          </p>
        </form>
      </section>
    </div>
  );
}
