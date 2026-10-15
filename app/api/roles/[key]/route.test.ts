import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAuthApiTestContext, type AuthApiTestContext } from "@/lib/auth/auth-route-test-helpers";
import { ensureSystemRoles } from "@/lib/roles/role-service";

import { DELETE, PATCH } from "./route";

describe("/api/roles/[key]", () => {
  let context: AuthApiTestContext;

  beforeEach(async () => {
    context = await createAuthApiTestContext("user-admin");
    await ensureSystemRoles(context.prisma, "org-default");
    await context.prisma.roleDefinition.create({
      data: {
        organizationId: "org-default",
        key: "patch-me",
        label: "Patch Me",
        system: false,
        capabilities: [],
      },
    });
  });

  afterEach(async () => {
    await context.prisma.roleDefinition.deleteMany({ where: { key: "patch-me" } });
    await context.cleanup();
  });

  it("PATCH updates label and capabilities", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/roles/patch-me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Atualizado", capabilities: ["import"] }),
      }),
      { params: Promise.resolve({ key: "patch-me" }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.role.label).toBe("Atualizado");
    expect(body.role.capabilities).toEqual(["import"]);
  });

  it("DELETE removes unused role", async () => {
    const response = await DELETE(new Request("http://localhost/api/roles/patch-me"), {
      params: Promise.resolve({ key: "patch-me" }),
    });
    expect(response.status).toBe(200);
  });

  it("DELETE system role returns SYSTEM_ROLE", async () => {
    const response = await DELETE(new Request("http://localhost/api/roles/admin"), {
      params: Promise.resolve({ key: "admin" }),
    });
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("SYSTEM_ROLE");
  });
});
