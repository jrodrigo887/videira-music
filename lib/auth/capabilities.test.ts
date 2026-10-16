import { describe, expect, it } from "vitest";

import {
  CAPABILITIES,
  capabilitiesMatchAdminPreset,
  isCapability,
  systemCapabilities,
  unionCapabilities,
} from "./capabilities";

describe("systemCapabilities", () => {
  it("admin has all seven capabilities", () => {
    expect(systemCapabilities("admin")).toEqual([...CAPABILITIES]);
  });

  it("manager matches the auth matrix preset", () => {
    expect(systemCapabilities("manager")).toEqual([
      "users:invite",
      "users:manage",
      "teams:manage",
      "music:write",
      "import",
      "setlists:all",
    ]);
  });

  it("worship_leader and musician match presets", () => {
    expect(systemCapabilities("worship_leader")).toEqual(["music:write", "import", "setlists:led"]);
    expect(systemCapabilities("musician")).toEqual([]);
  });

  it("isCapability rejects unknown strings", () => {
    expect(isCapability("users:invite")).toBe(true);
    expect(isCapability("grant-admin")).toBe(false);
  });
});

describe("capabilitiesMatchAdminPreset", () => {
  it("is true for all seven capabilities in any order", () => {
    const shuffled = [...CAPABILITIES].reverse();
    expect(capabilitiesMatchAdminPreset(shuffled)).toBe(true);
  });

  it("is true when a capability is listed twice", () => {
    expect(capabilitiesMatchAdminPreset([...CAPABILITIES, "import"])).toBe(true);
  });

  it("is false with only six capabilities", () => {
    expect(capabilitiesMatchAdminPreset(CAPABILITIES.slice(0, 6))).toBe(false);
  });
});

describe("system role unions", () => {
  it("manager plus worship_leader still grants the union of presets", () => {
    const combined = unionCapabilities([
      systemCapabilities("manager") ?? [],
      systemCapabilities("worship_leader") ?? [],
    ]);
    expect(combined).toHaveLength(CAPABILITIES.length);
  });
});
