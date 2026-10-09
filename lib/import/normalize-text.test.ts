import { describe, expect, it } from "vitest";

import { normalizeText } from "./normalize-text";

describe("normalizeText", () => {
  it("splits CRLF and CR line endings", () => {
    expect(normalizeText("G\r\nletra\rfim")).toEqual(["G", "letra", "fim"]);
  });

  it("keeps leading spaces and drops trailing spaces", () => {
    expect(normalizeText("   D/F#   \n  letra  ")).toEqual(["   D/F#", "  letra"]);
  });

  it("expands tabs to the next tab stop so chord columns stay aligned", () => {
    expect(normalizeText("G\tD\n\tEm")).toEqual(["G   D", "    Em"]);
    expect(normalizeText("G\tD", { tabSize: 8 })).toEqual(["G       D"]);
  });

  it("turns NBSP and other space-like characters into plain spaces", () => {
    expect(normalizeText("G\u00A0\u00A0D\u202FEm")).toEqual(["G  D Em"]);
  });

  it("removes zero-width characters and BOM", () => {
    expect(normalizeText("\uFEFFG\u200B  D")).toEqual(["G  D"]);
  });

  it("keeps blank lines so line numbers match the source", () => {
    expect(normalizeText("[Intro]\n\nG")).toEqual(["[Intro]", "", "G"]);
  });
});
