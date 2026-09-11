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
        className="mx-auto mt-6 w-full max-w-md rounded-xl border border-dashed border-surgical-steel p-4 text-xs leading-5 text-fog-muted"
      >
        <p className="font-semibold text-on-surface-variant">Development sign-in is off.</p>
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
      className="mx-auto mt-6 w-full max-w-md rounded-xl border border-surgical-steel bg-surface-container-low p-4"
    >
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fog-muted">
        <FlaskConical size={14} aria-hidden="true" />
        Development sign-in
      </p>
      <p className="mt-1 text-xs leading-5 text-on-surface-variant">
        Seeds a local test account and signs you in as it. Only reachable from this machine while the bypass is
        enabled.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {DEV_PERSONAS.map((persona) => (
          <form key={persona} method="post" action="/api/dev/login">
            <input type="hidden" name="as" value={persona} />
            <input type="hidden" name="secret" value={secret} />
            <button
              type="submit"
              className="focus-ring flex min-h-11 w-full flex-col items-start rounded-lg border border-surgical-steel bg-monolith-surface px-3 py-2 text-left text-sm font-semibold text-on-surface hover:bg-surface-container-high"
            >
              {DEV_PERSONA_LABELS[persona].label}
              <span className="text-xs font-normal text-fog-muted">{DEV_PERSONA_LABELS[persona].detail}</span>
            </button>
          </form>
        ))}
      </div>
    </aside>
  );
}
