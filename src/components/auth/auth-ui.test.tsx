import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthProvider } from "@/src/auth";
import { SiteHeader } from "@/src/components/site-header";
import { AuthContextProvider } from "./auth-context";
import { AuthForm } from "./auth-forms";
import { createNavStore } from "./nav-mock";
import { RouteGuard } from "./route-guard";

const nav = vi.hoisted(() => ({
  current: undefined as unknown as ReturnType<typeof createNavStore>,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => nav.current.router,
  usePathname: () => nav.current.usePathname(),
  useSearchParams: () => nav.current.useSearchParams(),
}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(cleanup);

const PASSWORD = "a-long-enough-pw";

/** The whole auth experience: header, guard, a protected page and the two forms. */
function App({ provider }: { provider: MockAuthProvider }) {
  const pathname = nav.current.usePathname();
  return (
    <AuthContextProvider provider={provider}>
      <SiteHeader />
      <Suspense fallback={<p>loading</p>}>
        <RouteGuard>
          {pathname === "/login" ? (
            <AuthForm mode="login" />
          ) : pathname === "/signup" ? (
            <AuthForm mode="signup" />
          ) : (
            <p>SECRET PAGE {pathname}</p>
          )}
        </RouteGuard>
      </Suspense>
    </AuthContextProvider>
  );
}

function start(url: string, provider = new MockAuthProvider({ delayMs: 0 })) {
  nav.current = createNavStore(url);
  render(<App provider={provider} />);
  return provider;
}

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = (name: RegExp) =>
  fireEvent.click(screen.getByRole("button", { name }));

describe("protected routes", () => {
  it("never render protected content while signed out, and redirect to login with the original page", async () => {
    start("/transfers?status=failed");
    // The protected page is not rendered at all, not even for a moment.
    expect(screen.queryByText(/SECRET PAGE/)).toBeNull();
    await waitFor(() =>
      expect(nav.current.href).toBe(
        "/login?next=%2Ftransfers%3Fstatus%3Dfailed",
      ),
    );
    expect(screen.queryByText(/SECRET PAGE/)).toBeNull();
    expect(screen.getByRole("form", { name: "Log in" })).toBeDefined();
  });

  it.each(["/", "/dashboard", "/recipients", "/transfers", "/transfers/new"])(
    "%s is unreachable when signed out",
    async (path) => {
      start(path);
      await waitFor(() => expect(nav.current.href).toMatch(/^\/login\?next=/));
      expect(screen.queryByText(/SECRET PAGE/)).toBeNull();
    },
  );

  it("only shows the login and sign-up screens to a signed-out person", async () => {
    start("/login");
    expect(screen.getByRole("form", { name: "Log in" })).toBeDefined();
    cleanup();
    start("/signup");
    expect(
      screen.getByRole("form", { name: "Create an account" }),
    ).toBeDefined();
  });

  it("shows protected pages once signed in", async () => {
    const provider = new MockAuthProvider({ delayMs: 0 });
    await provider.signIn({ email: "a@b.co", password: PASSWORD });
    start("/recipients", provider);
    expect(screen.getByText("SECRET PAGE /recipients")).toBeDefined();
    expect(nav.current.history).toEqual([]); // no redirect
  });

  it("sends a signed-in person away from the login page", async () => {
    const provider = new MockAuthProvider({ delayMs: 0 });
    await provider.signIn({ email: "a@b.co", password: PASSWORD });
    start("/login", provider);
    await waitFor(() => expect(nav.current.href).toBe("/dashboard"));
  });
});

describe("login", () => {
  it("returns to the page the person was trying to reach", async () => {
    start("/transfers/new");
    await screen.findByRole("form", { name: "Log in" });
    fill("Email", "ada@example.com");
    fill("Password", PASSWORD);
    submit(/^Log in$/);

    await waitFor(() => expect(nav.current.href).toBe("/transfers/new"));
    expect(await screen.findByText("SECRET PAGE /transfers/new")).toBeDefined();
  });

  it("goes to the dashboard when there is no page to return to", async () => {
    start("/login");
    fill("Email", "ada@example.com");
    fill("Password", PASSWORD);
    submit(/^Log in$/);
    await waitFor(() => expect(nav.current.href).toBe("/dashboard"));
  });

  it("ignores an unsafe next parameter", async () => {
    for (const next of ["https://evil.example", "//evil.example", "/login"]) {
      cleanup();
      start(`/login?next=${encodeURIComponent(next)}`);
      fill("Email", "ada@example.com");
      fill("Password", PASSWORD);
      submit(/^Log in$/);
      await waitFor(() => expect(nav.current.href).toBe("/dashboard"));
    }
  });

  it("validates the form before trying", async () => {
    const provider = start("/login");
    const signIn = vi.spyOn(provider, "signIn");
    submit(/^Log in$/);
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(screen.getByText("Enter a valid email address.")).toBeDefined();
    expect(screen.getByText("Enter your password.")).toBeDefined();

    fill("Email", "not-an-email");
    fill("Password", "x");
    submit(/^Log in$/);
    expect(screen.getByText("Enter a valid email address.")).toBeDefined();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("shows one generic message on failure, clears the password, and does not say why", async () => {
    const provider = start("/login");
    provider.setFailure(true);
    fill("Email", "ada@example.com");
    fill("Password", PASSWORD);
    submit(/^Log in$/);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Could not log in. Check your email and password and try again.",
    );
    expect(alert.textContent).not.toMatch(
      /exist|registered|not found|wrong password|unknown/i,
    );
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe(
      "",
    );
    expect(nav.current.href).toBe("/login");
  });

  it("masks the password and offers the right autocomplete hints", () => {
    start("/login");
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    expect(password.type).toBe("password");
    expect(password.autocomplete).toBe("current-password");
    expect(
      (screen.getByLabelText("Email") as HTMLInputElement).autocomplete,
    ).toBe("email");
  });

  it("says it is a development mock", () => {
    start("/login");
    expect(
      screen.getByText(/Development mode: this is a mock sign-in/),
    ).toBeDefined();
  });
});

describe("sign up", () => {
  it("creates a session and goes to the dashboard", async () => {
    const provider = start("/signup");
    fill("Email", "New.User@Example.com");
    fill("Password", PASSWORD);
    submit(/^Create account$/);

    await waitFor(() => expect(nav.current.href).toBe("/dashboard"));
    expect(provider.getSession()?.user.email).toBe("new.user@example.com");
    expect(await screen.findByText("SECRET PAGE /dashboard")).toBeDefined();
  });

  it("enforces the 12 character minimum with a clear message", () => {
    const provider = start("/signup");
    const signUp = vi.spyOn(provider, "signUp");
    expect(screen.getByText("At least 12 characters.")).toBeDefined();

    fill("Email", "a@b.co");
    fill("Password", "short-pass");
    submit(/^Create account$/);
    expect(screen.getByText("Use at least 12 characters.")).toBeDefined();
    expect(screen.getByLabelText("Password").getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(signUp).not.toHaveBeenCalled();

    fill("Password", "a".repeat(129));
    submit(/^Create account$/);
    expect(screen.getByText("Use at most 128 characters.")).toBeDefined();
  });

  it("uses a new-password hint and links to login, keeping the page to return to", () => {
    start("/signup?next=%2Ftransfers");
    expect(
      (screen.getByLabelText("Password") as HTMLInputElement).autocomplete,
    ).toBe("new-password");
    // The header also has a plain "Log in" link; the one under the form keeps `next`.
    const hrefs = screen
      .getAllByRole("link", { name: "Log in" })
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/login?next=%2Ftransfers");
  });

  it("shows a generic failure", async () => {
    const provider = start("/signup");
    provider.setFailure(true);
    fill("Email", "a@b.co");
    fill("Password", PASSWORD);
    submit(/^Create account$/);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Could not create your account. Please try again.",
    );
  });
});

describe("logout", () => {
  it("clears the state so protected pages are unreachable again", async () => {
    start("/login");
    fill("Email", "ada@example.com");
    fill("Password", PASSWORD);
    submit(/^Log in$/);
    expect(await screen.findByText("SECRET PAGE /dashboard")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await waitFor(() => expect(nav.current.href).toBe("/login"));
    expect(screen.queryByText(/SECRET PAGE/)).toBeNull();

    // Trying to go back to a protected page bounces to login again.
    nav.current.set("/dashboard");
    await waitFor(() => expect(nav.current.href).toMatch(/^\/login\?next=/));
    expect(screen.queryByText(/SECRET PAGE/)).toBeNull();
  });

  it("a reload (a new provider) is signed out: nothing was persisted", async () => {
    start("/login");
    fill("Email", "ada@example.com");
    fill("Password", PASSWORD);
    submit(/^Log in$/);
    await screen.findByText("SECRET PAGE /dashboard");
    cleanup();

    // "Reload": new provider instance, nothing carried over.
    start("/dashboard");
    await waitFor(() => expect(nav.current.href).toMatch(/^\/login\?next=/));
    expect(screen.queryByText(/SECRET PAGE/)).toBeNull();
  });
});

describe("credentials are never persisted or logged", () => {
  it("writes nothing to localStorage, sessionStorage or cookies, and logs nothing, through login, sign-up and logout", async () => {
    const secret = "super-secret-password-123";
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const cookieBefore = document.cookie;
    const consoleSpies = (
      ["log", "info", "warn", "error", "debug"] as const
    ).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));

    start("/signup");
    fill("Email", "ada@example.com");
    fill("Password", secret);
    submit(/^Create account$/);
    await screen.findByText("SECRET PAGE /dashboard");

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await screen.findByRole("form", { name: "Log in" });
    fill("Email", "ada@example.com");
    fill("Password", secret);
    submit(/^Log in$/);
    await screen.findByText(/SECRET PAGE/);

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe(cookieBefore);
    expect(document.body.innerHTML).not.toContain(secret);
    for (const spy of consoleSpies) {
      expect(spy.mock.calls.flat().join(" ")).not.toContain(secret);
      spy.mockRestore();
    }
    setItem.mockRestore();
  });
});
