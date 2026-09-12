"use client";

import { useEffect } from "react";

/**
 * The channel pane failed.
 *
 * Scoped to /channels, so the shell and the sidebar survive: a member whose
 * one channel failed to load can still click into another one rather than
 * facing a blank application.
 */
export default function ChannelsError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("[channels]", error.message);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <h1 className="text-base font-semibold text-on-surface">This channel could not be loaded</h1>
        <p className="mt-2 text-sm text-fog-muted">The rest of the community is still available.</p>
        <button
          type="button"
          onClick={reset}
          className="focus-ring mt-4 rounded-lg border border-surgical-steel px-3 py-1.5 text-sm text-on-surface"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
