import { Check } from "lucide-react";

export default function Pricing() {
  return (
    <section className="py-16 px-4 md:px-8 lg:px-16 flex flex-col items-center">
      <h2 className="font-headline-md text-headline-md text-[var(--color-on-surface)] mb-4 text-center">Commitment Parameters</h2>
      <p className="font-body-md text-body-md text-[var(--color-on-surface-variant)] mb-16 text-center max-w-xl">Choose the infrastructure level that matches your required intensity.</p>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-8">
        {/* Card 1 */}
        <div className="bg-[var(--color-monolith-surface)] border border-[var(--color-surgical-steel)] p-8 flex flex-col rounded-2xl">
          <div className="font-label-md text-label-md text-[var(--color-fog-muted)] mb-2 uppercase">Basic Membership</div>
          <div className="font-display-lg text-display-lg text-[var(--color-on-surface)] mb-4">$10<span className="font-body-sm text-body-sm text-[var(--color-on-surface-variant)]">/mo</span></div>
          <ul className="font-body-md text-body-md text-[var(--color-on-surface-variant)] space-y-3 mb-16 flex-grow">
            <li className="flex items-start gap-2">
              <Check className="text-[var(--color-primary-container)] mt-0.5" size={20} strokeWidth={2} />
              Full text access to curriculum
            </li>
            <li className="flex items-start gap-2">
              <Check className="text-[var(--color-primary-container)] mt-0.5" size={20} strokeWidth={2} />
              Read-only community access
            </li>
            <li className="flex items-start gap-2">
              <Check className="text-[var(--color-primary-container)] mt-0.5" size={20} strokeWidth={2} />
              Daily morning briefs
            </li>
          </ul>
          <button className="w-full bg-transparent text-[var(--color-on-surface)] border border-[var(--color-surgical-steel)] font-label-md text-label-md rounded-full px-4 py-3 hover:bg-[var(--color-surface-container-high)] transition-colors focus-ring">
            Initialize Standard
          </button>
        </div>
      </div>
    </section>
  );
}
