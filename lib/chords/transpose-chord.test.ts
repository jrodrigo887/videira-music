import { describe, expect, it } from "vitest";

import { isTransposableKey, semitonesBetweenKeys, transposeChord } from "./transpose-chord";

describe("transposeChord", () => {
  it("transposes a major chord up", () => {
    expect(transposeChord("C", 2)).toBe("D");
  });

  it("transposes a minor seventh chord up", () => {
    expect(transposeChord("Am7", 2)).toBe("Bm7");
  });

  it("transposes a slash chord", () => {
    expect(transposeChord("D/F#", 2)).toBe("E/G#");
  });

  it("preserves extensions", () => {
    expect(transposeChord("Bbmaj7", 2)).toBe("Cmaj7");
  });

  it("transposes down with flat spelling when requested", () => {
    expect(transposeChord("C", -2, { preferFlats: true })).toBe("Bb");
  });

  it("keeps invalid text unchanged", () => {
    expect(transposeChord("not a chord", 2)).toBe("not a chord");
  });
});

describe("semitonesBetweenKeys", () => {
  it("measures the interval between two key roots", () => {
    expect(semitonesBetweenKeys("C", "G")).toBe(7);
    expect(semitonesBetweenKeys("G", "C")).toBe(5);
    expect(semitonesBetweenKeys("F#m", "G")).toBe(1);
  });
});

describe("isTransposableKey", () => {
  it.each([
    "C",
    "G",
    "F#",
    "Bb",
    "Eb",
    "Am",
    "F#m",
    "Db",
  ])("accepts valid key %s", (key) => {
    expect(isTransposableKey(key)).toBe(true);
  });

  it.each([
    "",
    "H",
    "Cmaj7",
    "Am7",
    "Do",
    "C#m7",
    "G sus",
    "B#",
  ])("rejects invalid key %s", (key) => {
    expect(isTransposableKey(key)).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    expect(isTransposableKey("  D  ")).toBe(true);
  });
});
