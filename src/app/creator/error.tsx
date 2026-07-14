"use client";

export default function CreatorError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-surface p-6 text-center"><div><p className="font-headline text-xl text-white">Unable to load the creator workspace.</p><button className="mt-4 rounded-full bg-primary-container px-5 py-2 font-label text-xs text-on-primary-fixed" onClick={reset}>Try again</button></div></main>;
}
