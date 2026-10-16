import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST as approveAccessRequest } from "@/app/api/access-requests/[id]/approve/route";
import { PUT as putChart } from "@/app/api/charts/[chartId]/route";
import { POST as postInvite } from "@/app/api/invites/route";
import { POST as deactivateMember } from "@/app/api/members/[userId]/deactivate/route";
import { PUT as putMemberRoles } from "@/app/api/members/[userId]/roles/route";
import { POST as postRole } from "@/app/api/roles/route";
import { PATCH as patchSetlist } from "@/app/api/setlists/[setlistId]/route";
import { POST as postSetlist } from "@/app/api/setlists/route";
import { POST as postTeam } from "@/app/api/teams/route";
import { createAuthApiTestContext, type AuthApiTestContext } from "@/lib/auth/auth-route-test-helpers";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import { PrismaSetlistRepository } from "@/lib/setlists/prisma-setlist-repository";
import { ensureSystemRoles } from "@/lib/roles/role-service";

describe("permission matrix by role", () => {
  let context: AuthApiTestContext;
  let setlistRepo: PrismaSetlistRepository;
  let requestId: string;

  beforeAll(async () => {
    context = await createAuthApiTestContext("user-admin");
    setlistRepo = new PrismaSetlistRepository(context.prisma);
    await ensureSystemRoles(context.prisma, DEFAULT_ORGANIZATION_ID);
    await setlistRepo.create({
      id: "matrix-jovens",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-jovens",
      title: "Jovens",
      status: "draft",
      visibility: "team",
    });
    const request = await context.prisma.accessRequest.create({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        email: "matrix@videira.test",
        name: "Matrix",
        status: "pending",
      },
    });
    requestId = request.id;
  });

  afterAll(async () => {
    await context.cleanup();
  });

  it("denies musician on chart write, setlist create and team create", async () => {
    context.asUser("user-musician");

    const chartResponse = await putChart(
      new Request("http://localhost/api/charts/chart-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ chartId: "chart-1" }) },
    );
    expect(chartResponse.status).toBe(403);

    const setlistResponse = await postSetlist(
      new Request("http://localhost/api/setlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Novo", ownerTeamId: "team-louvor" }),
      }),
    );
    expect(setlistResponse.status).toBe(403);

    const teamResponse = await postTeam(
      new Request("http://localhost/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Novo grupo" }),
      }),
    );
    expect(teamResponse.status).toBe(403);
  });

  it("denies louvor leader from editing jovens setlist", async () => {
    context.asUser("user-leader");
    const response = await patchSetlist(
      new Request("http://localhost/api/setlists/matrix-jovens", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: 1, title: "Hack" }),
      }),
      { params: Promise.resolve({ setlistId: "matrix-jovens" }) },
    );
    expect(response.status).toBe(403);
  });

  it("denies manager from user-admin mutations but allows invite", async () => {
    context.asUser("user-manager");

    const rolesBefore = await context.prisma.userRole.findMany({
      where: { userId: "user-musician" },
    });

    const roleChange = await putMemberRoles(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: ["worship_leader"] }),
      }),
      { params: Promise.resolve({ userId: "user-musician" }) },
    );
    expect(roleChange.status).toBe(403);

    const rolesAfter = await context.prisma.userRole.findMany({
      where: { userId: "user-musician" },
    });
    expect(rolesAfter.map((row) => row.role).sort()).toEqual(rolesBefore.map((row) => row.role).sort());

    const deactivate = await deactivateMember(
      new Request("http://localhost", { method: "POST" }),
      { params: Promise.resolve({ userId: "user-musician" }) },
    );
    expect(deactivate.status).toBe(403);

    const approve = await approveAccessRequest(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: ["musician"], teamIds: [] }),
      }),
      { params: Promise.resolve({ id: requestId }) },
    );
    expect(approve.status).toBe(403);

    const createRoleResponse = await postRole(
      new Request("http://localhost/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Negado", capabilities: [] }),
      }),
    );
    expect(createRoleResponse.status).toBe(403);

    const invite = await postInvite(
      new Request("http://localhost/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "gestor-convite@videira.test",
          roles: ["musician"],
          teamIds: [],
          expiresInHours: 24,
        }),
      }),
    );
    expect(invite.status).toBe(201);
  });
});
