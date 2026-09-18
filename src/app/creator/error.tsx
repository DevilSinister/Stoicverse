"use client";

export default function CreatorError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-surface p-6 text-center"><div><p className="text-title-sm font-medium text-text-strong">Unable to load the creator workspace.</p><button className="mt-4 rounded-lg bg-primary px-5 py-2 text-chrome-base font-medium text-primary-foreground" onClick={reset}>Try again</button></div></main>;
}
