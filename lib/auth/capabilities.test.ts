import { describe, expect, it } from "vitest";

import { CAPABILITIES, isCapability, systemCapabilities } from "./capabilities";

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
