import { describe, expect, it } from "vitest";

import { RoleKeyError, roleKeyFromLabel, validateRoleLabel } from "./role-key";

describe("roleKeyFromLabel", () => {
  it("normalizes accents and spaces", () => {
    expect(roleKeyFromLabel("Intercessão Jovem")).toBe("intercessao-jovem");
  });

  it("rejects short or long labels", () => {
    expect(() => validateRoleLabel("a")).toThrow(RoleKeyError);
    expect(() => validateRoleLabel("x".repeat(41))).toThrow(RoleKeyError);
  });

  it("trims label length before validating", () => {
    expect(roleKeyFromLabel("  Ab  ")).toBe("ab");
  });

  it("does not change an existing stored key (derivation only on create)", () => {
    const key = roleKeyFromLabel("Ministério");
    expect(key).toBe("ministerio");
    expect(roleKeyFromLabel("Outro Nome")).not.toBe(key);
  });
});
