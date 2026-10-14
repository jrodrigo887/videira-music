import { describe, expect, it } from "vitest";

import { resolveTeamSlugCollision, slugifyTeamName } from "./team-slug";

describe("slugifyTeamName", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugifyTeamName("Louvor Principal")).toBe("louvor-principal");
  });

  it("removes accents", () => {
    expect(slugifyTeamName("Música & Adoração")).toBe("musica-adoracao");
  });

  it("strips punctuation", () => {
    expect(slugifyTeamName("  Jovens!!!  ")).toBe("jovens");
  });

  it("falls back when normalization is empty", () => {
    expect(slugifyTeamName("---")).toBe("grupo");
  });
});

describe("resolveTeamSlugCollision", () => {
  it("returns the base slug when free", () => {
    expect(resolveTeamSlugCollision("louvor", new Set(["jovens"]))).toBe("louvor");
  });

  it("adds -2 on first collision", () => {
    expect(resolveTeamSlugCollision("louvor", new Set(["louvor"]))).toBe("louvor-2");
  });

  it("increments suffix until unique", () => {
    expect(resolveTeamSlugCollision("louvor", new Set(["louvor", "louvor-2"]))).toBe("louvor-3");
  });
});
