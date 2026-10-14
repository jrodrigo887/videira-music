import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createRouteTestContext, type RouteTestContext } from "@/lib/setlists/route-test-helpers";

import { createTeamsGetHandler, createTeamsPostHandler } from "./route";

describe("/api/teams", () => {
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

  it("lists teams for admin", async () => {
    const handler = createTeamsGetHandler(adminContext.dependencies);
    const response = await handler(new Request("http://localhost/api/teams"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.teams.length).toBeGreaterThanOrEqual(2);
  });

  it("includes archived teams when requested", async () => {
    await adminContext.prisma.worshipTeam.update({
      where: { id: "team-jovens" },
      data: { archivedAt: new Date() },
    });
    const handler = createTeamsGetHandler(adminContext.dependencies);
    const response = await handler(new Request("http://localhost/api/teams?includeArchived=true"));
    const body = await response.json();
    expect(body.teams).toHaveLength(2);
  });

  it("returns 403 for non-admin list", async () => {
    const handler = createTeamsGetHandler(musicianContext.dependencies);
    const response = await handler(new Request("http://localhost/api/teams"));
    expect(response.status).toBe(403);
  });

  it("creates a team with 201", async () => {
    const handler = createTeamsPostHandler(adminContext.dependencies);
    const response = await handler(
      new Request("http://localhost/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Coral" }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.team.slug).toBe("coral");
  });

  it("resolves slug collisions on create", async () => {
    const handler = createTeamsPostHandler(adminContext.dependencies);
    const response = await handler(
      new Request("http://localhost/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Louvor" }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.team.slug).toBe("louvor-2");
  });

  it("returns 400 for invalid name", async () => {
    const handler = createTeamsPostHandler(adminContext.dependencies);
    const response = await handler(
      new Request("http://localhost/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   " }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 403 for non-admin create", async () => {
    const handler = createTeamsPostHandler(musicianContext.dependencies);
    const response = await handler(
      new Request("http://localhost/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Coral" }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("returns 503 when database is not configured", async () => {
    const handler = createTeamsGetHandler({
      ...adminContext.dependencies,
      isConfigured: () => false,
    });
    const response = await handler(new Request("http://localhost/api/teams"));
    expect(response.status).toBe(503);
  });
});
