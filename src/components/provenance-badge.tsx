import type { ReactNode } from "react";

/** Where a displayed value came from (README: provenance). */
export type Provenance =
  "user-entered" | "calculated" | "estimated" | "verified";

type Style = {
  label: string;
  description: string;
  icon: string;
  className: string;
};

const base =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium";

const STYLES: Record<Provenance, Style> = {
  "user-entered": {
    label: "Entered by you",
    description: "You typed this value in. It has not been checked.",
    icon: "✎",
    className: `${base} border-zinc-400 text-zinc-700 dark:border-zinc-500 dark:text-zinc-300`,
  },
  calculated: {
    label: "Calculated",
    description: "Worked out from other values, using exact arithmetic.",
    icon: "=",
    className: `${base} border-blue-700 text-blue-900 dark:border-blue-400 dark:text-blue-200`,
  },
  estimated: {
    label: "Estimated",
    description:
      "An estimate. It is not guaranteed and the real figure may differ.",
    icon: "≈",
    // Stronger treatment: heavier border, bold text and a filled background.
    className:
      "inline-flex items-center gap-1 rounded-md border-2 border-dashed border-amber-700 bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100",
  },
  verified: {
    label: "Verified",
    description: "Confirmed against an independent source.",
    icon: "✓",
    className: `${base} border-green-700 text-green-900 dark:border-green-400 dark:text-green-200`,
  },
};

export const PROVENANCES = Object.keys(STYLES) as Provenance[];

export function provenanceLabel(provenance: Provenance): string {
  return STYLES[provenance].label;
}

/**
 * Shows where a number came from. Each kind has its own text and symbol (never
 * colour alone), and a description exposed to screen readers and as a tooltip.
 * `estimated` is deliberately heavier so it cannot be mistaken for a fact.
 */
export function ProvenanceBadge({
  provenance,
  children,
}: {
  provenance: Provenance;
  /** Optional replacement for the default label. */
  children?: ReactNode;
}) {
  const style = STYLES[provenance];
  return (
    <span
      className={style.className}
      title={style.description}
      data-provenance={provenance}
    >
      <span aria-hidden="true">{style.icon}</span>
      <span>{children ?? style.label}</span>
      <span className="sr-only">. {style.description}</span>
    </span>
  );
}
