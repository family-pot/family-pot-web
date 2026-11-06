import { Suspense } from "react";
import { AuthForm } from "@/src/components/auth/auth-forms";

export default function SignupPage() {
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
