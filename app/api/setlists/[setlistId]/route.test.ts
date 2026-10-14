import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PrismaSetlistRepository } from "@/lib/setlists/prisma-setlist-repository";
import {
  createRouteTestContext,
  withSimulatedUser,
  type RouteTestContext,
} from "@/lib/setlists/route-test-helpers";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";

import {
  createSetlistDetailDeleteHandler,
  createSetlistDetailGetHandler,
  createSetlistDetailPatchHandler,
} from "./route";

describe("/api/setlists/[setlistId]", () => {
  let context: RouteTestContext;
  let repository: PrismaSetlistRepository;

  beforeEach(async () => {
    context = await createRouteTestContext("user-leader");
    repository = new PrismaSetlistRepository(context.prisma);
    await repository.create({
      id: "route-detail",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Detail",
      status: "draft",
      visibility: "team",
    });
  });

  afterEach(async () => {
    await context.cleanup();
  });

  const params = { params: Promise.resolve({ setlistId: "route-detail" }) };

  it("returns readable setlist on GET", async () => {
    const handler = createSetlistDetailGetHandler(context.dependencies);
    const response = await handler(new Request("http://localhost/api/setlists/route-detail"), params);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.setlist.id).toBe("route-detail");
  });

  it("returns 404 for missing setlist", async () => {
    const handler = createSetlistDetailGetHandler(context.dependencies);
    const response = await handler(new Request("http://localhost/api/setlists/missing"), {
      params: Promise.resolve({ setlistId: "missing" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 404 for unauthorized draft", async () => {
    const handler = createSetlistDetailGetHandler(withSimulatedUser(context, "user-musician"));
    const response = await handler(new Request("http://localhost/api/setlists/route-detail"), params);
    expect(response.status).toBe(404);
  });

  it("updates metadata on PATCH", async () => {
    const handler = createSetlistDetailPatchHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-detail", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: 1, title: "Atualizado" }),
      }),
      params,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.setlist.title).toBe("Atualizado");
  });

  it("returns 400 for invalid JSON on PATCH", async () => {
    const handler = createSetlistDetailPatchHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-detail", {
        method: "PATCH",
        body: "{",
      }),
      params,
    );
    expect(response.status).toBe(400);
  });

  it("returns version conflict on PATCH", async () => {
    const handler = createSetlistDetailPatchHandler(context.dependencies);
    await handler(
      new Request("http://localhost/api/setlists/route-detail", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: 1, title: "A" }),
      }),
      params,
    );
    const response = await handler(
      new Request("http://localhost/api/setlists/route-detail", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: 1, title: "B" }),
      }),
      params,
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "SETLIST_VERSION_CONFLICT", version: 2 },
    });
  });

  it("returns follower conflict on visibility change", async () => {
    await repository.updateMeta("route-detail", 1, { status: "published" });
    await repository.follow("route-detail", "team-jovens");
    const handler = createSetlistDetailPatchHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-detail", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: 2, visibility: "private" }),
      }),
      params,
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "SETLIST_HAS_FOLLOWERS", followerCount: 1 },
    });
  });

  it("retries visibility change after confirmation", async () => {
    await repository.updateMeta("route-detail", 1, { status: "published" });
    await repository.follow("route-detail", "team-jovens");
    const handler = createSetlistDetailPatchHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-detail", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 2,
          visibility: "private",
          confirmFollowersImpact: true,
        }),
      }),
      params,
    );
    expect(response.status).toBe(200);
  });

  it("soft deletes on DELETE", async () => {
    const handler = createSetlistDetailDeleteHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-detail", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: 1 }),
      }),
      params,
    );
    expect(response.status).toBe(204);
  });

  it("returns 503 when database is not configured", async () => {
    const handler = createSetlistDetailGetHandler({
      ...context.dependencies,
      isConfigured: () => false,
    });
    const response = await handler(new Request("http://localhost/api/setlists/route-detail"), params);
    expect(response.status).toBe(503);
  });

  it("returns invalid status transition on PATCH", async () => {
    const handler = createSetlistDetailPatchHandler(context.dependencies);
    const response = await handler(
      new Request("http://localhost/api/setlists/route-detail", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: 1, status: "archived" }),
      }),
      params,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_STATUS_TRANSITION" },
    });
  });

  it("returns 403 for unauthorized PATCH", async () => {
    const handler = createSetlistDetailPatchHandler(withSimulatedUser(context, "user-musician"));
    const response = await handler(
      new Request("http://localhost/api/setlists/route-detail", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: 1, title: "Hack" }),
      }),
      params,
    );
    expect(response.status).toBe(403);
  });
});
