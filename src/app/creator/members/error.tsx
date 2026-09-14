"use client";

import { AlertCircle } from "lucide-react";

export default function CreatorMembersError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-[70vh] place-items-center px-6 text-center"><div><AlertCircle className="mx-auto text-error" size={30} /><h1 className="mt-4 font-headline text-2xl font-semibold text-text-strong">Member operations unavailable</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant">The registry could not be loaded. Retry the request; no member data was changed.</p><button type="button" onClick={reset} className="focus-ring mt-5 min-h-11 rounded-lg border border-surgical-steel px-5 text-sm font-semibold text-text-strong hover:border-primary-container">Try again</button></div></main>;
}
