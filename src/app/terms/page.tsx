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
    heading: "Membership and cancellations",
    body: (
      <p>
        Membership fees are billed on a recurring basis. You may cancel your subscription at any time, and you will
        maintain access to our materials until the end of your billing cycle.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="11 July 2026"
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
