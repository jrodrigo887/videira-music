import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FIXTURE_CHART, FIXTURE_SONG } from "@/lib/setlists/setlist-test-fixture";
import { PrismaSetlistRepository } from "@/lib/setlists/prisma-setlist-repository";
import {
  createRouteTestContext,
  withSimulatedUser,
  type RouteTestContext,
} from "@/lib/setlists/route-test-helpers";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";

import { createSetlistClonePostHandler } from "./route";

describe("POST /api/setlists/[setlistId]/clone", () => {
  let context: RouteTestContext;
  let repository: PrismaSetlistRepository;

  beforeEach(async () => {
    context = await createRouteTestContext("user-leader");
    repository = new PrismaSetlistRepository(context.prisma);
    await repository.create({
      id: "route-clone",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-jovens",
      title: "Clone me",
      status: "published",
      visibility: "organization",
    });
    await repository.replaceItems("route-clone", 1, [
      {
        id: "item-1",
        kind: "song",
        songId: FIXTURE_SONG.id,
        chartId: FIXTURE_CHART.id,
        selectedKey: "G",
      },
    ]);
  });

  afterEach(async () => {
    await context.cleanup();
  });

  const params = { params: Promise.resolve({ setlistId: "route-clone" }) };

  it("returns 201 with cloned setlist for team destination", async () => {
    const handler = createSetlistClonePostHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-clone/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTeamId: "team-louvor" }),
      }),
      params,
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.setlist.ownerTeamId).toBe("team-louvor");
    expect(body.setlist.id).not.toBe("route-clone");
  });

  it("returns 201 for organization destination as admin", async () => {
    const handler = createSetlistClonePostHandler(withSimulatedUser(context, "user-admin"));
    const response = await handler(
      new Request("http://localhost/api/setlists/route-clone/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "organization" }),
      }),
      params,
    );
    expect(response.status).toBe(201);
  });

  it("returns CANNOT_CLONE for draft source", async () => {
    await repository.create({
      id: "route-clone-draft",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-jovens",
      title: "Draft",
      status: "draft",
      visibility: "team",
    });
    const handler = createSetlistClonePostHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-clone-draft/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTeamId: "team-louvor" }),
      }),
      { params: Promise.resolve({ setlistId: "route-clone-draft" }) },
    );
    expect(response.status).toBe(409);
  });

  it("returns FORBIDDEN for unauthorized clone destination", async () => {
    const handler = createSetlistClonePostHandler(withSimulatedUser(context, "user-musician"));
    const response = await handler(
      new Request("http://localhost/api/setlists/route-clone/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTeamId: "team-louvor" }),
      }),
      params,
    );
    expect(response.status).toBe(403);
  });

  it("returns 400 for invalid JSON", async () => {
    const handler = createSetlistClonePostHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-clone/clone", {
        method: "POST",
        body: "{",
      }),
      params,
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid clone body", async () => {
    const handler = createSetlistClonePostHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-clone/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTeamId: "" }),
      }),
      params,
    );
    expect(response.status).toBe(400);
  });

  it("returns 503 when database is not configured", async () => {
    const handler = createSetlistClonePostHandler({
      ...context.dependencies,
      isConfigured: () => false,
    });
    const response = await handler(
      new Request("http://localhost/api/setlists/route-clone/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTeamId: "team-louvor" }),
      }),
      params,
    );
    expect(response.status).toBe(503);
  });

  it("returns CANNOT_CLONE for unreadable source", async () => {
    await repository.create({
      id: "route-clone-private",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-jovens",
      title: "Private",
      status: "published",
      visibility: "private",
    });
    const handler = createSetlistClonePostHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-clone-private/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTeamId: "team-louvor" }),
      }),
      { params: Promise.resolve({ setlistId: "route-clone-private" }) },
    );
    expect(response.status).toBe(409);
  });
});
