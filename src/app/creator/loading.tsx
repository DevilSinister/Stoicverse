const shimmer = "animate-pulse rounded-lg bg-surface-container-high";

export default function CreatorLoading() {
  return <main aria-busy="true" aria-label="Loading creator workspace" className="min-h-screen bg-surface text-on-surface">
    <div className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex flex-wrap items-start justify-between gap-5"><div className="max-w-2xl"><div className={`${shimmer} h-9 w-56`} /><div className={`${shimmer} mt-3 h-4 w-[min(32rem,80vw)]`} /></div><div className={`${shimmer} h-11 w-40 rounded-full`} /></div>
      <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-4"><MetricSkeleton /><MetricSkeleton /><MetricSkeleton /><MetricSkeleton /></div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.9fr)]"><section className="terminal-card p-6"><div className={`${shimmer} h-4 w-32`} /><div className={`${shimmer} mt-7 h-64 w-full`} /></section><section className="terminal-card p-6"><div className={`${shimmer} h-4 w-28`} /><div className="mt-7 space-y-5"><div className={`${shimmer} h-12 w-full`} /><div className={`${shimmer} h-12 w-full`} /><div className={`${shimmer} h-12 w-4/5`} /></div></section></div>
    </div>
    <span className="sr-only">Loading your creator workspace</span>
  </main>;
}

function MetricSkeleton() {
  return <section className="terminal-card min-h-36 p-6"><div className={`${shimmer} h-3 w-24`} /><div className={`${shimmer} mt-7 h-8 w-3/5`} /><div className={`${shimmer} mt-3 h-3 w-2/5`} /></section>;
}
