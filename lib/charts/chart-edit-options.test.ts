import { describe, expect, it } from "vitest";

import {
  isEditableChartKey,
  SECTION_TYPE_OPTIONS,
  TONALITY_OPTIONS,
} from "./chart-edit-options";

describe("chart-edit-options", () => {
  it("lists the import review tonality options from C through Bm", () => {
    expect(TONALITY_OPTIONS[0]).toBe("C");
    expect(TONALITY_OPTIONS.at(-1)).toBe("Bm");
    expect(TONALITY_OPTIONS.length).toBeGreaterThanOrEqual(30);
  });

  it("accepts only closed-list keys for chart edit", () => {
    expect(isEditableChartKey("C")).toBe(true);
    expect(isEditableChartKey("C7")).toBe(false);
  });

  it("lists the eight section types used in import review", () => {
    expect(SECTION_TYPE_OPTIONS).toHaveLength(8);
    expect(SECTION_TYPE_OPTIONS.map((option) => option.value)).toContain("chorus");
  });
});
