import { AuthFailedError } from "./errors";
import type { AuthProvider, Credentials, Session } from "./types";
import { isValidEmail, normalizeEmail, passwordProblem } from "./validation";

export interface MockAuthOptions {
  /** Artificial latency in milliseconds, so loading states can be seen. */
  delayMs?: number;
  /** When true, every sign-up and sign-in fails with the generic error. */
  fail?: boolean;
}

/**
 * DEVELOPMENT ONLY. Accepts any well-formed email and any password of at least
 * 12 characters; there are no accounts. The session lives in this object's
 * memory and nowhere else: it is not written to localStorage, sessionStorage,
 * cookies or IndexedDB, so a reload signs you out. The password is checked and
 * then dropped: it is never kept on the instance, in the session or in a log.
 */
export class MockAuthProvider implements AuthProvider {
  readonly kind = "mock" as const;

  private session: Session | null = null;
  private delayMs: number;
  private fail: boolean;

  constructor(options: MockAuthOptions = {}) {
    this.delayMs = options.delayMs ?? 150;
    this.fail = options.fail ?? false;
  }

  setFailure(fail: boolean): void {
    this.fail = fail;
  }

  getSession(): Session | null {
    return this.session;
  }

  signUp(credentials: Credentials): Promise<Session> {
    return this.authenticate(credentials);
  }

  signIn(credentials: Credentials): Promise<Session> {
    return this.authenticate(credentials);
  }

  async signOut(): Promise<void> {
    await this.wait();
    this.session = null;
  }

  private async authenticate({
    email,
    password,
  }: Credentials): Promise<Session> {
    await this.wait();
    const address = normalizeEmail(email);
    // One generic failure for a bad email, a short password or a simulated outage.
    if (
      this.fail ||
      !isValidEmail(address) ||
      passwordProblem(password) !== undefined
    ) {
      throw new AuthFailedError();
    }
    this.session = {
      user: { id: `mock-user-${address}`, email: address },
    };
    return this.session;
  }

  private async wait(): Promise<void> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
  }
}
