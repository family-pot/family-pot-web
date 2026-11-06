"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getAuthProvider,
  type AuthProvider,
  type Credentials,
  type Session,
} from "@/src/auth";

type AuthState = {
  session: Session | null;
  signIn(credentials: Credentials): Promise<void>;
  signUp(credentials: Credentials): Promise<void>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * Holds the session for the whole app, in React state backed by the provider's
 * memory. Nothing is written to browser storage, so a reload signs you out
 * (the mock is for development only).
 */
export function AuthContextProvider({
  provider,
  children,
}: {
  /** Defaults to the app-wide provider. Tests pass their own. */
  provider?: AuthProvider;
  children: ReactNode;
}) {
  const [auth] = useState(() => provider ?? getAuthProvider());
  const [session, setSession] = useState<Session | null>(() =>
    auth.getSession(),
  );

  const signIn = useCallback(
    async (credentials: Credentials) => {
      setSession(await auth.signIn(credentials));
    },
    [auth],
  );
  const signUp = useCallback(
    async (credentials: Credentials) => {
      setSession(await auth.signUp(credentials));
    },
    [auth],
  );
  const signOut = useCallback(async () => {
    await auth.signOut();
    setSession(null);
  }, [auth]);

  const value = useMemo(
    () => ({ session, signIn, signUp, signOut }),
    [session, signIn, signUp, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside <AuthContextProvider>.");
  }
  return value;
}
