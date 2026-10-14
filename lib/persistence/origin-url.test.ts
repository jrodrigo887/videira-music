import { describe, expect, it } from "vitest";

import { canonicalizeOriginUrl } from "./origin-url";

describe("canonicalizeOriginUrl", () => {
  it("removes hash fragments", () => {
    expect(
      canonicalizeOriginUrl("https://www.cifraclub.com.br/artista/cancao/#tabs"),
    ).toBe("https://www.cifraclub.com.br/artista/cancao/");
  });
});
