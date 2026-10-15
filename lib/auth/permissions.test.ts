import { describe, expect, it } from "vitest";

import { can } from "./permissions";
import { testUserActor } from "./test-actor";

const ORG = "org-default";

describe("can() by capability", () => {
  const admin = testUserActor({ userId: "a", organizationId: ORG, roles: ["admin"], teams: [] });
  const manager = testUserActor({ userId: "m", organizationId: ORG, roles: ["manager"], teams: [] });
  const leader = testUserActor({
    userId: "l",
    organizationId: ORG,
    roles: ["worship_leader"],
    teams: [],
  });
  const musician = testUserActor({ userId: "mu", organizationId: ORG, roles: ["musician"], teams: [] });

  it("users:invite and users:manage follow capability", () => {
    expect(can(manager, "users:invite", { organizationId: ORG })).toBe(true);
    expect(can(musician, "users:manage", { organizationId: ORG })).toBe(false);
  });

  it("teams:manage and music:write follow capability", () => {
    expect(can(manager, "teams:manage", { organizationId: ORG })).toBe(true);
    expect(can(leader, "music:write", { organizationId: ORG })).toBe(true);
    expect(can(musician, "music:write", { organizationId: ORG })).toBe(false);
  });

  it("import follows capability", () => {
    expect(can(leader, "import", { organizationId: ORG })).toBe(true);
    expect(can(musician, "import", { organizationId: ORG })).toBe(false);
  });

  it("music:read is any active member with a role", () => {
    expect(can(musician, "music:read", { organizationId: ORG })).toBe(true);
    expect(can({ kind: "anonymous" }, "music:read", { organizationId: ORG })).toBe(false);
  });

  it("users:grantRole admin requires system admin", () => {
    expect(can(admin, "users:grantRole", { organizationId: ORG, role: "admin" })).toBe(true);
    expect(can(manager, "users:grantRole", { organizationId: ORG, role: "admin" })).toBe(false);
    expect(can(manager, "users:grantRole", { organizationId: ORG, role: "musician" })).toBe(true);
  });

  it("custom role with import capability can import", () => {
    const importer = testUserActor({
      userId: "c",
      organizationId: ORG,
      roles: ["import-only"],
      capabilities: ["import"],
      teams: [],
    });
    expect(can(importer, "import", { organizationId: ORG })).toBe(true);
    expect(can(importer, "music:write", { organizationId: ORG })).toBe(false);
  });
});
