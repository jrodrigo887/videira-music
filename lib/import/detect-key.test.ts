import { describe, expect, it } from "vitest";

import { assembleSections } from "./assemble-sections";
import { classifyLines } from "./classify-lines";
import { detectKey, parseCapo, parseKey } from "./detect-key";
import { normalizeText } from "./normalize-text";

function chart(text: string) {
  const { lines } = classifyLines(normalizeText(text));
  return { lines, sections: assembleSections(lines).sections };
}

const G_SHAPES = `[Intro] G7M(9)  D4(9)

[Primeira Parte]
Am7          G/B    C9
Uma linha de letra inventada`;

describe("parseKey", () => {
  it.each([
    ["G", "G"],
    ["Em", "Em"],
    ["F#m", "F#m"],
    ["Bb", "Bb"],
    ["Amin", "Am"],
    ["g", "G"],
    ["C (com forma de A)", "C"],
    ["Cmaj", "C"],
  ])("parses %s as %s", (value, key) => {
    expect(parseKey(value)).toBe(key);
  });

  it("returns undefined when there is no key", () => {
    expect(parseKey("")).toBeUndefined();
    expect(parseKey("Tom")).toBeUndefined();
    expect(parseKey(undefined)).toBeUndefined();
  });
});

describe("parseCapo", () => {
  it.each([
    ["3ª casa", 3],
    ["Capotraste na 2a casa", 2],
    ["5", 5],
  ])("parses %s as %i", (value, capo) => {
    expect(parseCapo(value)).toBe(capo);
  });

  it("ignores missing or zero capo", () => {
    expect(parseCapo("sem capotraste")).toBeUndefined();
    expect(parseCapo("0")).toBeUndefined();
    expect(parseCapo(undefined)).toBeUndefined();
  });
});

describe("detectKey", () => {
  it("guesses the key from the first chord of the first section with chords", () => {
    const { sections } = chart("[Refrão]\nsem acordes\n\n[Verso]\nEm7   C\nletra");

    expect(detectKey({ sections })).toEqual({
      key: "Em",
      keySource: "chords",
      warnings: [
        { code: "KEY_GUESSED", message: "Tom sugerido pelo primeiro acorde (Em7); confirme na revisão." },
      ],
    });
  });

  it("treats 7M and maj as major", () => {
    expect(detectKey(chart("G7M(9)\nletra")).key).toBe("G");
    expect(detectKey(chart("Cmaj7\nletra")).key).toBe("C");
    expect(detectKey(chart("Am7M\nletra")).key).toBe("Am");
  });

  it("returns no key when there are no chords nor declared key", () => {
    expect(detectKey(chart("[Verso]\nso letra"))).toEqual({ warnings: [] });
  });

  it("trusts a ChordPro key directive without checking the chords", () => {
    expect(detectKey(chart("{key: A}\n{capo: 2}\nD\nletra"))).toEqual({
      key: "A",
      keySource: "directive",
      capo: 2,
      warnings: [],
    });
  });

  it("prefers the user hint over directive and page", () => {
    const { lines, sections } = chart("{key: A}\nD\nletra");

    expect(detectKey({ sections, lines, meta: { key: "E" }, hints: { key: "Bb", capo: 1 } })).toEqual({
      key: "Bb",
      keySource: "hint",
      capo: 1,
      warnings: [],
    });
  });

  it("accepts the page key when the chords agree", () => {
    expect(detectKey({ ...chart(G_SHAPES), meta: { key: "G", keyLabel: "G" } })).toEqual({
      key: "G",
      keySource: "meta",
      warnings: [],
    });
  });

  it("compares enharmonic keys by pitch", () => {
    expect(detectKey({ ...chart("Gb\nletra"), meta: { key: "F#" } })).toMatchObject({ key: "Gb", keySource: "meta" });
  });

  it("uses the chords and warns KEY_MISMATCH when the page key does not match", () => {
    const detection = detectKey({
      ...chart(G_SHAPES),
      meta: { key: "C", keyLabel: "C (com forma de A)", capoLabel: "3ª casa" },
    });

    expect(detection).toEqual({
      key: "G",
      keySource: "chords",
      capo: 3,
      warnings: [
        {
          code: "KEY_MISMATCH",
          message:
            "O tom informado pela fonte (C (com forma de A)) não bate com os acordes. Sugerido G pelo primeiro acorde (G7M(9)); confirme na revisão.",
        },
      ],
    });
  });

  it("matches the chords against the shape when the page gives one", () => {
    expect(
      detectKey({ ...chart("A   E\nletra"), meta: { key: "C", keyLabel: "C (com forma de A)", capo: 3 } }),
    ).toEqual({ key: "A", keySource: "meta", capo: 3, warnings: [] });
  });

  it("matches the chords against the page key minus the capo", () => {
    expect(detectKey({ ...chart("A   E\nletra"), meta: { key: "C", capo: 3 } })).toMatchObject({
      key: "A",
      keySource: "meta",
      warnings: [],
    });
  });

  it("falls back to the page key when there are no chords", () => {
    expect(detectKey({ ...chart("so letra"), meta: { keyLabel: "C (com forma de A)", capo: 3 } })).toEqual({
      key: "A",
      keySource: "meta",
      capo: 3,
      warnings: [],
    });
  });
});
