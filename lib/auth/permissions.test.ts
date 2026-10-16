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

  it("users:invite and member.manage follow capability", () => {
    expect(can(manager, "users:invite", { organizationId: ORG })).toBe(true);
    expect(can(manager, "member.manage", { organizationId: ORG })).toBe(true);
    expect(can(musician, "member.manage", { organizationId: ORG })).toBe(false);
  });

  it("teams:manage and music:write follow capability", () => {
    expect(can(manager, "teams:manage", { organizationId: ORG })).toBe(true);
    expect(can(leader, "music:write", { organizationId: ORG })).toBe(true);
    expect(can(musician, "music:write", { organizationId: ORG })).toBe(false);
  });

  it("import follows capability and implies music:write", () => {
    expect(can(leader, "import", { organizationId: ORG })).toBe(true);
    expect(can(musician, "import", { organizationId: ORG })).toBe(false);
  });

  it("music:read is any active member with a role", () => {
    expect(can(musician, "music:read", { organizationId: ORG })).toBe(true);
    expect(can({ kind: "anonymous" }, "music:read", { organizationId: ORG })).toBe(false);
  });

  it("users:grantRole admin requires role.manage and other roles require user.manage", () => {
    expect(can(admin, "users:grantRole", { organizationId: ORG, role: "admin" })).toBe(true);
    expect(can(manager, "users:grantRole", { organizationId: ORG, role: "admin" })).toBe(false);
    expect(can(manager, "users:grantRole", { organizationId: ORG, role: "musician" })).toBe(false);
    expect(can(admin, "users:grantRole", { organizationId: ORG, role: "musician" })).toBe(true);
  });

  it("users:invite satisfies users:invite:led", () => {
    expect(can(manager, "users:invite:led", { organizationId: ORG })).toBe(true);
    expect(can(leader, "users:invite:led", { organizationId: ORG })).toBe(true);
    expect(can(musician, "users:invite:led", { organizationId: ORG })).toBe(false);
  });

  it("music:delete, org:settings and users:impersonate follow capability", () => {
    expect(can(manager, "music:delete", { organizationId: ORG })).toBe(true);
    expect(can(leader, "music:delete", { organizationId: ORG })).toBe(false);
    expect(can(admin, "org:settings", { organizationId: ORG })).toBe(true);
    expect(can(manager, "org:settings", { organizationId: ORG })).toBe(false);
    expect(can(admin, "users:impersonate", { organizationId: ORG })).toBe(true);
    expect(can(manager, "users:impersonate", { organizationId: ORG })).toBe(false);
  });

  it("custom role with import capability can import and satisfies music:write", () => {
    const importer = testUserActor({
      userId: "c",
      organizationId: ORG,
      roles: ["import-only"],
      capabilities: ["import"],
      teams: [],
    });
    expect(can(importer, "import", { organizationId: ORG })).toBe(true);
    expect(can(importer, "music:write", { organizationId: ORG })).toBe(true);
  });
});
