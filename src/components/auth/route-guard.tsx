"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { DEFAULT_AFTER_LOGIN, isPublicPath, safeNextPath } from "@/src/auth";
import { LoadingState } from "@/src/components/states";
import { useAuth } from "./auth-context";

/**
 * Only the login and sign-up pages are public. While signed out, a protected
 * page is NOT rendered at all (not even for a moment): the person is sent to
 * `/login?next=<where they were going>` and brought back after signing in. A
 * signed-in person visiting a login page is sent on to where they were going.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isPublic = isPublicPath(pathname);
  const search = searchParams.toString();
  const here = search ? `${pathname}?${search}` : pathname;
  const signedOutOnProtected = !session && !isPublic;
  const signedInOnPublic = Boolean(session) && isPublic;
  const nextParam = searchParams.get("next");

  useEffect(() => {
    if (signedOutOnProtected) {
      router.replace(`/login?next=${encodeURIComponent(here)}`);
    } else if (signedInOnPublic) {
      router.replace(safeNextPath(nextParam) ?? DEFAULT_AFTER_LOGIN);
    }
  }, [signedOutOnProtected, signedInOnPublic, here, nextParam, router]);

  if (signedOutOnProtected) {
    return <LoadingState label="Redirecting to sign in…" />;
  }
  if (signedInOnPublic) {
    return <LoadingState label="Redirecting…" />;
  }
  return <>{children}</>;
}
