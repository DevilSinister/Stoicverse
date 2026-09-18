"use client";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-surface-sunken p-6 text-text-default"><section className="max-w-md rounded-lg border border-border-hairline bg-surface-panel p-8"><p className="font-mono text-mono-xs uppercase tracking-[0.16em] text-primary">Dashboard unavailable</p><h1 className="mt-3 text-title-lg font-medium text-text-strong">We could not load your latest data.</h1><p className="mt-3 text-text-default">Please try again. If this persists, your membership data may need attention.</p><button onClick={reset} className="mt-6 min-h-11 rounded-lg bg-primary px-5 text-chrome-base font-medium text-primary-foreground">Try again</button></section></main>;
}
