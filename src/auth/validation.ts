export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const EMAIL_MAX_LENGTH = 254;

// Deliberately simple: something@something.tld without spaces. The server is the
// authority; this only catches obvious typos before a request is made.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return value.length <= EMAIL_MAX_LENGTH && EMAIL.test(value);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** A message for the sign-up password rules, or undefined when it is fine. */
export function passwordProblem(password: string): string | undefined {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  return undefined;
}

/** Pages a signed-out person may see. Everything else needs a session. */
export const PUBLIC_PATHS = ["/login", "/signup"] as const;

export function isPublicPath(pathname: string): boolean {
  return (PUBLIC_PATHS as readonly string[]).includes(pathname);
}

export const DEFAULT_AFTER_LOGIN = "/dashboard";

/**
 * Where to go after signing in, taken from the `next` query parameter. Only a
 * path inside this site is allowed: anything else (another site, a protocol
 * relative `//evil.com`, a backslash trick, or the login pages themselves) is
 * ignored, so the redirect cannot be used to send someone elsewhere.
 */
export function safeNextPath(
  next: string | null | undefined,
): string | undefined {
  if (!next || next.length > 2000) return undefined;
  if (!next.startsWith("/") || next.startsWith("//")) return undefined;
  if (/[\\\u0000-\u001f]/.test(next)) return undefined;
  const pathname = next.split(/[?#]/)[0]!;
  if (isPublicPath(pathname)) return undefined;
  return next;
}
