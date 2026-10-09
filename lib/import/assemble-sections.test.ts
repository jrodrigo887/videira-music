import { describe, expect, it } from "vitest";

import { assembleSections } from "./assemble-sections";
import { classifyLines } from "./classify-lines";
import { normalizeText } from "./normalize-text";

function assemble(text: string, chordTokens?: string[]) {
  return assembleSections(classifyLines(normalizeText(text), { chordTokens }).lines);
}

const CHORDS_OVER_LYRICS = `[Intro] G  D/F#  Em  C

[Primeira Parte]
G              D/F#
  Linha de letra exemplo
Em                 C
Outra linha de letra aqui

[Refrão]
C        G
Refrão de exemplo`;

describe("assembleSections", () => {
  it("turns a chords-over-lyrics chart into sections and lyric lines", () => {
    expect(assemble(CHORDS_OVER_LYRICS)).toEqual({
      sections: [
        {
          id: "section-1",
          type: "verse",
          label: "Intro",
          content: {
            lines: [
              {
                text: "",
                chords: [
                  { symbol: "G", position: 0 },
                  { symbol: "D/F#", position: 3 },
                  { symbol: "Em", position: 9 },
                  { symbol: "C", position: 13 },
                ],
              },
            ],
          },
        },
        {
          id: "section-2",
          type: "verse",
          label: "Primeira Parte",
          content: {
            lines: [
              {
                text: "Linha de letra exemplo",
                chords: [
                  { symbol: "G", position: 0 },
                  { symbol: "D/F#", position: 13 },
                ],
              },
              {
                text: "Outra linha de letra aqui",
                chords: [
                  { symbol: "Em", position: 0 },
                  { symbol: "C", position: 19 },
                ],
              },
            ],
          },
        },
        {
          id: "section-3",
          type: "verse",
          label: "Refrão",
          content: {
            lines: [
              {
                text: "Refrão de exemplo",
                chords: [
                  { symbol: "C", position: 0 },
                  { symbol: "G", position: 9 },
                ],
              },
            ],
          },
        },
      ],
      ignoredLines: [],
    });
  });

  it("uses the injected section type resolver", () => {
    const { sections } = assembleSections(classifyLines(normalizeText("[Refrão]\nletra")).lines, {
      resolveSectionType: (label) => (label === "Refrão" ? "chorus" : "verse"),
    });

    expect(sections[0].type).toBe("chorus");
  });

  it("puts lines before any header in an implicit verse section", () => {
    const { sections } = assemble("G\nletra solta\n\n[Refrão]\nrefrão");

    expect(sections.map((section) => [section.type, section.label])).toEqual([
      ["verse", "Parte 1"],
      ["verse", "Refrão"],
    ]);
  });

  it("keeps lyric lines without chords", () => {
    const { sections } = assemble("[Verso]\nsem acorde em cima");

    expect(sections[0].content).toEqual({ lines: [{ text: "sem acorde em cima", chords: [] }] });
  });

  it("moves chords that fall before an indented lyric to position 0, keeping order", () => {
    const { sections } = assemble("G D    Em\n      letra recuada");

    expect(sections[0].content).toEqual({
      lines: [
        {
          text: "letra recuada",
          chords: [
            { symbol: "G", position: 0 },
            { symbol: "D", position: 0 },
            { symbol: "Em", position: 1 },
          ],
        },
      ],
    });
  });

  it("keeps chords past the end of the lyric", () => {
    const { sections } = assemble("G            D\ncurta");

    expect(sections[0].content).toEqual({
      lines: [
        {
          text: "curta",
          chords: [
            { symbol: "G", position: 0 },
            { symbol: "D", position: 13 },
          ],
        },
      ],
    });
  });

  it("turns a chord line without lyric below into an instrumental line", () => {
    const { sections } = assemble("[Ponte]\n   Am   F\n\nC    G\n   G   D\nletra");

    expect(sections[0].content).toEqual({
      lines: [
        {
          text: "",
          chords: [
            { symbol: "Am", position: 0 },
            { symbol: "F", position: 5 },
          ],
        },
        {
          text: "",
          chords: [
            { symbol: "C", position: 0 },
            { symbol: "G", position: 5 },
          ],
        },
        {
          text: "letra",
          chords: [
            { symbol: "G", position: 3 },
            { symbol: "D", position: 7 },
          ],
        },
      ],
    });
  });

  it("drops tablature and sections left empty by it, reporting ignored lines", () => {
    const text = `[Tab - Intro]
Parte 1 de 2
E|---0---2---|
B|---3-------|

[Verso]
G
letra
2x`;

    expect(assemble(text)).toEqual({
      sections: [
        {
          id: "section-1",
          type: "verse",
          label: "Verso",
          content: { lines: [{ text: "letra", chords: [{ symbol: "G", position: 0 }] }] },
        },
      ],
      ignoredLines: [
        { lineNumber: 2, kind: "tabMeta" },
        { lineNumber: 3, kind: "tabLine" },
        { lineNumber: 4, kind: "tabLine" },
        { lineNumber: 9, kind: "repeatMarker" },
      ],
    });
  });

  it("keeps an empty section header that had no tablature", () => {
    const { sections } = assemble("[Refrão]\n\n[Final]\nG\nfim");

    expect(sections.map((section) => section.label)).toEqual(["Refrão", "Final"]);
  });

  it("assembles Cifra Club style text using the marked chords", () => {
    const text = `[Intro] G7M(9)  D4(9)

G7M(9)
Em teu nome eu canto

                 D4(9)
Mais uma linha inventada

Am7          G/B    C9
Ainda outra linha de letra`;

    const { sections } = assemble(text, ["G7M(9)", "D4(9)", "G7M(9)", "D4(9)", "Am7", "G/B", "C9"]);

    expect(sections[0].content).toEqual({
      lines: [
        {
          text: "",
          chords: [
            { symbol: "G7M(9)", position: 0 },
            { symbol: "D4(9)", position: 8 },
          ],
        },
        { text: "Em teu nome eu canto", chords: [{ symbol: "G7M(9)", position: 0 }] },
        { text: "Mais uma linha inventada", chords: [{ symbol: "D4(9)", position: 17 }] },
        {
          text: "Ainda outra linha de letra",
          chords: [
            { symbol: "Am7", position: 0 },
            { symbol: "G/B", position: 13 },
            { symbol: "C9", position: 20 },
          ],
        },
      ],
    });
  });
});
