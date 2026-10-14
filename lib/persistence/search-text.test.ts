import { describe, expect, it } from "vitest";

import { buildSongSearchText, normalizeSearchPart } from "./search-text";

describe("search text", () => {
  it("normalizes diacritics for pt-BR search", () => {
    expect(normalizeSearchPart("Aclamação")).toBe("aclamação".normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR"));
  });

  it("builds search text from song fields", () => {
    expect(
      buildSongSearchText({
        id: "1",
        title: "Aclame",
        label: "Aclame",
        artist: "Diante do Trono",
        defaultKey: "A",
        alternateKeys: [],
        meta: "Tom A",
      }),
    ).toContain("aclame");
  });
});
