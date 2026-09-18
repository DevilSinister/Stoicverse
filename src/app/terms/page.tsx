import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms you agree to by using Stoicverse.",
};

/*
  Unchanged wording, restyled. See the note in /privacy: the date is when the
  terms last changed, and the two sections here are the two this page has
  always carried.
*/
const SECTIONS: LegalSection[] = [
  {
    heading: "Use of the platform",
    body: (
      <p>
        You must use our platform in a manner consistent with any and all applicable laws and regulations. Gated
        content, curriculum, and community access are granted under the terms of your specific membership level.
      </p>
    ),
  },
  {
    /*
      This clause described a product that does not exist.

      It said fees were "billed on a recurring basis" and that you could "cancel
      your subscription at any time". There is no subscription: checkout creates
      a Stripe session in `mode: "payment"`, a one-time charge, and the webhook
      extends the membership by the term that was bought. Nothing renews, so
      there is nothing to cancel — and a member reading the old text would
      reasonably expect both a future charge and a cancel control, neither of
      which the product has.

      Rewritten to describe what actually happens. If recurring billing is built
      later, this clause changes with it and the `updated` date moves again.
    */
    heading: "Membership and cancellations",
    body: (
      <p>
        Membership is a one-time payment for the term you choose at checkout, and it does not renew automatically. Your
        access continues until the end of that term; to continue afterwards, you purchase a new term. Because nothing
        recurs, there is no subscription to cancel and no further charge will be made without another purchase.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      // Moved because the billing clause changed, not because the file was
      // touched. A policy page's date states when the policy last changed.
      updated="14 September 2026"
      intro={
        <p>
          Welcome to Stoicverse. By accessing or using our platform, you agree to comply with and be bound by the
          following terms.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
