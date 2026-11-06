import { Suspense } from "react";
import { AuthForm } from "@/src/components/auth/auth-forms";

export default function LoginPage() {
  // The form reads `?next=` with useSearchParams, which needs Suspense.
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
