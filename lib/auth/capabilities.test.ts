import { describe, expect, it } from "vitest";

import {
  CAPABILITIES,
  ADMIN_ONLY_CAPABILITIES,
  capabilitiesMatchAdminPreset,
  closeCapabilities,
  holdsCapability,
  isCapability,
  systemCapabilities,
  unionCapabilities,
} from "./capabilities";
import { testUserActor } from "./test-actor";

describe("systemCapabilities", () => {
  it("admin has all nine capabilities", () => {
    expect(systemCapabilities("admin")).toEqual(expect.arrayContaining([...CAPABILITIES]));
    expect(systemCapabilities("admin")).toHaveLength(CAPABILITIES.length);
  });

  it("manager matches the auth matrix preset", () => {
    expect(systemCapabilities("manager")).toEqual(
      expect.arrayContaining([
        "users:invite",
        "member.manage",
        "teams:manage",
        "music:write",
        "import",
        "setlists:all",
        "setlists:led",
      ]),
    );
    expect(systemCapabilities("manager")).not.toEqual(
      expect.arrayContaining(["user.manage", "role.manage"]),
    );
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
  it("is true for all capabilities in any order", () => {
    const shuffled = [...CAPABILITIES].reverse();
    expect(capabilitiesMatchAdminPreset(shuffled)).toBe(true);
  });

  it("is true when a capability is listed twice", () => {
    expect(capabilitiesMatchAdminPreset([...CAPABILITIES, "import"])).toBe(true);
  });

  it("is false when missing an admin-only capability", () => {
    const withoutAdminOnly = CAPABILITIES.filter(
      (cap) => !ADMIN_ONLY_CAPABILITIES.includes(cap),
    );
    expect(capabilitiesMatchAdminPreset(withoutAdminOnly)).toBe(false);
  });
});

describe("closeCapabilities and holdsCapability", () => {
  const ORG = "org-a";

  it("closes import, member.manage and setlists:all into their bases", () => {
    expect(closeCapabilities(["import"])).toEqual(expect.arrayContaining(["import", "music:write"]));
    expect(closeCapabilities(["member.manage"])).toEqual(
      expect.arrayContaining(["member.manage", "users:invite"]),
    );
    expect(closeCapabilities(["setlists:all"])).toEqual(
      expect.arrayContaining(["setlists:all", "setlists:led"]),
    );
  });

  it("holdsCapability treats dependents as granting the base", () => {
    const importer = testUserActor({
      userId: "i",
      organizationId: ORG,
      roles: [],
      capabilities: ["import"],
      teams: [],
    });
    expect(holdsCapability(importer, "music:write", ORG)).toBe(true);
    expect(holdsCapability(importer, "import", ORG)).toBe(true);

    const memberMgr = testUserActor({
      userId: "m",
      organizationId: ORG,
      roles: [],
      capabilities: ["member.manage"],
      teams: [],
    });
    expect(holdsCapability(memberMgr, "users:invite", ORG)).toBe(true);

    const setlistAll = testUserActor({
      userId: "s",
      organizationId: ORG,
      roles: [],
      capabilities: ["setlists:all"],
      teams: [],
    });
    expect(holdsCapability(setlistAll, "setlists:led", ORG)).toBe(true);
  });
});

describe("system role unions", () => {
  it("manager plus worship_leader grants the union without admin-only capabilities", () => {
    const combined = unionCapabilities([
      systemCapabilities("manager") ?? [],
      systemCapabilities("worship_leader") ?? [],
    ]);
    expect(combined).toHaveLength(7);
    expect(combined).not.toEqual(expect.arrayContaining(ADMIN_ONLY_CAPABILITIES));
  });
});
