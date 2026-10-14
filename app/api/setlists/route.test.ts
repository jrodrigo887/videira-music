import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PrismaSetlistRepository } from "@/lib/setlists/prisma-setlist-repository";
import {
  createRouteTestContext,
  withSimulatedUser,
  type RouteTestContext,
} from "@/lib/setlists/route-test-helpers";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";

import { createSetlistsGetHandler, createSetlistsPostHandler } from "./route";

describe("GET /api/setlists", () => {
  let context: RouteTestContext;
  let repository: PrismaSetlistRepository;

  beforeEach(async () => {
    context = await createRouteTestContext("user-leader");
    repository = new PrismaSetlistRepository(context.prisma);
  });

  afterEach(async () => {
    await context.cleanup();
  });

  async function seedPublished(id: string, ownerTeamId: string | null) {
    await repository.create({
      id,
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId,
      title: id,
      status: "published",
      visibility: ownerTeamId ? "team" : "organization",
    });
  }

  it("returns team tab setlists", async () => {
    await seedPublished("route-team", "team-louvor");
    const handler = createSetlistsGetHandler(context.dependencies);
    const response = await handler(new Request("http://localhost/api/setlists?team=louvor&tab=team"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.setlists.map((entry: { id: string }) => entry.id)).toContain("route-team");
  });

  it("returns others tab setlists", async () => {
    await repository.create({
      id: "route-others",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-jovens",
      title: "route-others",
      status: "published",
      visibility: "organization",
    });
    const handler = createSetlistsGetHandler(withSimulatedUser(context, "user-musician"));
    const response = await handler(new Request("http://localhost/api/setlists?team=louvor&tab=others"));
    const body = await response.json();
    expect(body.setlists.map((entry: { id: string }) => entry.id)).toContain("route-others");
  });

  it("returns organization tab setlists", async () => {
    await seedPublished("route-org", null);
    const handler = createSetlistsGetHandler(context.dependencies);
    const response = await handler(new Request("http://localhost/api/setlists?tab=organization"));
    const body = await response.json();
    expect(body.setlists.map((entry: { id: string }) => entry.id)).toContain("route-org");
  });

  it("returns following tab entries", async () => {
    await seedPublished("route-follow", "team-jovens");
    await repository.follow("route-follow", "team-louvor");
    const handler = createSetlistsGetHandler(context.dependencies);
    const response = await handler(new Request("http://localhost/api/setlists?team=louvor&tab=following"));
    const body = await response.json();
    expect(body.setlists[0]).toMatchObject({ setlistId: "route-follow", available: true });
  });

  it("returns 503 when database is not configured", async () => {
    const handler = createSetlistsGetHandler({
      ...context.dependencies,
      isConfigured: () => false,
    });
    const response = await handler(new Request("http://localhost/api/setlists"));
    expect(response.status).toBe(503);
  });
});

describe("POST /api/setlists", () => {
  let context: RouteTestContext;

  beforeEach(async () => {
    context = await createRouteTestContext("user-leader");
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it("creates a team setlist", async () => {
    const handler = createSetlistsPostHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Domingo", ownerTeamId: "team-louvor" }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.setlist.title).toBe("Domingo");
  });

  it("creates organization setlist for admin", async () => {
    const handler = createSetlistsPostHandler(withSimulatedUser(context, "user-admin"));
    const response = await handler(
      new Request("http://localhost/api/setlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Igreja", owner: "organization" }),
      }),
    );
    expect(response.status).toBe(201);
  });

  it("returns 400 for invalid JSON", async () => {
    const handler = createSetlistsPostHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists", {
        method: "POST",
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("returns validation errors for invalid title", async () => {
    const handler = createSetlistsPostHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "   ", ownerTeamId: "team-louvor" }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 403 for unauthorized create", async () => {
    const handler = createSetlistsPostHandler(withSimulatedUser(context, "user-musician"));
    const response = await handler(
      new Request("http://localhost/api/setlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Nope", ownerTeamId: "team-louvor" }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("returns 503 when database is not configured", async () => {
    const handler = createSetlistsPostHandler({
      ...context.dependencies,
      isConfigured: () => false,
    });
    const response = await handler(
      new Request("http://localhost/api/setlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "X", ownerTeamId: "team-louvor" }),
      }),
    );
    expect(response.status).toBe(503);
  });
});
