"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/components/auth/auth-context";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/recipients", label: "Recipients" },
  { href: "/transfers", label: "Transfers" },
] as const;

const linkClass =
  "inline-flex rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground dark:text-zinc-300 dark:hover:bg-white/[.08]";

export function SiteHeader() {
  const { session, signOut } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <header className="border-b border-black/10 bg-background dark:border-white/15">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href={session ? "/" : "/login"}
          className="rounded-md text-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
        >
          Family Pot
        </Link>

        <nav aria-label="Primary">
          <ul className="flex flex-wrap items-center gap-1">
            {session ? (
              <>
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li className="ml-2 flex items-center gap-2">
                  <span className="max-w-40 truncate text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="sr-only">Signed in as </span>
                    {session.user.email}
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-md border border-zinc-400 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground dark:border-zinc-500 dark:hover:bg-zinc-800"
                  >
                    Log out
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link href="/login" className={linkClass}>
                    Log in
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className={linkClass}>
                    Sign up
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}
