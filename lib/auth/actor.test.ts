import { describe, expect, it } from "vitest";

import { hasCapability, hasRole } from "./actor";
import { testUserActor } from "./test-actor";

describe("hasCapability", () => {
  it("requires the same organization", () => {
    const actor = testUserActor({
      userId: "u1",
      organizationId: "org-a",
      roles: ["manager"],
      teams: [],
    });
    expect(hasCapability(actor, "member.manage", "org-a")).toBe(true);
    expect(hasCapability(actor, "member.manage", "org-b")).toBe(false);
  });

  it("hasRole still checks system admin key", () => {
    const admin = testUserActor({
      userId: "u1",
      organizationId: "org-a",
      roles: ["admin"],
      teams: [],
    });
    expect(hasRole(admin, "admin", "org-a")).toBe(true);
    expect(hasRole(admin, "manager", "org-a")).toBe(false);
  });

  it("anonymous actor has no capabilities", () => {
    expect(hasCapability({ kind: "anonymous" }, "import", "org-a")).toBe(false);
  });
});
