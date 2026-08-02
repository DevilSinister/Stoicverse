"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check, CircleAlert, Eye, EyeOff, LoaderCircle, MailCheck } from "lucide-react";

import { loginAction, signupAction } from "@/app/auth/actions";
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

function FieldShell({
  id,
  label,
  hint,
  hintId,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  hintId?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-on-surface-variant"
      >
        {label}
      </label>
      {/* Spacing lives here, not on the input: the password field's relative
          wrapper must match the input box exactly so the show/hide button
          centers against the field rather than against field-plus-margin. */}
      <div className="mt-2">{children}</div>
      {hint && (
        <p id={hintId} className="mt-2 text-xs leading-relaxed text-fog-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "min-h-12 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest px-4 text-on-surface outline-none transition duration-150 placeholder:text-fog-muted hover:border-surgical-steel/80 focus:border-primary-container focus:ring-1 focus:ring-primary-container aria-[invalid=true]:border-error";

function TextField({
  id,
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
  hint,
  invalid,
  ...rest
}: {
  id: string;
  label: string;
  name: string;
  type?: string;
  placeholder: string;
  autoComplete: string;
  hint?: string;
  invalid?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <FieldShell id={id} label={label} hint={hint} hintId={hintId}>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        aria-invalid={invalid || undefined}
        aria-describedby={hintId}
        className={inputClass}
        {...rest}
      />
    </FieldShell>
  );
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  hint,
  minLength,
  invalid,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  hint?: string;
  minLength?: number;
  invalid?: boolean;
  value: string;
  onChange: (next: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;
  const capsId = `${id}-caps`;

  return (
    <FieldShell id={id} label={label} hint={hint} hintId={hintId}>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          placeholder={visible ? "your password" : "••••••••"}
          autoComplete={autoComplete}
          minLength={minLength}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={[hintId, capsLock ? capsId : null].filter(Boolean).join(" ") || undefined}
          // Not cleared on blur: Caps Lock does not turn off because the field
          // lost focus, and clearing it hid the warning at the moment the user
          // tabbed to submit.
          onKeyUp={(event) => setCapsLock(event.getModifierState?.("CapsLock") ?? false)}
          className={`${inputClass} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="focus-ring absolute right-0.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-md text-fog-muted transition hover:text-primary-container"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {capsLock && (
        <p id={capsId} className="mt-2 text-xs text-on-surface-variant">
          Caps Lock is on.
        </p>
      )}
    </FieldShell>
  );
}

function SignupRail() {
  return (
    <ol className="space-y-1">
      {SIGNUP_STEPS.map((step, index) => {
        const isCurrent = index === 0;
        return (
          <li key={step.title} className="flex gap-4">
            <div className="flex flex-col items-center" aria-hidden>
              <span
                className={
                  isCurrent
                    ? "grid size-7 shrink-0 place-items-center rounded-full bg-primary-container text-xs font-bold text-on-primary-fixed"
                    : "grid size-7 shrink-0 place-items-center rounded-full border border-surgical-steel text-xs font-semibold tabular-nums text-fog-muted"
                }
              >
                {isCurrent ? <Check size={14} strokeWidth={3} /> : index + 1}
              </span>
              {index < SIGNUP_STEPS.length - 1 && (
                <span className="my-1 w-px flex-1 bg-surgical-steel" />
              )}
            </div>
            <div className="pb-6">
              <p className={isCurrent ? "text-sm font-semibold text-white" : "text-sm font-medium text-on-surface-variant"}>
                {step.title}
                {isCurrent && <span className="sr-only"> (current step)</span>}
              </p>
              <p className="mt-1 max-w-[42ch] text-sm leading-relaxed text-fog-muted">{step.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Phones never see the rail, so the same four steps arrive as a segmented bar.
 *  Losing the sequence entirely is what made the email-confirmation step a
 *  surprise in the first place. */
function MobileStepper() {
  return (
    <div className="lg:hidden">
      <p className="text-sm font-medium text-white">
        Step 1 of {SIGNUP_STEPS.length} · {SIGNUP_STEPS[0].title}
      </p>
      <ol aria-hidden className="mt-3 flex gap-1.5">
        {SIGNUP_STEPS.map((step, index) => (
          <li
            key={step.title}
            className={`h-1 flex-1 rounded-full ${index === 0 ? "bg-primary-container" : "bg-surgical-steel"}`}
          />
        ))}
      </ol>
      <p className="mt-3 text-sm leading-relaxed text-fog-muted">
        Next you confirm your email and activate membership, then you are in.
      </p>
    </div>
  );
}

function ConfirmEmailPanel({ email, message }: { email: string; message: string }) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // This panel replaces the form, so the focused submit button is unmounted and
  // focus would otherwise fall back to <body> with nothing announced.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div
      role="status"
      className="settle w-full max-w-md rounded-2xl border border-surgical-steel bg-monolith-surface p-8 md:p-10"
    >
      <div className="grid size-12 place-items-center rounded-full border border-primary-container/40 bg-primary-container/10 text-primary-container">
        <MailCheck size={22} />
      </div>
      <h1 ref={headingRef} tabIndex={-1} className="focus-ring mt-6 text-2xl font-bold tracking-[-0.02em] text-white">
        Check your inbox
      </h1>
      <p className="mt-3 leading-relaxed text-on-surface-variant">
        {email ? (
          <>
            We sent a confirmation link to <span className="font-medium text-white">{email}</span>. Open it to
            verify your account, then log in to continue.
          </>
        ) : (
          message
        )}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-fog-muted">
        The link can take a minute to arrive. Check your spam folder before requesting another.
      </p>
      <Link
        href="/login"
        className="focus-ring emerald-glow mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-container px-6 text-[15px] font-semibold text-on-primary-fixed transition duration-150 hover:brightness-110 active:translate-y-px"
      >
        Go to log in
        <ArrowRight size={16} />
      </Link>
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

  const awaitingConfirmation = Boolean(state.message);

  return (
    // svh, not vh: mobile browser chrome makes 100vh taller than the visible
    // area, which pushes the submit button under the URL bar.
    <div className="min-h-[100svh] bg-surface text-on-surface lg:grid lg:min-h-screen lg:grid-cols-[1fr_34rem]">
      {/* Context rail */}
      <section className="relative hidden overflow-hidden border-r border-surgical-steel bg-surface-container-low p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_75%_60%_at_20%_0%,#000,transparent_75%)]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-surgical-steel) 1px, transparent 1px), linear-gradient(90deg, var(--color-surgical-steel) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />

        <Link href="/" className="focus-ring relative z-10 inline-flex text-lg font-bold tracking-[-0.02em] text-white">
          Stoicverse
        </Link>

        <div className="relative z-10 my-auto max-w-lg py-10">
          <h2 className="text-balance text-[clamp(1.75rem,2.4vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.025em] text-white">
            {isSignup ? "Four steps to a deliberate practice." : "Enter the operating surface for disciplined study."}
          </h2>

          {isSignup ? (
            <div className="mt-10">
              <SignupRail />
            </div>
          ) : (
            <p className="mt-6 max-w-[54ch] leading-relaxed text-on-surface-variant">
              Membership unlocks community channels, tier-one lessons, and the path toward Master access.
            </p>
          )}
        </div>

        <p className="relative z-10 max-w-xs text-sm leading-relaxed text-fog-muted">
          A quiet place to study, practice, and build a more deliberate life.
        </p>
      </section>

      {/* Form */}
      <section
        className="flex min-h-[100svh] flex-col justify-center bg-surface px-4 py-8 sm:px-8 sm:py-10 md:px-12 lg:min-h-screen"
        style={{
          paddingTop: "max(2rem, env(safe-area-inset-top))",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <div className="mx-auto w-full max-w-md">
          {!isSignup && !awaitingConfirmation && (
            <div className="mb-7 flex flex-col items-center text-center lg:hidden">
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-white">
                Enter Stoicverse
              </h1>
            </div>
          )}

          {/* Signup keeps the mobile intro so the step sequence does not disappear. */}
          {isSignup && !awaitingConfirmation && (
            <div className="mb-7 lg:hidden">
              <Link
                href="/"
                className="focus-ring -my-2 inline-flex min-h-11 items-center text-lg font-bold tracking-[-0.02em] text-white"
              >
                Stoicverse
              </Link>
              <div className="mt-5">
                <MobileStepper />
              </div>
            </div>
          )}

          {awaitingConfirmation ? (
            <ConfirmEmailPanel email={email} message={state.message ?? ""} />
          ) : (
            <form
              action={formAction}
              noValidate={false}
              className="settle rounded-2xl border border-surgical-steel bg-monolith-surface p-6 sm:p-8 md:p-10"
            >
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-white">
                {isSignup ? "Create your account" : "Log in"}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                {isSignup ? (
                  <>
                    Already registered?{" "}
                    <Link href="/login" className="focus-ring font-medium text-primary-container hover:underline">
                      Log in
                    </Link>
                  </>
                ) : (
                  <>
                    Need access?{" "}
                    <Link href="/signup" className="focus-ring font-medium text-primary-container hover:underline">
                      Create an account
                    </Link>
                  </>
                )}
              </p>

              {arrivalNotice && (
                <p className="mt-6 rounded-lg border border-surgical-steel bg-surface-container-high/60 p-4 text-sm leading-relaxed text-on-surface-variant">
                  {arrivalNotice}
                </p>
              )}

              <input type="hidden" name="next" value={next} />

              <div className="mt-8 space-y-5">
                {isSignup && (
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
                )}

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
                  value={password}
                  onChange={setPassword}
                />
              </div>

              {!isSignup && (
                <p className="mt-4 text-sm text-fog-muted">
                  Confirm your email address before your first log in.
                </p>
              )}

              {/* Above the button on purpose: below it, the message sits under
                  the fold on a 360x740 phone and the tap reads as a no-op.
                  role="alert" is its own live region — wrapping it in another
                  aria-live makes NVDA announce it twice. */}
              {state.error && (
                <div
                  ref={errorRef}
                  role="alert"
                  tabIndex={-1}
                  className="focus-ring mt-6 flex gap-3 rounded-lg border border-error/40 bg-error/10 p-4"
                >
                  <CircleAlert size={17} className="mt-0.5 shrink-0 text-error" />
                  <p className="text-sm leading-relaxed text-error">{state.error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={pending}
                className="focus-ring emerald-glow mt-8 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-container px-6 text-[15px] font-semibold text-on-primary-fixed transition duration-150 hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
              >
                {pending ? (
                  <>
                    <LoaderCircle size={16} className="animate-spin" />
                    {isSignup ? "Creating your account…" : "Logging you in…"}
                  </>
                ) : (
                  <>
                    {isSignup ? "Create account" : "Log in"}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {isSignup && (
                <p className="mt-6 text-xs leading-relaxed text-fog-muted">
                  By creating an account you agree to our{" "}
                  <Link href="/terms" className="focus-ring text-on-surface-variant underline hover:text-primary-container">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="focus-ring text-on-surface-variant underline hover:text-primary-container">
                    Privacy Policy
                  </Link>
                  .
                </p>
              )}
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
