import { AuthNotConnectedError } from "./errors";
import type { AuthProvider } from "./types";

/**
 * Placeholder for the real implementation (tokens, refresh and cookies come in
 * the later connect issue, per ADR 0005). Every method fails loudly rather than
 * pretending to succeed.
 */
export class ApiAuthProvider implements AuthProvider {
  readonly kind = "api" as const;

  getSession(): never {
    throw new AuthNotConnectedError("auth.getSession");
  }

  async signUp(): Promise<never> {
    throw new AuthNotConnectedError("auth.signUp");
  }

  async signIn(): Promise<never> {
    throw new AuthNotConnectedError("auth.signIn");
  }

  async signOut(): Promise<never> {
    throw new AuthNotConnectedError("auth.signOut");
  }
}
