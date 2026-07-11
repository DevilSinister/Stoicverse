import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="min-h-[819px] flex flex-col justify-center px-4 md:px-8 lg:px-16 border-b border-[var(--color-surgical-steel)] relative overflow-hidden">
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none" 
        style={{ backgroundImage: "radial-gradient(circle at 50% 50%, var(--color-primary-container) 0%, transparent 60%)" }}
      ></div>
      <div className="max-w-4xl relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-12 border-l border-[var(--color-surgical-steel)] pl-4 md:pl-8">
          <div className="font-label-sm text-label-sm text-[var(--color-fog-muted)] uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-4 h-hairline bg-[var(--color-primary-container)] inline-block"></span>
            Terminal Entry: 001
          </div>
          <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-[var(--color-on-surface)] mb-8 max-w-3xl" style={{ textWrap: "balance" }}>
            Master the discipline of perception in a noisy world.
          </h1>
          <p className="font-body-lg text-body-lg text-[var(--color-on-surface-variant)] max-w-2xl mb-16">
            A systematic approach to ancient philosophy, structured for modern infrastructure. Reclaim your agency through rigorous curriculum and focused community.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link 
              href="/signup" 
              className="bg-[var(--color-primary-container)] text-[var(--color-on-primary-fixed)] font-label-md text-label-md rounded-full px-6 py-3 hover:bg-[var(--color-primary)] transition-colors focus-ring flex items-center justify-center gap-2"
            >
              Join the Discipline
              <ArrowRight size={16} strokeWidth={1} />
            </Link>
            <Link 
              href="#curriculum"
              className="bg-transparent text-[var(--color-on-surface)] border border-[var(--color-surgical-steel)] font-label-md text-label-md rounded-full px-6 py-3 hover:bg-[var(--color-surface-container-high)] transition-colors focus-ring flex items-center justify-center gap-2"
            >
              Explore Curriculum
            </Link>
          </div>
        </div>
      </div>
      {/* Technical Metadata Decoration */}
      <div className="absolute bottom-8 right-8 hidden lg:flex flex-col text-right">
        <span className="font-label-sm text-label-sm text-[var(--color-fog-muted)]">SYS.STATUS: ONLINE</span>
        <span className="font-label-sm text-label-sm text-[var(--color-fog-muted)]">LATENCY: 12ms</span>
      </div>
    </section>
  );
}
