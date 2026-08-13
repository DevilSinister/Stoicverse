const shimmer = "animate-pulse rounded-lg bg-surface-container-high";

export default function DashboardLoading() {
  return <main aria-busy="true" aria-label="Loading dashboard" className="min-h-screen bg-surface text-on-surface">
    <div className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="max-w-2xl"><div className={`${shimmer} h-3 w-24`} /><div className={`${shimmer} mt-4 h-10 w-3/4 max-w-md`} /><div className={`${shimmer} mt-4 h-5 w-full max-w-xl`} /></div>
      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <section className="grid gap-4 sm:grid-cols-2 lg:col-span-8 lg:gap-6"><MetricSkeleton /><MetricSkeleton /></section>
        <section className="terminal-card min-h-42 p-6 lg:col-span-4"><div className={`${shimmer} h-3 w-28`} /><div className={`${shimmer} mt-5 h-6 w-4/5`} /><div className={`${shimmer} mt-3 h-4 w-full`} /><div className={`${shimmer} mt-2 h-4 w-3/4`} /></section>
        <section className="terminal-card overflow-hidden lg:col-span-8 lg:grid lg:min-h-78 lg:grid-cols-2"><div className="p-7 sm:p-8"><div className={`${shimmer} h-3 w-28`} /><div className={`${shimmer} mt-5 h-7 w-4/5`} /><div className={`${shimmer} mt-4 h-4 w-full`} /><div className={`${shimmer} mt-2 h-4 w-3/4`} /><div className={`${shimmer} mt-7 h-11 w-36 rounded-full`} /></div><div className="hidden bg-surface-container-highest lg:block" /></section>
      </div>
    </div>
    <span className="sr-only">Loading your dashboard</span>
  </main>;
}

function MetricSkeleton() {
  return <section className="terminal-card min-h-42 p-6"><div className={`${shimmer} h-3 w-28`} /><div className={`${shimmer} mt-9 h-9 w-3/5`} /><div className={`${shimmer} mt-3 h-3 w-2/5`} /></section>;
}
