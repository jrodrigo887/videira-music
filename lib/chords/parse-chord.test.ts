import { describe, expect, it } from "vitest";

import { parseChord } from "./parse-chord";

describe("parseChord", () => {
  it("parses a major chord", () => {
    expect(parseChord("C")).toEqual({
      raw: "C",
      root: "C",
      quality: "",
    });
  });

  it("parses a chord with quality and modifiers", () => {
    expect(parseChord("C#m7(b5)")).toEqual({
      raw: "C#m7(b5)",
      root: "C#",
      quality: "m7(b5)",
    });
  });

  it("parses a slash chord", () => {
    expect(parseChord("D/F#")).toEqual({
      raw: "D/F#",
      root: "D",
      quality: "",
      bass: "F#",
    });
  });

  it("returns null for text that is not a chord", () => {
    expect(parseChord("not a chord")).toBeNull();
  });
});
