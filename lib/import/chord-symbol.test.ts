import { describe, expect, it } from "vitest";

import { isChordSymbol } from "./chord-symbol";

describe("isChordSymbol", () => {
  it.each([
    "C",
    "Am",
    "F#m",
    "Bb",
    "D/F#",
    "G/B",
    "A9",
    "D4(9)",
    "G7M(9)",
    "E7M(9)",
    "Gmaj7",
    "C#m7(b5)",
    "B11/D#",
    "D°",
    "Dº",
    "Bø",
    "C+",
    "Csus4",
    "Cadd9",
    "C/9",
    "A7(#11)",
    "Em7(9,11)",
  ])("accepts %s", (token) => {
    expect(isChordSymbol(token)).toBe(true);
  });

  it.each(["Deus", "Cedo", "Bem", "Ele", "Amor", "Do", "Add", "Gloria", "2x", "|", "c", "H7"])(
    "rejects %s",
    (token) => {
      expect(isChordSymbol(token)).toBe(false);
    },
  );
});
