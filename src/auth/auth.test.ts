import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiAuthProvider,
  AuthFailedError,
  AuthNotConnectedError,
  MockAuthProvider,
  createAuthProvider,
  isPublicPath,
  isValidEmail,
  passwordProblem,
  resetAuthProviderForTests,
  safeNextPath,
} from "./index";

describe("validation", () => {
  it("accepts well-formed emails and rejects the rest", () => {
    for (const ok of [
      "a@b.co",
      "ada.lovelace+tag@example.com",
      "x@sub.domain.org",
    ]) {
      expect(isValidEmail(ok), ok).toBe(true);
    }
    for (const bad of [
      "",
      "a",
      "a@b",
      "@b.co",
      "a@.co",
      "a b@c.co",
      "a@b@c.co",
      `${"a".repeat(250)}@b.co`,
    ]) {
      expect(isValidEmail(bad), bad).toBe(false);
    }
  });

  it("requires 12 to 128 characters for a password", () => {
    expect(passwordProblem("a".repeat(11))).toMatch(/at least 12/);
    expect(passwordProblem("a".repeat(12))).toBeUndefined();
    expect(passwordProblem("a".repeat(128))).toBeUndefined();
    expect(passwordProblem("a".repeat(129))).toMatch(/at most 128/);
  });

  it("knows the public pages", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/signup")).toBe(true);
    for (const path of [
      "/",
      "/dashboard",
      "/transfers",
      "/login/extra",
      "/Login",
    ]) {
      expect(isPublicPath(path), path).toBe(false);
    }
  });
});

describe("safeNextPath (redirect back after login)", () => {
  it("allows paths inside this site, with their query string", () => {
    expect(safeNextPath("/transfers")).toBe("/transfers");
    expect(safeNextPath("/transfers?status=failed&cursor=abc")).toBe(
      "/transfers?status=failed&cursor=abc",
    );
    expect(safeNextPath("/transfers/new#top")).toBe("/transfers/new#top");
  });

  it("rejects anything that could send the person elsewhere", () => {
    for (const bad of [
      "https://evil.example",
      "http://evil.example/x",
      "//evil.example",
      "///evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "evil.example",
      "transfers",
      "/ok\n/evil",
      "",
      null,
      undefined,
      "/" + "a".repeat(2001),
    ]) {
      expect(
        safeNextPath(bad as string | null | undefined),
        String(bad),
      ).toBeUndefined();
    }
  });

  it("does not redirect back to the login pages (that would loop)", () => {
    expect(safeNextPath("/login")).toBeUndefined();
    expect(safeNextPath("/signup?next=/x")).toBeUndefined();
  });
});

describe("MockAuthProvider", () => {
  const provider = (options = {}) =>
    new MockAuthProvider({ delayMs: 0, ...options });
  const good = { email: "Ada@Example.com", password: "a-long-enough-pw" };

  it("starts signed out", () => {
    expect(provider().getSession()).toBeNull();
  });

  it("accepts any well-formed email and a password of 12+ characters, for sign-up and sign-in", async () => {
    const up = provider();
    expect((await up.signUp(good)).user.email).toBe("ada@example.com");
    expect(up.getSession()?.user.email).toBe("ada@example.com");

    const inn = provider();
    await inn.signIn({
      email: "someone.else@example.org",
      password: "x".repeat(12),
    });
    expect(inn.getSession()).not.toBeNull();
  });

  it("rejects bad credentials with the same generic error, whatever is wrong", async () => {
    const p = provider();
    const failures = await Promise.all(
      [
        { email: "not-an-email", password: good.password },
        { email: good.email, password: "short" },
        { email: "", password: "" },
      ].map((credentials) => p.signIn(credentials).catch((e: unknown) => e)),
    );
    for (const failure of failures) {
      expect(failure).toBeInstanceOf(AuthFailedError);
      expect((failure as Error).message).toBe("Authentication failed");
    }
    expect(p.getSession()).toBeNull();
  });

  it("can simulate an outage, also with the generic error", async () => {
    const p = provider({ fail: true });
    await expect(p.signIn(good)).rejects.toBeInstanceOf(AuthFailedError);
    await expect(p.signUp(good)).rejects.toBeInstanceOf(AuthFailedError);
    p.setFailure(false);
    await expect(p.signIn(good)).resolves.toBeDefined();
  });

  it("signs out, clearing the session", async () => {
    const p = provider();
    await p.signIn(good);
    await p.signOut();
    expect(p.getSession()).toBeNull();
  });

  it("never keeps the password: not on the provider, not in the session", async () => {
    const p = provider();
    const password = "super-secret-password-123";
    const session = await p.signIn({ email: "a@b.co", password });
    expect(JSON.stringify(session)).not.toContain(password);
    expect(
      JSON.stringify(Object.entries(p as unknown as object)),
    ).not.toContain(password);
    expect(Object.keys(session.user).sort()).toEqual(["email", "id"]);
  });

  it("never touches browser storage or cookies", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const before = document.cookie;
    const p = provider();
    await p.signUp(good);
    await p.signIn(good);
    await p.signOut();
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe(before);
    setItem.mockRestore();
  });

  it("does not log credentials", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map(
      (m) => vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const p = provider();
    await p.signIn({ email: "a@b.co", password: "super-secret-password-123" });
    await p
      .signIn({ email: "bad", password: "super-secret-password-123" })
      .catch(() => undefined);
    for (const spy of spies) {
      expect(spy.mock.calls.flat().join(" ")).not.toContain(
        "super-secret-password-123",
      );
      spy.mockRestore();
    }
  });
});

describe("provider selection", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DATA_SOURCE;
    resetAuthProviderForTests();
  });

  it("defaults to mock and follows NEXT_PUBLIC_DATA_SOURCE", () => {
    expect(createAuthProvider().kind).toBe("mock");
    expect(createAuthProvider("mock")).toBeInstanceOf(MockAuthProvider);
    expect(createAuthProvider(" API ")).toBeInstanceOf(ApiAuthProvider);
    process.env.NEXT_PUBLIC_DATA_SOURCE = "api";
    expect(createAuthProvider().kind).toBe("api");
  });

  it("rejects an unknown value", () => {
    expect(() => createAuthProvider("sqlite")).toThrow(
      /Unknown NEXT_PUBLIC_DATA_SOURCE/,
    );
  });

  it("the API stub fails loudly instead of pretending", async () => {
    const api = new ApiAuthProvider();
    expect(() => api.getSession()).toThrow(AuthNotConnectedError);
    await expect(api.signIn()).rejects.toBeInstanceOf(AuthNotConnectedError);
    await expect(api.signUp()).rejects.toBeInstanceOf(AuthNotConnectedError);
    await expect(api.signOut()).rejects.toBeInstanceOf(AuthNotConnectedError);
  });
});
