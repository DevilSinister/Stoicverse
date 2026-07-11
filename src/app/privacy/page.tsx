import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--color-surface-container-lowest)] text-[var(--color-on-surface)] p-6 md:p-12 lg:p-24 flex justify-center">
      <div className="max-w-3xl w-full border border-[var(--color-surgical-steel)] bg-[var(--color-monolith-surface)] p-8 md:p-12">
        <Link href="/" className="font-headline-sm text-headline-sm text-[var(--color-primary-container)]">Stoicverse</Link>
        <h1 className="mt-8 font-display-lg-mobile md:font-display-lg text-[var(--color-on-surface)]">Privacy Policy</h1>
        <p className="mt-6 text-[var(--color-on-surface-variant)] leading-7">
          At Stoicverse, we value your privacy. We process minimal personal data required to manage your account, facilitate community interactions, and process payments securely.
        </p>
        <h2 className="mt-8 font-headline-sm text-headline-sm text-[var(--color-on-surface)]">1. Information We Collect</h2>
        <p className="mt-4 text-[var(--color-on-surface-variant)] leading-7">
          We collect your name, email, and authentication credentials during registration to secure your account. Payment details are processed directly and securely through Stripe.
        </p>
        <h2 className="mt-8 font-headline-sm text-headline-sm text-[var(--color-on-surface)]">2. How We Use It</h2>
        <p className="mt-4 text-[var(--color-on-surface-variant)] leading-7">
          Your information is solely used to maintain your access to our tiered lessons, events, and community platforms. We do not sell or share your information with third parties.
        </p>
      </div>
    </main>
  );
}
