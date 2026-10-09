import { describe, expect, it } from "vitest";

import { assembleSections } from "./assemble-sections";
import { classifyLines } from "./classify-lines";
import { normalizeText } from "./normalize-text";
import { matchSectionType, resolveSectionType } from "./section-type";

describe("matchSectionType", () => {
  it.each([
    ["Intro", "intro"],
    ["Introdução", "intro"],
    ["Primeira Parte", "verse"],
    ["Segunda Parte", "verse"],
    ["Terceira Parte", "verse"],
    ["Parte 2", "verse"],
    ["1ª Parte", "verse"],
    ["Verso", "verse"],
    ["Estrofe", "verse"],
    ["Pré-Refrão", "preChorus"],
    ["Pré Refrão", "preChorus"],
    ["Refrão", "chorus"],
    ["Coro", "chorus"],
    ["Ponte", "bridge"],
    ["Solo", "solo"],
    ["Instrumental", "instrumental"],
    ["Interlúdio", "instrumental"],
    ["Passagem", "instrumental"],
    ["Final", "ending"],
    ["Outro", "ending"],
    ["Finalização", "ending"],
  ])("maps %s to %s", (label, type) => {
    expect(matchSectionType(label)).toBe(type);
  });

  it("ignores case, accents, punctuation and trailing repeat or number", () => {
    expect(matchSectionType("REFRAO")).toBe("chorus");
    expect(matchSectionType("  pré-refrão  ")).toBe("preChorus");
    expect(matchSectionType("Refrão (2x)")).toBe("chorus");
    expect(matchSectionType("Ponte 2")).toBe("bridge");
    expect(matchSectionType("Solo de guitarra")).toBe("solo");
  });

  it("does not match a keyword that is only a prefix of another word", () => {
    expect(matchSectionType("Coral")).toBeUndefined();
    expect(matchSectionType("Finalmente")).toBeUndefined();
  });

  it("returns undefined for unknown labels", () => {
    expect(matchSectionType("Tab - Intro")).toBeUndefined();
    expect(matchSectionType("Declaração")).toBeUndefined();
    expect(matchSectionType("")).toBeUndefined();
  });
});

describe("resolveSectionType", () => {
  it("falls back to verse for unknown labels", () => {
    expect(resolveSectionType("Declaração")).toBe("verse");
    expect(resolveSectionType("Refrão")).toBe("chorus");
  });

  it("plugs into assembleSections, keeping the original label", () => {
    const text = "[Intro] G  D\n\n[Segunda Parte]\nletra\n\n[Pré-Refrão]\nmais\n\n[Refrão]\nrefrão";
    const { sections } = assembleSections(classifyLines(normalizeText(text)).lines, { resolveSectionType });

    expect(sections.map((section) => [section.type, section.label])).toEqual([
      ["intro", "Intro"],
      ["verse", "Segunda Parte"],
      ["preChorus", "Pré-Refrão"],
      ["chorus", "Refrão"],
    ]);
  });
});
