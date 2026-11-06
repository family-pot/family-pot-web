export interface AuthUser {
  id: string;
  email: string;
}

/** Who is signed in. Deliberately has no password or token. */
export interface Session {
  user: AuthUser;
}

export interface Credentials {
  email: string;
  password: string;
}

/**
 * Where sign-up, sign-in and sign-out happen. The UI only talks to this, so
 * connecting the real API later changes one place (see the data layer's
 * `NEXT_PUBLIC_DATA_SOURCE` switch).
 *
 * Failures are deliberately generic (`AuthFailedError`): the UI must not be
 * able to tell the person, or an attacker, whether an email is registered or
 * which part of the credentials was wrong.
 */
export interface AuthProvider {
  readonly kind: "mock" | "api";
  /** The current session, or null when signed out. Synchronous: it is in memory. */
  getSession(): Session | null;
  signUp(credentials: Credentials): Promise<Session>;
  signIn(credentials: Credentials): Promise<Session>;
  signOut(): Promise<void>;
}
