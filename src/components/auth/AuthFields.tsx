"use client";

import { useState } from "react";
import { CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";

/**
 * The fields every signed-out form is built from.
 *
 * Lifted out of `AuthForm` when phase 4 added password reset: the same text
 * field, the same show/hide password field and the same error note were about
 * to exist in three files, which is how two of them drift.
 *
 * Monolith density: a 44px control with a 4px corner and a hairline, not a 48px
 * one with a 12px corner. The focus state is the accent, and it is the only
 * place the accent appears on these screens other than the submit button.
 */

const inputClass =
  "h-11 w-full rounded-lg border border-border-hairline bg-surface-panel px-3 text-content-sm text-text-strong outline-none transition-colors " +
  "placeholder:text-text-faint hover:border-border-strong " +
  "focus:border-primary focus:ring-1 focus:ring-primary aria-[invalid=true]:border-status-danger";

function FieldShell({
  id,
  label,
  hint,
  hintId,
  action,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  hintId?: string;
  /** A control that belongs to the label row - "Forgot password?". */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="block text-chrome-base font-medium text-text-default">
          {label}
        </label>
        {action}
      </div>
      {/* Spacing lives here, not on the input: the password field's relative
          wrapper must match the input box exactly so the show/hide button
          centers against the field rather than against field-plus-margin. */}
      <div className="mt-1.5">{children}</div>
      {hint ? (
        <p id={hintId} className="mt-1.5 text-chrome-sm text-text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
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

export function PasswordField({
  id,
  name,
  label,
  autoComplete,
  hint,
  minLength,
  invalid,
  action,
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
  action?: React.ReactNode;
  value: string;
  onChange: (next: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;
  const capsId = `${id}-caps`;

  return (
    <FieldShell id={id} label={label} hint={hint} hintId={hintId} action={action}>
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
          className={`${inputClass} pr-11`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="focus-ring absolute top-0 right-0 grid h-11 w-11 place-items-center rounded-lg text-text-muted transition-colors hover:text-text-strong"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {capsLock ? (
        <p id={capsId} className="mt-1.5 text-chrome-sm text-text-muted">
          Caps Lock is on.
        </p>
      ) : null}
    </FieldShell>
  );
}

/**
 * The failure, above the button.
 *
 * Below it, on a 375x812 phone, the message lands under the fold and the tap
 * reads as a no-op. `role="alert"` is its own live region - wrapping it in
 * another `aria-live` makes NVDA announce it twice.
 */
export function ErrorNote({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <div
      id={id}
      role="alert"
      tabIndex={-1}
      className="focus-ring mt-content-gap flex gap-2.5 rounded-lg border border-status-danger/40 bg-status-danger/10 p-3"
    >
      <CircleAlert size={16} className="mt-px shrink-0 text-status-danger" />
      <p className="text-chrome-base text-status-danger">{children}</p>
    </div>
  );
}

/** The one accent-filled control on the screen. */
export function SubmitButton({
  pending,
  pendingLabel,
  children,
}: {
  pending: boolean;
  pendingLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="focus-ring mt-content-y flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-content-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <LoaderCircle size={16} className="animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
