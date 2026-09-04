export default function CreatorMembersLoading() {
  return <main aria-busy="true" aria-label="Loading members" className="mx-auto w-full max-w-[1440px] animate-pulse px-4 py-8 sm:px-6 lg:px-10"><div className="h-5 w-40 rounded bg-surface-container-high" /><div className="mt-4 h-10 w-72 max-w-full rounded bg-surface-container-high" /><div className="mt-8 h-14 rounded-xl bg-surface-container-high" /><div className="mt-6 overflow-hidden rounded-xl border border-surgical-steel"><div className="h-14 bg-surface-container-low" />{[1,2,3,4,5,6].map((row) => <div key={row} className="h-16 border-t border-surgical-steel bg-surface-container-lowest" />)}</div></main>;
}

