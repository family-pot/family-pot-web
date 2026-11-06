import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  PROVENANCES,
  ProvenanceBadge,
  provenanceLabel,
  type Provenance,
} from "./provenance-badge";

afterEach(cleanup);

const expected: Record<Provenance, { label: string; description: RegExp }> = {
  "user-entered": { label: "Entered by you", description: /typed this value/ },
  calculated: { label: "Calculated", description: /exact arithmetic/ },
  estimated: { label: "Estimated", description: /not guaranteed/ },
  verified: { label: "Verified", description: /independent source/ },
};

describe("ProvenanceBadge", () => {
  it("covers exactly the four provenance values", () => {
    expect([...PROVENANCES].sort()).toEqual([
      "calculated",
      "estimated",
      "user-entered",
      "verified",
    ]);
  });

  it.each(PROVENANCES)(
    "renders %s with its own text and description",
    (provenance) => {
      const { container } = render(<ProvenanceBadge provenance={provenance} />);
      const badge = container.firstElementChild as HTMLElement;

      expect(badge.dataset.provenance).toBe(provenance);
      // Visible text, not just colour.
      expect(screen.getByText(expected[provenance].label)).toBeDefined();
      // Description for screen readers (read after the label) and as a tooltip.
      expect(badge.textContent).toMatch(expected[provenance].description);
      expect(badge.getAttribute("title")).toMatch(
        expected[provenance].description,
      );
      expect(provenanceLabel(provenance)).toBe(expected[provenance].label);
    },
  );

  it("gives every kind distinct text and a distinct symbol", () => {
    const labels = new Set<string>();
    const symbols = new Set<string>();
    for (const provenance of PROVENANCES) {
      const { container, unmount } = render(
        <ProvenanceBadge provenance={provenance} />,
      );
      const spans = container.querySelectorAll("span");
      symbols.add(
        container.querySelector('[aria-hidden="true"]')!.textContent!,
      );
      labels.add(spans[2]!.textContent!);
      unmount();
    }
    expect(labels.size).toBe(4);
    expect(symbols.size).toBe(4);
  });

  it("hides the decorative symbol from screen readers but keeps the text", () => {
    const { container } = render(<ProvenanceBadge provenance="verified" />);
    expect(container.querySelector('[aria-hidden="true"]')!.textContent).toBe(
      "✓",
    );
    expect(container.querySelector(".sr-only")).not.toBeNull();
  });

  it("gives estimated a stronger treatment and a not-guaranteed tooltip", () => {
    const render1 = (p: Provenance) => {
      const { container, unmount } = render(<ProvenanceBadge provenance={p} />);
      const badge = container.firstElementChild as HTMLElement;
      const info = { className: badge.className, title: badge.title };
      unmount();
      return info;
    };
    const estimated = render1("estimated");
    expect(estimated.title).toMatch(/not guaranteed/i);
    expect(estimated.className).toContain("font-bold");
    expect(estimated.className).toContain("border-2");
    expect(estimated.className).toContain("border-dashed");
    for (const other of ["user-entered", "calculated", "verified"] as const) {
      const info = render1(other);
      expect(info.className).not.toContain("font-bold");
      expect(info.className).not.toContain("border-dashed");
      expect(info.title).not.toMatch(/not guaranteed/i);
    }
  });

  it("can show a custom label while keeping the description", () => {
    const { container } = render(
      <ProvenanceBadge provenance="estimated">Approx. rate</ProvenanceBadge>,
    );
    expect(screen.getByText("Approx. rate")).toBeDefined();
    expect(container.textContent).toMatch(/not guaranteed/);
  });
});
