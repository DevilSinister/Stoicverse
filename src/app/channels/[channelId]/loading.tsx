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
 */
export default function ChannelLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Opening the channel" className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-surgical-steel px-4">
        <div className="size-4 animate-pulse rounded bg-surface-container-high" />
        <div className="h-4 w-40 animate-pulse rounded-lg bg-surface-container-high" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-end gap-5 p-4">
        {Array.from({ length: 8 }, (_, message) => (
          <div key={message} className="flex gap-3">
            <div className="size-10 shrink-0 animate-pulse rounded-full bg-surface-container-high" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-32 animate-pulse rounded-lg bg-surface-container-high" />
              <div
                className="h-3 animate-pulse rounded-lg bg-surface-container-high"
                style={{ width: `${40 + ((message * 23) % 50)}%` }}
              />
              {message % 3 === 0 ? (
                <div
                  className="h-3 animate-pulse rounded-lg bg-surface-container-high"
                  style={{ width: `${30 + ((message * 17) % 35)}%` }}
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 px-4 pb-4">
        <div className="h-12 w-full animate-pulse rounded-xl bg-surface-container-high" />
      </div>

      <span className="sr-only">Opening the channel</span>
    </div>
  );
}
