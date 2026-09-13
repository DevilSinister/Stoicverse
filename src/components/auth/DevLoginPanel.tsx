import { FlaskConical } from "lucide-react";

import { DEV_PERSONAS, DEV_PERSONA_LABELS, devLoginBlockers } from "@/lib/dev/login-bypass";

/**
 * Server component. Renders nothing outside development; in development it
 * either offers the three seeded personas or names each unmet condition so the
 * operator knows which variable is missing instead of seeing a blank space.
 */
export function DevLoginPanel() {
  if (process.env.NODE_ENV !== "development") return null;

  const blockers = devLoginBlockers();
  if (blockers.length > 0) {
    return (
      <aside
        aria-label="Development sign-in"
        className="mx-auto mt-content-y w-full max-w-[26rem] rounded-md border border-dashed border-border-hairline p-3.5 text-chrome-sm text-text-muted"
      >
        <p className="font-medium text-text-default">Development sign-in is off.</p>
        <ul className="mt-1 list-disc pl-4">
          {blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
        <p className="mt-1">See .env.example for the three variables.</p>
      </aside>
    );
  }

  const secret = process.env.DEV_LOGIN_SECRET ?? "";

  return (
    <aside
      aria-label="Development sign-in"
      className="mx-auto mt-content-y w-full max-w-[26rem] overflow-hidden rounded-md border border-border-hairline bg-surface-panel"
    >
      <p className="flex items-center gap-2 border-b border-border-hairline px-3 py-2.5 font-mono text-mono-xs tracking-widest text-text-faint uppercase">
        <FlaskConical size={14} aria-hidden="true" />
        Development sign-in
      </p>
      <p className="px-3 pt-2.5 text-chrome-sm text-text-muted">
        Seeds a local test account and signs you in as it. Only reachable from this machine while the bypass is
        enabled.
      </p>
      <div className="grid gap-2 p-3 sm:grid-cols-3">
        {DEV_PERSONAS.map((persona) => (
          <form key={persona} method="post" action="/api/dev/login">
            <input type="hidden" name="as" value={persona} />
            <input type="hidden" name="secret" value={secret} />
            <button
              type="submit"
              className="focus-ring flex min-h-11 w-full flex-col items-start justify-center rounded-lg border border-border-hairline bg-surface-canvas px-2.5 py-2 text-left text-chrome-base font-medium text-text-default transition-colors hover:border-border-strong hover:text-text-strong"
            >
              {DEV_PERSONA_LABELS[persona].label}
              <span className="mt-0.5 text-chrome-sm font-normal text-text-faint">{DEV_PERSONA_LABELS[persona].detail}</span>
            </button>
          </form>
        ))}
      </div>
    </aside>
  );
}
