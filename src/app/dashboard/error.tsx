"use client";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-[var(--color-surface-container-lowest)] p-6 text-[var(--color-on-surface)]"><section className="max-w-md border border-[var(--color-surgical-steel)] bg-[var(--color-monolith-surface)] p-8"><p className="font-label-sm text-xs uppercase tracking-[0.16em] text-[var(--color-primary-container)]">Dashboard unavailable</p><h1 className="mt-3 font-headline-md text-headline-md">We could not load your latest data.</h1><p className="mt-3 text-[var(--color-on-surface-variant)]">Please try again. If this persists, your membership data may need attention.</p><button onClick={reset} className="mt-6 min-h-11 rounded-full bg-[var(--color-primary-container)] px-5 font-label-md text-label-md text-[var(--color-on-primary-fixed)]">Try again</button></section></main>;
}
