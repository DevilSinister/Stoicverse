import { BookOpen } from "lucide-react";

export default function Curriculum() {
  return (
    <section id="curriculum" className="py-16 border-b border-[var(--color-surgical-steel)]">
      <div className="px-4 md:px-8 lg:px-16 mb-8">
        <h2 className="font-headline-md text-headline-md text-[var(--color-on-surface)] flex items-center gap-3">
          <BookOpen className="text-[var(--color-primary-container)]" size={32} strokeWidth={1} />
          The Curriculum
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 border-t border-b border-[var(--color-surgical-steel)] divide-y md:divide-y-0 md:divide-x divide-[var(--color-surgical-steel)]">
        {/* Tier 1 */}
        <div className="bg-[var(--color-monolith-surface)] p-8 hover:bg-[var(--color-surface-container-high)] transition-colors group cursor-pointer flex flex-col h-full">
          <div className="font-label-md text-label-md text-[var(--color-primary-container)] mb-4">01 / PERCEPTION</div>
          <h3 className="font-headline-sm text-headline-sm text-[var(--color-on-surface)] mb-2">The Objective View</h3>
          <p className="font-body-sm text-body-sm text-[var(--color-on-surface-variant)] mb-8 flex-grow">Stripping events of value judgments to see them as they truly are.</p>
          <div className="w-full h-hairline bg-[var(--color-surgical-steel)] group-hover:bg-[var(--color-primary-container)] transition-colors"></div>
        </div>
        {/* Tier 2 */}
        <div className="bg-[var(--color-monolith-surface)] p-8 hover:bg-[var(--color-surface-container-high)] transition-colors group cursor-pointer flex flex-col h-full">
          <div className="font-label-md text-label-md text-[var(--color-primary-container)] mb-4">02 / ACTION</div>
          <h3 className="font-headline-sm text-headline-sm text-[var(--color-on-surface)] mb-2">The Directed Will</h3>
          <p className="font-body-sm text-body-sm text-[var(--color-on-surface-variant)] mb-8 flex-grow">Acting with a reserve clause. Doing what is right regardless of outcome.</p>
          <div className="w-full h-hairline bg-[var(--color-surgical-steel)] group-hover:bg-[var(--color-primary-container)] transition-colors"></div>
        </div>
        {/* Tier 3 */}
        <div className="bg-[var(--color-monolith-surface)] p-8 hover:bg-[var(--color-surface-container-high)] transition-colors group cursor-pointer flex flex-col h-full">
          <div className="font-label-md text-label-md text-[var(--color-primary-container)] mb-4">03 / WILL</div>
          <h3 className="font-headline-sm text-headline-sm text-[var(--color-on-surface)] mb-2">Amor Fati</h3>
          <p className="font-body-sm text-body-sm text-[var(--color-on-surface-variant)] mb-8 flex-grow">Embracing all that happens as necessary and beneficial to the whole.</p>
          <div className="w-full h-hairline bg-[var(--color-surgical-steel)] group-hover:bg-[var(--color-primary-container)] transition-colors"></div>
        </div>
        {/* Tier 4 */}
        <div className="bg-[var(--color-monolith-surface)] p-8 hover:bg-[var(--color-surface-container-high)] transition-colors group cursor-pointer flex flex-col h-full">
          <div className="font-label-md text-label-md text-[var(--color-primary-container)] mb-4">04 / SYNTHESIS</div>
          <h3 className="font-headline-sm text-headline-sm text-[var(--color-on-surface)] mb-2">The Inner Citadel</h3>
          <p className="font-body-sm text-body-sm text-[var(--color-on-surface-variant)] mb-8 flex-grow">Constructing an impenetrable fortress of reason against external chaos.</p>
          <div className="w-full h-hairline bg-[var(--color-surgical-steel)] group-hover:bg-[var(--color-primary-container)] transition-colors"></div>
        </div>
      </div>
    </section>
  );
}
