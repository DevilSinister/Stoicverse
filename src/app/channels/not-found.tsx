import Link from "next/link";

export default function ChannelNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <h1 className="text-base font-semibold text-on-surface">That channel is not here</h1>
        <p className="mt-2 text-sm text-fog-muted">
          It may have been deleted, or you may not have access to it.
        </p>
        <Link
          href="/channels"
          className="focus-ring mt-4 inline-flex rounded-lg border border-surgical-steel px-3 py-1.5 text-sm text-on-surface"
        >
          Back to the community
        </Link>
      </div>
    </div>
  );
}
