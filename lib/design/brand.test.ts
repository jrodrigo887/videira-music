import { describe, expect, it } from "vitest";

import { brandStyle, videiraBrand } from "./brand";

describe("brandStyle", () => {
  it("maps videiraBrand to the five --brand-* custom properties", () => {
    expect(brandStyle(videiraBrand)).toEqual({
      "--brand-primary": "136 42% 33%",
      "--brand-primary-hover": "140 45% 22%",
      "--brand-primary-foreground": "0 0% 100%",
      "--brand-primary-subtle": "138 38% 96%",
      "--brand-chord": "136 42% 33%",
    });
  });

  it("exposes videiraBrand.name without putting it in the style object", () => {
    expect(videiraBrand.name).toBe("Videira");
    expect(brandStyle(videiraBrand)).not.toHaveProperty("name");
    expect(Object.keys(brandStyle(videiraBrand))).toHaveLength(5);
  });

  it("requires primary on an empty object", () => {
    expect(() => brandStyle({})).toThrow("Brand color primary is required.");
  });

  it("rejects hex primary", () => {
    expect(() =>
      brandStyle({
        primary: "#2d6b3e",
        primaryHover: "140 45% 22%",
        primaryForeground: "0 0% 100%",
        primarySubtle: "138 38% 96%",
        chord: "136 42% 33%",
      }),
    ).toThrow(
      'Brand color primary must be HSL channels, for example "136 42% 33%".',
    );
  });

  it("rejects hsl() primary", () => {
    expect(() =>
      brandStyle({
        primary: "hsl(136, 42%, 33%)",
        primaryHover: "140 45% 22%",
        primaryForeground: "0 0% 100%",
        primarySubtle: "138 38% 96%",
        chord: "136 42% 33%",
      }),
    ).toThrow(
      'Brand color primary must be HSL channels, for example "136 42% 33%".',
    );
  });

  it("requires primaryHover when primary is valid", () => {
    expect(() =>
      brandStyle({
        primary: "136 42% 33%",
        primaryForeground: "0 0% 100%",
        primarySubtle: "138 38% 96%",
        chord: "136 42% 33%",
      }),
    ).toThrow("Brand color primaryHover is required.");
  });

  it("ignores extra keys without mutating the input", () => {
    const input = {
      ...videiraBrand,
      extra: "ignored",
    };
    const snapshot = { ...input };
    expect(brandStyle(input)).toEqual(brandStyle(videiraBrand));
    expect(input).toEqual(snapshot);
    expect(brandStyle(input)).not.toHaveProperty("extra");
  });
});
