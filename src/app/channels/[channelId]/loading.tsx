/**
 * Switching channels.
 *
 * This sits inside `channels/layout.tsx`, so the rail and the channel list
 * stay exactly where they are and only this column changes — which is the
 * whole reason the segment needed a boundary of its own. Without one, picking
 * a channel is a dynamic route with nothing to prefetch: the browser holds the
 * previous conversation on screen for the length of the round trip, so the
 * name you clicked goes bold and then nothing happens.
 *
 * Messages are bottom-aligned and of uneven width for the same reason the real
 * list is: a conversation that fills from the top and then jumps to the bottom
 * reads as two loads.
 *
 * Monolith: the shimmer is the shared `Skeleton` atom rather than four inline
 * copies of `animate-pulse rounded-lg bg-surface-container-high`, so a change to
 * the loading treatment cannot land here and miss the workspace skeletons.
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function ChannelLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Opening the channel"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border-hairline px-4">
        <Skeleton className="size-4" />
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-end gap-5 p-4">
        {Array.from({ length: 8 }, (_, message) => (
          <div key={message} className="flex gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton
                className="h-3"
                style={{ width: `${40 + ((message * 23) % 50)}%` }}
              />
              {message % 3 === 0 ? (
                <Skeleton
                  className="h-3"
                  style={{ width: `${30 + ((message * 17) % 35)}%` }}
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* safe-b so the placeholder composer clears the home indicator, exactly as
          the real one now must - /channels had no safe-area handling at all. */}
      <div className="safe-b shrink-0 px-4 pb-4">
        <Skeleton className="h-12 w-full" />
      </div>

      <span className="sr-only">Opening the channel</span>
    </div>
  );
}
