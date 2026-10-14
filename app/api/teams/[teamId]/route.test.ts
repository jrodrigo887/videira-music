import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createRouteTestContext, type RouteTestContext } from "@/lib/setlists/route-test-helpers";

import { createTeamPatchHandler } from "./route";

describe("PATCH /api/teams/[teamId]", () => {
  let adminContext: RouteTestContext;
  let musicianContext: RouteTestContext;

  beforeEach(async () => {
    adminContext = await createRouteTestContext("user-admin");
    musicianContext = await createRouteTestContext("user-musician");
  });

  afterEach(async () => {
    await adminContext.cleanup();
    await musicianContext.cleanup();
  });

  const params = { params: Promise.resolve({ teamId: "team-louvor" }) };

  it("renames a team", async () => {
    const handler = createTeamPatchHandler(adminContext.dependencies);
    const response = await handler(
      new Request("http://localhost/api/teams/team-louvor", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Louvor Principal" }),
      }),
      params,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.team.name).toBe("Louvor Principal");
    expect(body.team.slug).toBe("louvor");
  });

  it("archives a team", async () => {
    const handler = createTeamPatchHandler(adminContext.dependencies);
    const response = await handler(
      new Request("http://localhost/api/teams/team-jovens", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      }),
      { params: Promise.resolve({ teamId: "team-jovens" }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.team.archivedAt).toBeDefined();
  });

  it("returns 403 for non-admin", async () => {
    const handler = createTeamPatchHandler(musicianContext.dependencies);
    const response = await handler(
      new Request("http://localhost/api/teams/team-louvor", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hack" }),
      }),
      params,
    );
    expect(response.status).toBe(403);
  });

  it("returns 400 for invalid JSON", async () => {
    const handler = createTeamPatchHandler(adminContext.dependencies);
    const response = await handler(
      new Request("http://localhost/api/teams/team-louvor", {
        method: "PATCH",
        body: "{",
      }),
      params,
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid body", async () => {
    const handler = createTeamPatchHandler(adminContext.dependencies);
    const response = await handler(
      new Request("http://localhost/api/teams/team-louvor", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foo: "bar" }),
      }),
      params,
    );
    expect(response.status).toBe(400);
  });

  it("returns 503 when database is not configured", async () => {
    const handler = createTeamPatchHandler({
      ...adminContext.dependencies,
      isConfigured: () => false,
    });
    const response = await handler(
      new Request("http://localhost/api/teams/team-louvor", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "X" }),
      }),
      params,
    );
    expect(response.status).toBe(503);
  });

  it("rejects invalid rename names", async () => {
    const handler = createTeamPatchHandler(adminContext.dependencies);
    const response = await handler(
      new Request("http://localhost/api/teams/team-louvor", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "  " }),
      }),
      params,
    );
    expect(response.status).toBe(400);
  });
});
