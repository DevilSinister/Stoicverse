import { Suspense } from "react";

import { AuthForm } from "@/components/auth/AuthForm";
import { DevLoginPanel } from "@/components/auth/DevLoginPanel";

export default function LoginPage() {
  return (
    <>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
      <DevLoginPanel />
    </>
  );
}
