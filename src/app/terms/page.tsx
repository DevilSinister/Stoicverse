import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--color-surface-container-lowest)] text-[var(--color-on-surface)] p-6 md:p-12 lg:p-24 flex justify-center">
      <div className="max-w-3xl w-full border border-[var(--color-surgical-steel)] bg-[var(--color-monolith-surface)] p-8 md:p-12">
        <Link href="/" className="font-headline-sm text-headline-sm text-[var(--color-primary-container)]">Stoicverse</Link>
        <h1 className="mt-8 font-display-lg-mobile md:font-display-lg text-[var(--color-on-surface)]">Terms of Service</h1>
        <p className="mt-6 text-[var(--color-on-surface-variant)] leading-7">
          Welcome to Stoicverse. By accessing or using our platform, you agree to comply with and be bound by the following terms.
        </p>
        <h2 className="mt-8 font-headline-sm text-headline-sm text-[var(--color-on-surface)]">1. Use of the Platform</h2>
        <p className="mt-4 text-[var(--color-on-surface-variant)] leading-7">
          You must use our platform in a manner consistent with any and all applicable laws and regulations. Gated content, curriculum, and community access are granted under the terms of your specific membership level.
        </p>
        <h2 className="mt-8 font-headline-sm text-headline-sm text-[var(--color-on-surface)]">2. Membership and Cancellations</h2>
        <p className="mt-4 text-[var(--color-on-surface-variant)] leading-7">
          Membership fees are billed on a recurring basis. You may cancel your subscription at any time, and you will maintain access to our materials until the end of your billing cycle.
        </p>
      </div>
    </main>
  );
}
