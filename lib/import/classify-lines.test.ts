import { describe, expect, it } from "vitest";

import { classifyLines, type LineKind } from "./classify-lines";

function kindOf(line: string): LineKind {
  return classifyLines([line]).lines[0].kind;
}

describe("classifyLines (heuristic)", () => {
  it.each<[string, LineKind]>([
    ["", "blank"],
    ["    ", "blank"],
    ["[Refrão]", "sectionHeader"],
    ["[Refrão] (2x)", "sectionHeader"],
    ["[Intro] G  D/F#  Em", "sectionHeaderWithChords"],
    ["G      D/F#   Em", "chordLine"],
    ["   C9        G/B", "chordLine"],
    ["| G  D | Em  C |", "chordLine"],
    ["( C#m7  A9  E )", "chordLine"],
    ["G  D  Em  C  2x", "chordLine"],
    ["E|---0---2---|", "tabLine"],
    ["B|-----3h5----|", "tabLine"],
    ["Parte 1 de 2", "tabMeta"],
    ["2x", "repeatMarker"],
    ["(3x)", "repeatMarker"],
    ["{key: A}", "directive"],
    ["Linha de letra inventada", "lyric"],
  ])("classifies %j as %s", (line, kind) => {
    expect(kindOf(line)).toBe(kind);
  });

  it("does not take lyrics that start with chord-like words as chord lines", () => {
    expect(kindOf("A Deus seja a glória")).toBe("lyric");
    expect(kindOf("Em Deus confiarei")).toBe("lyric");
    expect(kindOf("Bem cedo eu vou")).toBe("lyric");
  });

  it("treats a header followed by lyric text as lyric", () => {
    expect(kindOf("[Refrão] canta comigo")).toBe("lyric");
  });

  it("returns chord symbols with their absolute columns", () => {
    const [line] = classifyLines(["  G    D/F#  (Em"]).lines;

    expect(line.chords).toEqual([
      { symbol: "G", column: 2 },
      { symbol: "D/F#", column: 7 },
      { symbol: "Em", column: 14 },
    ]);
  });

  it("keeps closing parens that belong to the chord", () => {
    const [line] = classifyLines(["(G7M(9)  D4(9))"]).lines;

    expect(line.chords?.map((chord) => chord.symbol)).toEqual(["G7M(9)", "D4(9)"]);
  });

  it("reads section label and chords from a header with chords", () => {
    const [line] = classifyLines(["[Intro] G  D"]).lines;

    expect(line).toMatchObject({
      kind: "sectionHeaderWithChords",
      label: "Intro",
      chords: [
        { symbol: "G", column: 8 },
        { symbol: "D", column: 11 },
      ],
    });
  });

  it("parses directives", () => {
    expect(classifyLines(["{Capo: 2}"]).lines[0].directive).toEqual({ name: "capo", value: "2" });
  });

  it("numbers lines from 1", () => {
    expect(classifyLines(["G", "", "letra"]).lines.map((line) => line.lineNumber)).toEqual([1, 2, 3]);
  });
});

describe("classifyLines (markup chord tokens)", () => {
  it("uses the marked chord sequence as the chord line signal", () => {
    const result = classifyLines(["[Intro] G  D", "", "Em", "Em", "dizer o teu nome"], {
      chordTokens: ["G", "D", "Em"],
    });

    expect(result.chordSignal).toBe("markup");
    expect(result.lines.map((line) => line.kind)).toEqual([
      "sectionHeaderWithChords",
      "blank",
      "chordLine",
      "lyric",
      "lyric",
    ]);
    expect(result.unmatchedChordTokens).toEqual([]);
  });

  it("accepts chords outside the strict grammar when they are marked", () => {
    const result = classifyLines(["G  Dsus2sus4  N.C.", "letra"], {
      chordTokens: ["G", "Dsus2sus4", "N.C."],
    });

    expect(result.lines[0].kind).toBe("chordLine");
  });

  it("resyncs when a marked chord sits inside a lyric line", () => {
    const result = classifyLines(["Intro: G D", "Am   C", "letra"], {
      chordTokens: ["G", "D", "Am", "C"],
    });

    expect(result.lines.map((line) => line.kind)).toEqual(["lyric", "chordLine", "lyric"]);
    expect(result.unmatchedChordTokens).toEqual(["G", "D"]);
  });

  it("falls back to the heuristic when the text does not line up with the markup", () => {
    const result = classifyLines(["G  D", "letra"], { chordTokens: ["A", "E", "F#m", "D"] });

    expect(result.chordSignal).toBe("heuristic");
    expect(result.lines[0].kind).toBe("chordLine");
  });
});
