import { ApiAuthProvider } from "./api-auth-provider";
import { MockAuthProvider } from "./mock-auth-provider";
import type { AuthProvider } from "./types";

/**
 * Choose the auth implementation with the same switch as the data layer:
 * `NEXT_PUBLIC_DATA_SOURCE=mock|api` (default `mock`).
 */
export function createAuthProvider(
  kind: string | undefined = process.env.NEXT_PUBLIC_DATA_SOURCE,
): AuthProvider {
  const selected = kind?.trim().toLowerCase() || "mock";
  if (selected === "mock") return new MockAuthProvider();
  if (selected === "api") return new ApiAuthProvider();
  throw new Error(
    `Unknown NEXT_PUBLIC_DATA_SOURCE "${selected}". Use "mock" or "api".`,
  );
}

let current: AuthProvider | undefined;

export function getAuthProvider(): AuthProvider {
  current ??= createAuthProvider();
  return current;
}

export function resetAuthProviderForTests(): void {
  current = undefined;
}

export { ApiAuthProvider } from "./api-auth-provider";
export { MockAuthProvider } from "./mock-auth-provider";
export type { MockAuthOptions } from "./mock-auth-provider";
export { AuthFailedError, AuthNotConnectedError } from "./errors";
export type { AuthProvider, AuthUser, Credentials, Session } from "./types";
export {
  DEFAULT_AFTER_LOGIN,
  PASSWORD_MIN_LENGTH,
  PUBLIC_PATHS,
  isPublicPath,
  isValidEmail,
  passwordProblem,
  safeNextPath,
} from "./validation";
