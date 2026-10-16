import { describe, expect, it } from "vitest";

import { toggleCapability } from "./capability-toggle";

describe("toggleCapability", () => {
  it("adds implied capabilities when enabling dependents", () => {
    expect(toggleCapability([], "import", true).capabilities).toEqual(["import", "music:write"]);
    expect(toggleCapability([], "member.manage", true).capabilities).toEqual([
      "member.manage",
      "users:invite",
    ]);
    expect(toggleCapability([], "setlists:all", true).capabilities).toEqual([
      "setlists:all",
      "setlists:led",
    ]);
  });

  it("removes dependents when disabling a base and sets warning", () => {
    const result = toggleCapability(["import", "music:write"], "music:write", false);
    expect(result.capabilities).toEqual([]);
    expect(result.warning).toBe(true);
  });
});
