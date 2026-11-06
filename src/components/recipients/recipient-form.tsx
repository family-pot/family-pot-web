"use client";

import { useId, useState, type FormEvent } from "react";
import {
  COUNTRY_CODES,
  ValidationError,
  countryName,
  validateRecipientInput,
  type Recipient,
} from "@/src/data";

export type RecipientFormValues = {
  name: string;
  country: string;
  notes: string;
};

type Props = {
  /** When set, the form edits this recipient; otherwise it creates one. */
  recipient?: Recipient;
  onSubmit: (values: RecipientFormValues) => Promise<void>;
  onCancel?: () => void;
};

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-400 bg-white px-3 py-2 text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 aria-[invalid=true]:border-red-700 dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-50";

const countryOptions = COUNTRY_CODES.map((code) => ({
  code,
  name: countryName(code),
})).sort((a, b) => a.name.localeCompare(b.name));

export function RecipientForm({ recipient, onSubmit, onCancel }: Props) {
  const id = useId();
  const [values, setValues] = useState<RecipientFormValues>({
    name: recipient?.name ?? "",
    country: recipient?.country ?? "",
    notes: recipient?.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set(field: keyof RecipientFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const clientErrors = validateRecipientInput(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit(values);
      if (!recipient) setValues({ name: "", country: "", notes: "" });
    } catch (error) {
      if (error instanceof ValidationError) {
        setErrors(error.fieldErrors);
      } else {
        setFormError(
          error instanceof Error ? error.message : "Could not save recipient.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  function field(name: keyof RecipientFormValues) {
    const invalid = Boolean(errors[name]);
    return {
      id: `${id}-${name}`,
      "aria-invalid": invalid,
      "aria-describedby": invalid ? `${id}-${name}-error` : undefined,
    };
  }

  function fieldError(name: keyof RecipientFormValues) {
    return errors[name] ? (
      <p
        id={`${id}-${name}-error`}
        className="mt-1 text-sm text-red-800 dark:text-red-300"
      >
        <span aria-hidden="true">✕ </span>
        {errors[name]}
      </p>
    ) : null;
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={recipient ? "Edit recipient" : "Add recipient"}
      className="space-y-4 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700"
    >
      <h2 className="text-lg font-semibold">
        {recipient ? "Edit recipient" : "Add recipient"}
      </h2>

      <div>
        <label htmlFor={`${id}-name`} className="font-medium">
          Name
        </label>
        <input
          {...field("name")}
          type="text"
          value={values.name}
          onChange={(event) => set("name", event.target.value)}
          autoComplete="off"
          className={inputClass}
        />
        {fieldError("name")}
      </div>

      <div>
        <label htmlFor={`${id}-country`} className="font-medium">
          Country
        </label>
        <select
          {...field("country")}
          value={values.country}
          onChange={(event) => set("country", event.target.value)}
          className={inputClass}
        >
          <option value="">Select a country</option>
          {countryOptions.map(({ code, name }) => (
            <option key={code} value={code}>
              {name} ({code})
            </option>
          ))}
        </select>
        {fieldError("country")}
      </div>

      <div>
        <label htmlFor={`${id}-notes`} className="font-medium">
          Notes <span className="font-normal">(optional)</span>
        </label>
        <textarea
          {...field("notes")}
          rows={3}
          value={values.notes}
          onChange={(event) => set("notes", event.target.value)}
          className={inputClass}
        />
        {fieldError("notes")}
      </div>

      {formError ? (
        <p
          role="alert"
          className="text-sm font-medium text-red-800 dark:text-red-300"
        >
          <span aria-hidden="true">✕ </span>
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {submitting
            ? "Saving…"
            : recipient
              ? "Save changes"
              : "Add recipient"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-400 px-4 py-2 font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-zinc-500 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
