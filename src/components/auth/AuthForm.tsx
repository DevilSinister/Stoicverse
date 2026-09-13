"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { loginAction, signupAction } from "@/app/auth/actions";
import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import { ErrorNote, PasswordField, SubmitButton, TextField } from "@/components/auth/AuthFields";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/policy";
import { safeNextPath } from "@/lib/security/safe-path";

type AuthState = {
  error?: string;
  message?: string;
};

const initialState: AuthState = {};

/** Reasons another surface can send someone to /login. Without these, the
 *  redirect from an expired confirmation link lands on a bare form with no
 *  explanation of what just failed. */
const ARRIVAL_NOTICES: Record<string, string> = {
  link_expired:
    "That confirmation link has expired or was already used. Log in below, or sign up again to get a new one.",
  session_expired: "Your session ended. Log in to pick up where you left off.",
};

/** The path a new member actually walks. Step 2 exists because email
 *  confirmation is otherwise a surprise that arrives after submit. */
const SIGNUP_STEPS = [
  { title: "Create your account", detail: "Username, email, and a password." },
  { title: "Confirm your email", detail: "We send a link to verify the address." },
  { title: "Activate membership", detail: "$10 per month. Cancel before your next renewal." },
  { title: "Enter Stoicverse", detail: "Community, curriculum, events, and your progression path." },
];

/**
 * The four steps, on the hairline grid the rest of Monolith is built from.
 *
 * The number is the marker rather than a filled disc, and the step you are on
 * is the only one at full strength — which makes it the only accent on the
 * panel, and the submit button the only other accent on the screen.
 */
function SignupSteps() {
  return (
    <ol className="mt-content-y border-t border-border-hairline">
      {SIGNUP_STEPS.map((step, index) => {
        const current = index === 0;
        return (
          <li
            key={step.title}
            aria-current={current ? "step" : undefined}
            className="grid grid-cols-[1.75rem_1fr] gap-3.5 border-b border-border-hairline py-4"
          >
            <span className={`pt-0.5 font-mono text-mono-xs ${current ? "text-primary" : "text-text-faint"}`}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>
              <span className={`block text-content-sm font-medium ${current ? "text-text-strong" : "text-text-muted"}`}>
                {step.title}
                {current ? <span className="sr-only"> (current step)</span> : null}
              </span>
              <span className="mt-0.5 block max-w-[42ch] text-chrome-base text-text-faint">{step.detail}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Phones never see the left panel, so the same four steps arrive as a count
 *  and a rule. Losing the sequence entirely is what made the email-confirmation
 *  step a surprise in the first place. */
function MobileStepper() {
  return (
    <div className="lg:hidden">
      <p className="font-mono text-mono-xs tracking-wider text-text-faint">
        {`Step 1 of ${SIGNUP_STEPS.length} · ${SIGNUP_STEPS[0].title}`}
      </p>
      <ol aria-hidden className="mt-2 flex gap-1.5">
        {SIGNUP_STEPS.map((step, index) => (
          <li key={step.title} className={`h-0.5 flex-1 ${index === 0 ? "bg-primary" : "bg-border-strong"}`} />
        ))}
      </ol>
    </div>
  );
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const searchParams = useSearchParams();
  const isSignup = mode === "signup";
  // Validated again server-side in the action; this only keeps the hidden field
  // from carrying an obviously hostile value.
  const next = safeNextPath(searchParams.get("next"));
  const arrivalNotice = ARRIVAL_NOTICES[searchParams.get("error") ?? ""];
  const action = isSignup ? signupAction : loginAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  // Controlled, because React resets uncontrolled fields once a form action
  // settles — including on a failed submit, which would silently wipe what the
  // user typed. Retyping on a phone is the worst version of that.
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const errorRef = useRef<HTMLDivElement | null>(null);
  const uid = useId();

  // Move the user to the failure reason rather than leaving them at a button
  // that appears to have done nothing.
  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state.error]);

  const ids = {
    fullName: `${uid}-username`,
    email: `${uid}-email`,
    password: `${uid}-password`,
  };

  return (
    <AuthShell
      headline={isSignup ? "Four steps to a deliberate practice." : "Enter the operating surface for disciplined study."}
      lede={
        isSignup
          ? undefined
          : "Membership unlocks community channels, tier-one lessons, and the path toward Master access."
      }
      aside={isSignup ? <SignupSteps /> : undefined}
    >
      {isSignup ? (
        <div className="mb-content-gap lg:hidden">
          <MobileStepper />
        </div>
      ) : null}

      <AuthHeading title={isSignup ? "Create your account" : "Log in"}>
        {isSignup ? (
          <>
            Already registered?{" "}
            <Link href="/login" className="focus-ring font-medium text-primary hover:underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            Need access?{" "}
            <Link href="/signup" className="focus-ring font-medium text-primary hover:underline">
              Create an account
            </Link>
          </>
        )}
      </AuthHeading>

      {/*
        A rule and a raised panel rather than a bordered box with a tint. The
        notice is an arrival state: it says what just happened, above the form
        somebody is about to fill in again.
      */}
      {arrivalNotice ? (
        <p className="mt-content-gap border-l-2 border-border-strong bg-surface-panel px-3.5 py-3 text-chrome-base text-text-default">
          {arrivalNotice}
        </p>
      ) : null}

      <form action={formAction} className="mt-content-y">
        <input type="hidden" name="next" value={next} />

        <div className="flex flex-col gap-content-gap">
          {isSignup ? (
            <TextField
              id={ids.fullName}
              name="fullName"
              label="Username"
              placeholder="marcus_north"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={40}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          ) : null}

          <TextField
            id={ids.email}
            name="email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <PasswordField
            id={ids.password}
            name="password"
            label="Password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={isSignup ? PASSWORD_MIN_LENGTH : undefined}
            hint={isSignup ? `At least ${PASSWORD_MIN_LENGTH} characters.` : undefined}
            /*
              The product had no way back from a forgotten password until now,
              and the place people look for one is beside the field that is
              refusing them — not at the foot of the form.
            */
            action={
              isSignup ? undefined : (
                <Link href="/auth/reset" className="focus-ring text-chrome-base text-text-muted hover:text-text-strong">
                  Forgot password?
                </Link>
              )
            }
            value={password}
            onChange={setPassword}
          />
        </div>

        {state.error ? (
          <div ref={errorRef}>
            <ErrorNote>{state.error}</ErrorNote>
          </div>
        ) : null}

        <SubmitButton pending={pending} pendingLabel={isSignup ? "Creating your account…" : "Logging you in…"}>
          {isSignup ? "Create account" : "Log in"}
          <ArrowRight size={16} />
        </SubmitButton>

        {isSignup ? (
          <p className="mt-content-gap text-chrome-sm text-text-faint">
            By creating an account you agree to our{" "}
            <Link href="/terms" className="focus-ring text-text-muted underline hover:text-text-strong">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="focus-ring text-text-muted underline hover:text-text-strong">
              Privacy Policy
            </Link>
            .
          </p>
        ) : null}
      </form>
    </AuthShell>
  );
}
