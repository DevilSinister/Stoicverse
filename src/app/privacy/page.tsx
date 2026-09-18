import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Stoicverse collects, why, and who processes it.",
};

/*
  The wording is unchanged from what this page has said since 11 July 2026.
  Phase 4 restyled the page; it did not amend the policy, and the date below
  says when the policy last changed rather than when the file was last touched.

  Two sections is thin for a privacy policy - there is nothing here about
  retention, processors, or a subject's rights - but filling those in is a
  decision about what the business commits to, not a design task.
*/
const SECTIONS: LegalSection[] = [
  {
    heading: "Information we collect",
    body: (
      <p>
        We collect your name, email, and authentication credentials during registration to secure your account. Payment
        details are processed directly and securely through Stripe.
      </p>
    ),
  },
  {
    heading: "How we use it",
    body: (
      <p>
        Your information is solely used to maintain your access to our tiered lessons, events, and community platforms.
        We do not sell or share your information with third parties.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="11 July 2026"
      intro={
        <p>
          At Stoicverse, we value your privacy. We process minimal personal data required to manage your account,
          facilitate community interactions, and process payments securely.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
