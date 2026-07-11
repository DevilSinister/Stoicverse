import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[var(--color-surface)] text-[var(--color-primary)] font-label-sm text-label-sm w-full border-t border-[var(--color-surgical-steel)] flex flex-col md:flex-row justify-between items-center py-12 px-4 md:px-8 lg:px-16 gap-1">
      <div className="font-label-md text-label-md font-bold uppercase tracking-widest text-[var(--color-on-surface)] mb-4 md:mb-0">
        Stoicverse
      </div>
      <div className="text-[var(--color-fog-muted)] flex-grow text-center md:text-left md:pl-8">
        Copyright 2026 Stoicverse. Built for the disciplined mind.
      </div>
      <div className="flex flex-wrap justify-center md:justify-end gap-4 mt-4 md:mt-0">
        <Link className="text-[var(--color-fog-muted)] hover:text-[var(--color-primary)] transition-colors focus-ring" href="#">Ethics</Link>
        <Link className="text-[var(--color-fog-muted)] hover:text-[var(--color-primary)] transition-colors focus-ring" href="#">Privacy</Link>
        <Link className="text-[var(--color-fog-muted)] hover:text-[var(--color-primary)] transition-colors focus-ring" href="#">Infrastructure</Link>
        <Link className="text-[var(--color-fog-muted)] hover:text-[var(--color-primary)] transition-colors focus-ring" href="#">Terminal</Link>
      </div>
    </footer>
  );
}
