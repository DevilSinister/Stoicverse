import Link from "next/link";

export default function Header() {
  return (
    <nav className="bg-[var(--color-surface)] text-[var(--color-primary)] font-body-md text-body-md fixed top-0 w-full z-50 border-b border-[var(--color-surgical-steel)] flex justify-between items-center h-16 px-4 md:px-8 lg:px-16">
      <Link href="/" className="font-headline-sm text-headline-sm font-medium tracking-tighter text-[var(--color-on-surface)]">
        Stoicverse
      </Link>
      <div className="hidden md:flex items-center gap-8">
        <Link className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-colors duration-200 focus-ring" href="#curriculum">Curriculum</Link>
        <Link className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-colors duration-200 focus-ring" href="/dashboard/community">Stoicverse</Link>
        <Link className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-colors duration-200 focus-ring" href="/philosophers">Philosophers</Link>
        <Link className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-colors duration-200 focus-ring" href="#pricing">Pricing</Link>
      </div>
      <Link href="/signup" className="bg-[var(--color-primary-container)] text-[var(--color-on-primary-fixed)] font-label-md text-label-md rounded-full px-4 py-2 hover:bg-[var(--color-primary)] transition-colors focus-ring">
        Begin Journey
      </Link>
    </nav>
  );
}
