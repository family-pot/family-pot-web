"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import {
  DEFAULT_AFTER_LOGIN,
  PASSWORD_MIN_LENGTH,
  isValidEmail,
  passwordProblem,
  safeNextPath,
} from "@/src/auth";
import { useAuth } from "./auth-context";

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-400 bg-white px-3 py-2 text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 aria-[invalid=true]:border-red-700 dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-50";

type Mode = "login" | "signup";

const COPY = {
  login: {
    title: "Log in",
    submit: "Log in",
    busy: "Logging in…",
    // Generic on purpose: never says whether the email exists or which part was wrong.
    failure: "Could not log in. Check your email and password and try again.",
    switchText: "New here?",
    switchLink: "Create an account",
    switchHref: "/signup",
    passwordHint: undefined,
    autoComplete: "current-password",
  },
  signup: {
    title: "Create an account",
    submit: "Create account",
    busy: "Creating account…",
    failure: "Could not create your account. Please try again.",
    switchText: "Already have an account?",
    switchLink: "Log in",
    switchHref: "/login",
    passwordHint: `At least ${PASSWORD_MIN_LENGTH} characters.`,
    autoComplete: "new-password",
  },
} as const;

/** Sign-up and login share one form; `mode` picks the wording and rules. */
export function AuthForm({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const id = useId();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const next = safeNextPath(searchParams.get("next"));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFailed(false);

    const found: typeof errors = {};
    if (!isValidEmail(email.trim()))
      found.email = "Enter a valid email address.";
    if (password === "") {
      found.password = "Enter your password.";
    } else if (mode === "signup") {
      const problem = passwordProblem(password);
      if (problem) found.password = problem;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await (mode === "login" ? signIn : signUp)({ email, password });
      setPassword(""); // do not keep it around once used
      router.replace(next ?? DEFAULT_AFTER_LOGIN);
    } catch {
      setPassword("");
      setFailed(true);
      setSubmitting(false);
    }
  }

  const switchHref = next
    ? `${copy.switchHref}?next=${encodeURIComponent(next)}`
    : copy.switchHref;

  return (
    <section className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-label={copy.title}
        className="mt-6 space-y-4"
      >
        <div>
          <label htmlFor={`${id}-email`} className="font-medium">
            Email
          </label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? `${id}-email-error` : undefined}
            className={inputClass}
          />
          {errors.email ? (
            <p
              id={`${id}-email-error`}
              className="mt-1 text-sm text-red-800 dark:text-red-300"
            >
              <span aria-hidden="true">✕ </span>
              {errors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={`${id}-password`} className="font-medium">
            Password
          </label>
          <input
            id={`${id}-password`}
            name="password"
            type="password"
            autoComplete={copy.autoComplete}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              [
                copy.passwordHint ? `${id}-password-hint` : "",
                errors.password ? `${id}-password-error` : "",
              ]
                .join(" ")
                .trim() || undefined
            }
            className={inputClass}
          />
          {copy.passwordHint ? (
            <p
              id={`${id}-password-hint`}
              className="mt-1 text-xs text-zinc-600 dark:text-zinc-400"
            >
              {copy.passwordHint}
            </p>
          ) : null}
          {errors.password ? (
            <p
              id={`${id}-password-error`}
              className="mt-1 text-sm text-red-800 dark:text-red-300"
            >
              <span aria-hidden="true">✕ </span>
              {errors.password}
            </p>
          ) : null}
        </div>

        {failed ? (
          <p
            role="alert"
            className="font-medium text-red-800 dark:text-red-300"
          >
            <span aria-hidden="true">✕ </span>
            {copy.failure}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {submitting ? copy.busy : copy.submit}
        </button>
      </form>

      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        {copy.switchText}{" "}
        <Link
          href={switchHref}
          className="font-medium underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {copy.switchLink}
        </Link>
      </p>
      <p className="mt-4 rounded-md border border-dashed border-zinc-400 p-3 text-xs text-zinc-600 dark:text-zinc-400">
        Development mode: this is a mock sign-in. Any valid email and a password
        of at least {PASSWORD_MIN_LENGTH} characters will work, and nothing is
        saved: reloading the page signs you out.
      </p>
    </section>
  );
}
