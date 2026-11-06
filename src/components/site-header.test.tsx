import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthProvider } from "@/src/auth";
import { AuthContextProvider } from "@/src/components/auth/auth-context";
import { createNavStore } from "@/src/components/auth/nav-mock";
import { SiteHeader } from "./site-header";

const nav = vi.hoisted(() => ({
  current: undefined as unknown as ReturnType<typeof createNavStore>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => nav.current.router }));

beforeEach(() => {
  nav.current = createNavStore("/dashboard");
});
afterEach(cleanup);

async function signedIn() {
  const provider = new MockAuthProvider({ delayMs: 0 });
  await provider.signIn({
    email: "ada@example.com",
    password: "a-long-enough-pw",
  });
  return provider;
}

describe("SiteHeader", () => {
  it("when signed in: the primary navigation, the user's email and a log out button", async () => {
    render(
      <AuthContextProvider provider={await signedIn()}>
        <SiteHeader />
      </AuthContextProvider>,
    );

    const nav1 = screen.getByRole("navigation", { name: "Primary" });
    const links = Array.from(nav1.querySelectorAll("a"));
    expect(links.map((l) => l.textContent)).toEqual([
      "Dashboard",
      "Recipients",
      "Transfers",
    ]);
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/dashboard",
      "/recipients",
      "/transfers",
    ]);
    for (const link of links) expect(link.tabIndex).toBe(0);

    expect(screen.getByText("ada@example.com")).toBeDefined();
    expect(screen.getByText(/Signed in as/)).toBeDefined(); // for screen readers
    expect(screen.getByRole("button", { name: "Log out" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
  });

  it("when signed out: only the log in and sign up links, no app navigation", () => {
    render(
      <AuthContextProvider provider={new MockAuthProvider({ delayMs: 0 })}>
        <SiteHeader />
      </AuthContextProvider>,
    );
    const links = Array.from(
      screen.getByRole("navigation", { name: "Primary" }).querySelectorAll("a"),
    );
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/login",
      "/signup",
    ]);
    expect(screen.queryByRole("link", { name: "Transfers" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Log out" })).toBeNull();
  });

  it("logging out clears the session and goes to the login page", async () => {
    const provider = await signedIn();
    render(
      <AuthContextProvider provider={provider}>
        <SiteHeader />
      </AuthContextProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(nav.current.href).toBe("/login"));
    expect(provider.getSession()).toBeNull();
    expect(screen.queryByRole("button", { name: "Log out" })).toBeNull();
    expect(screen.getByRole("link", { name: "Sign up" })).toBeDefined();
  });
});
