import { Suspense } from "react";

import { ResetRequestForm } from "@/components/auth/ResetRequestForm";

export const metadata = { title: "Reset your password" };

export default function ResetPage() {
  return (
    <Suspense>
      <ResetRequestForm />
    </Suspense>
  );
}
